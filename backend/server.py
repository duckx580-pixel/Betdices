from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import uvicorn
import secrets
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---- Config ----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get("JWT_SECRET", "betdice-secret")
ADMIN_GROW_ID = os.environ.get("ADMIN_GROW_ID", "HAYABUSAN").upper()
DEFAULT_ADMIN_PASSWORD_HASH = "$2b$12$5nP5rjQRWCbPQv83Vx8COuFpa4Jt7q7h7EGaK4QjvFjbXkkEPlrLK"  # hongprokh123
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", DEFAULT_ADMIN_PASSWORD_HASH)
QRIS_IMAGE_URL = os.environ.get("QRIS_IMAGE_URL", "")
DANA_PHONE = os.environ.get("DANA_PHONE", "")
DANA_NAME = os.environ.get("DANA_NAME", "")
PAYPAL_EMAIL = os.environ.get("PAYPAL_EMAIL", "")
RATE_IDR_PER_DL = float(os.environ.get("RATE_IDR_PER_DL", "10000"))
RATE_USD_PER_DL = float(os.environ.get("RATE_USD_PER_DL", "0.65"))

app = FastAPI()
api = APIRouter(prefix="/api")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---- Utils ----
def now_iso():
    return datetime.now(timezone.utc).isoformat()


def make_default_user(grow_id: str, is_admin: bool = False) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "grow_id": grow_id.upper(),
        "username": grow_id.upper(),
        "avatar": f"https://i.pravatar.cc/120?u={grow_id.upper()}",
        "balance": {"dl": 0.0, "bgl": 0.0, "wl": 0.0},
        "vip": {
            "level": "Bronze 1",
            "next_level": "Bronze 2",
            "progress": 0,
            "xp": 0,
            "xp_to_next": 1000,
        },
        "is_admin": is_admin,
        "created_at": now_iso(),
    }


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": u["id"],
        "grow_id": u["grow_id"],
        "username": u.get("username", u["grow_id"]),
        "avatar": u.get("avatar"),
        "balance": u.get("balance", {"dl": 0, "bgl": 0, "wl": 0}),
        "vip": u.get("vip", {}),
        "is_admin": u.get("is_admin", False),
    }


def make_token(user: Dict[str, Any]) -> str:
    payload = {
        "sub": user["id"],
        "grow_id": user["grow_id"],
        "is_admin": user.get("is_admin", False),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not u:
        raise HTTPException(401, "User not found")
    return u


async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    return user


async def credit_user(user_id: str, dl: float = 0, bgl: float = 0, wl: float = 0):
    """Credit user balance. Uses $inc for atomicity."""
    inc = {}
    if dl:
        inc["balance.dl"] = round(dl, 4)
    if bgl:
        inc["balance.bgl"] = round(bgl, 4)
    if wl:
        inc["balance.wl"] = round(wl, 4)
    if inc:
        await db.users.update_one({"id": user_id}, {"$inc": inc})
    return await db.users.find_one({"id": user_id}, {"_id": 0})


# ---- Models ----
class LoginReq(BaseModel):
    grow_id: str
    password: str


class RegisterReq(BaseModel):
    grow_id: str
    password: str


class DepositReq(BaseModel):
    method: str  # growtopia | qris | dana | paypal
    amount: float  # for fiat: IDR or USD; for growtopia: DL count
    currency: str  # DL | IDR | USD (source currency)
    proof_image: Optional[str] = None  # base64 data URL
    reference: Optional[str] = None
    note: Optional[str] = None


class WithdrawReq(BaseModel):
    amount: float
    currency: str  # DL or BGL
    grow_id: str


class TipReq(BaseModel):
    to_username: str
    amount: float
    message: Optional[str] = None


class BetReq(BaseModel):
    game: str
    bet: float
    payout: float  # net winnings; if win: bet*(mult-1). If loss: 0
    won: bool
    multiplier: Optional[float] = None
    meta: Optional[Dict[str, Any]] = None


class ApproveReq(BaseModel):
    status: str  # approved | rejected
    admin_note: Optional[str] = None


class CaseItemIn(BaseModel):
    id: Optional[str] = None
    name: str
    value: float
    probability_percentage: float


class CaseUpsertReq(BaseModel):
    name: str
    image: Optional[str] = None
    price_dl: float
    is_active: bool = True
    items: List[CaseItemIn]


class BattleCreateReq(BaseModel):
    selected_cases: List[str]
    mode: str = "normal"  # normal | jackpot


battle_connections: Dict[str, Set[WebSocket]] = {}


def probability_to_basis(probability_percentage: float) -> int:
    try:
        value = Decimal(str(probability_percentage))
    except (InvalidOperation, TypeError):
        raise HTTPException(400, "Invalid probability value")
    if value <= 0:
        raise HTTPException(400, "Probability must be > 0")
    basis = (value * Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(basis)


def normalize_case_items(items: List[CaseItemIn]) -> List[Dict[str, Any]]:
    if not items:
        raise HTTPException(400, "Case must contain at least one item")
    normalized = []
    total_basis = 0
    for item in items:
        if not item.name.strip():
            raise HTTPException(400, "Case item name is required")
        if item.value < 0:
            raise HTTPException(400, "Case item value must be >= 0")
        basis = probability_to_basis(item.probability_percentage)
        total_basis += basis
        normalized.append(
            {
                "id": item.id or str(uuid.uuid4()),
                "name": item.name.strip(),
                "value": round(float(item.value), 4),
                "probability_percentage": float((Decimal(basis) / Decimal("100")).quantize(Decimal("0.01"))),
                "probability_basis": basis,
            }
        )
    if total_basis != 10000:
        raise HTTPException(400, "Total probability_percentage must equal exactly 100.00")
    return normalized


async def ensure_case_exists(case_id: str) -> Dict[str, Any]:
    case_doc = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, f"Case not found: {case_id}")
    return case_doc


async def create_battle_log(
    battle_id: str,
    event_type: str,
    event_payload: Dict[str, Any],
    actor_user_id: Optional[str] = None,
    round_number: Optional[int] = None,
) -> Dict[str, Any]:
    doc = {
        "id": str(uuid.uuid4()),
        "battle_id": battle_id,
        "event_type": event_type,
        "event_payload": event_payload,
        "round": round_number,
        "actor_user_id": actor_user_id,
        "created_at": now_iso(),
    }
    await db.battle_logs.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def battle_ws_connect(battle_id: str, websocket: WebSocket):
    await websocket.accept()
    battle_connections.setdefault(battle_id, set()).add(websocket)


def battle_ws_disconnect(battle_id: str, websocket: WebSocket):
    room = battle_connections.get(battle_id)
    if not room:
        return
    room.discard(websocket)
    if not room:
        battle_connections.pop(battle_id, None)


async def battle_ws_broadcast(battle_id: str, payload: Dict[str, Any]):
    room = battle_connections.get(battle_id, set()).copy()
    dead = []
    for socket in room:
        try:
            await socket.send_json(payload)
        except Exception:
            dead.append(socket)
    for socket in dead:
        battle_ws_disconnect(battle_id, socket)


def choose_weighted_player(weights: List[int]) -> int:
    total = sum(weights)
    if total <= 0:
        return secrets.randbelow(len(weights))
    roll = secrets.randbelow(total) + 1
    cumulative = 0
    for index, weight in enumerate(weights):
        cumulative += weight
        if roll <= cumulative:
            return index
    return len(weights) - 1


async def open_case_service(case_id: str, user_id: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    case_doc = await db.cases.find_one({"id": case_id, "is_active": True}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found or inactive")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")

    price = round(float(case_doc.get("price_dl", 0)), 4)
    current_dl = float(user.get("balance", {}).get("dl", 0))
    if current_dl < price:
        raise HTTPException(400, "Insufficient DL balance")

    items = case_doc.get("items", [])
    if not items:
        raise HTTPException(400, "Case has no prizes")
    weights = [int(i.get("probability_basis", 0)) for i in items]
    if not all(w > 0 for w in weights) or sum(weights) != 10000:
        raise HTTPException(400, "Case probability configuration is invalid")

    chosen_index = choose_weighted_player(weights)
    selected_item = items[chosen_index]
    selected_value = round(float(selected_item.get("value", 0)), 4)
    net = round(selected_value - price, 4)

    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"balance.dl": net}},
    )
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})

    open_doc = {
        "id": str(uuid.uuid4()),
        "case_id": case_doc["id"],
        "case_name": case_doc["name"],
        "case_price_dl": price,
        "user_id": user["id"],
        "username": user.get("username"),
        "item": {
            "id": selected_item["id"],
            "name": selected_item["name"],
            "value": selected_value,
            "probability_percentage": selected_item["probability_percentage"],
        },
        "net": net,
        "context": context or {},
        "created_at": now_iso(),
    }
    await db.case_opens.insert_one(open_doc)
    open_doc.pop("_id", None)
    return {
        "open": open_doc,
        "user_balance": updated_user.get("balance", {"dl": 0, "bgl": 0, "wl": 0}),
    }


def recompute_totals(battle_doc: Dict[str, Any]) -> Dict[str, float]:
    totals = {p["user_id"]: 0.0 for p in battle_doc.get("players", [])}
    for round_data in battle_doc.get("round_results", []):
        for result in round_data.get("results", []):
            uid = result.get("user_id")
            totals[uid] = round(float(totals.get(uid, 0)) + float(result.get("item_value", 0)), 4)
    return totals


# ---- Auth ----
@api.post("/auth/login")
async def login(req: LoginReq):
    grow_id = req.grow_id.strip().upper()
    password = req.password
    if not grow_id or len(grow_id) < 3:
        raise HTTPException(400, "Invalid GrowID")
    if not password or len(password) < 6:
        raise HTTPException(400, "Invalid password")

    is_admin_attempt = grow_id == ADMIN_GROW_ID
    user = await db.users.find_one({"grow_id": grow_id}, {"_id": 0})

    if is_admin_attempt:
        if not verify_password(password, ADMIN_PASSWORD_HASH):
            raise HTTPException(401, "Invalid credentials")
        if not user:
            user = make_default_user(grow_id, is_admin=True)
            user["password_hash"] = ADMIN_PASSWORD_HASH
            user["balance"] = {"dl": 100.0, "bgl": 2.0, "wl": 0.0}
            user["vip"] = {
                "level": "Gold 1",
                "next_level": "Gold 2",
                "progress": 62,
                "xp": 6200,
                "xp_to_next": 10000,
            }
            await db.users.insert_one(user)
        else:
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"is_admin": True, "password_hash": ADMIN_PASSWORD_HASH}},
            )
            user["is_admin"] = True
            user["password_hash"] = ADMIN_PASSWORD_HASH
    else:
        if not user:
            raise HTTPException(401, "Invalid credentials")
        password_hash = user.get("password_hash")
        if not password_hash or not verify_password(password, password_hash):
            raise HTTPException(401, "Invalid credentials")

    token = make_token(user)
    return {"token": token, "user": public_user(user)}


@api.post("/auth/register")
async def register(req: RegisterReq):
    grow_id = req.grow_id.strip().upper()
    password = req.password
    if not grow_id or len(grow_id) < 3:
        raise HTTPException(400, "Invalid GrowID")
    if not password or len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    existing = await db.users.find_one({"grow_id": grow_id}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(409, "GrowID already exists")

    is_admin = grow_id == ADMIN_GROW_ID
    if is_admin and not verify_password(password, ADMIN_PASSWORD_HASH):
        raise HTTPException(401, "Invalid admin password")

    user = make_default_user(grow_id, is_admin=is_admin)
    user["password_hash"] = ADMIN_PASSWORD_HASH if is_admin else hash_password(password)
    if is_admin:
        user["balance"] = {"dl": 100.0, "bgl": 2.0, "wl": 0.0}
        user["vip"] = {
            "level": "Gold 1",
            "next_level": "Gold 2",
            "progress": 62,
            "xp": 6200,
            "xp_to_next": 10000,
        }
    await db.users.insert_one(user)

    token = make_token(user)
    return {"token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


# ---- Config (public) ----
@api.get("/config")
async def get_config():
    return {
        "qris_image_url": QRIS_IMAGE_URL,
        "dana_phone": DANA_PHONE,
        "dana_name": DANA_NAME,
        "paypal_email": PAYPAL_EMAIL,
        "rate_idr_per_dl": RATE_IDR_PER_DL,
        "rate_usd_per_dl": RATE_USD_PER_DL,
        "min_deposit_dl": 5,
        "max_deposit_bgl": 200,
    }


# ---- Deposits ----
@api.post("/deposits")
async def create_deposit(req: DepositReq, user=Depends(get_current_user)):
    if req.method not in ("growtopia", "qris", "dana", "paypal"):
        raise HTTPException(400, "Invalid method")
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")

    # Compute DL credit for this deposit
    if req.method == "growtopia":
        # amount is already in DL
        dl_credit = req.amount
    elif req.method in ("qris", "dana"):
        dl_credit = round(req.amount / RATE_IDR_PER_DL, 4)
    elif req.method == "paypal":
        dl_credit = round(req.amount / RATE_USD_PER_DL, 4)

    if req.method != "growtopia" and dl_credit < 0.1:
        raise HTTPException(400, "Amount too small")

    # For fiat methods, require proof image
    if req.method in ("qris", "dana", "paypal") and not req.proof_image:
        raise HTTPException(400, "Payment proof screenshot required")

    deposit = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "grow_id": user["grow_id"],
        "username": user["username"],
        "method": req.method,
        "amount": req.amount,
        "currency": req.currency,
        "dl_credit": dl_credit,
        "proof_image": req.proof_image,
        "reference": req.reference,
        "note": req.note,
        "status": "pending",
        "created_at": now_iso(),
        "approved_at": None,
        "admin_note": None,
    }
    await db.deposits.insert_one(deposit)
    dep_out = dict(deposit)
    dep_out.pop("_id", None)
    return dep_out


@api.get("/deposits/me")
async def my_deposits(user=Depends(get_current_user)):
    items = await db.deposits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ---- Withdraw ----
@api.post("/withdraws")
async def create_withdraw(req: WithdrawReq, user=Depends(get_current_user)):
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    cur = req.currency.upper()
    if cur not in ("DL", "BGL"):
        raise HTTPException(400, "Currency must be DL or BGL")
    field = "balance.dl" if cur == "DL" else "balance.bgl"
    bal = user.get("balance", {}).get(cur.lower(), 0)
    if bal < req.amount:
        raise HTTPException(400, "Insufficient balance")

    # Deduct
    await db.users.update_one({"id": user["id"]}, {"$inc": {field: -req.amount}})

    wd = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "grow_id": req.grow_id.upper(),
        "username": user["username"],
        "amount": req.amount,
        "currency": cur,
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.withdraws.insert_one(wd)
    wd.pop("_id", None)
    return wd


@api.get("/withdraws/me")
async def my_withdraws(user=Depends(get_current_user)):
    items = await db.withdraws.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


# ---- Tips ----
@api.post("/tips")
async def tip(req: TipReq, user=Depends(get_current_user)):
    if req.amount <= 0:
        raise HTTPException(400, "Invalid amount")
    if user.get("balance", {}).get("dl", 0) < req.amount:
        raise HTTPException(400, "Insufficient DL balance")

    recipient = await db.users.find_one({"username": req.to_username.upper()}, {"_id": 0})
    if not recipient:
        # auto-create ghost recipient
        recipient = make_default_user(req.to_username)
        await db.users.insert_one(recipient)

    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance.dl": -req.amount}})
    await db.users.update_one({"id": recipient["id"]}, {"$inc": {"balance.dl": req.amount}})

    tip_doc = {
        "id": str(uuid.uuid4()),
        "from_user_id": user["id"],
        "from_username": user["username"],
        "to_username": req.to_username.upper(),
        "amount": req.amount,
        "message": req.message,
        "created_at": now_iso(),
    }
    await db.tips.insert_one(tip_doc)
    tip_doc.pop("_id", None)
    return tip_doc


# ---- Games ----
@api.post("/games/bet")
async def place_bet(req: BetReq, user=Depends(get_current_user)):
    if req.bet <= 0:
        raise HTTPException(400, "Invalid bet")
    if user.get("balance", {}).get("dl", 0) < req.bet:
        raise HTTPException(400, "Insufficient balance")

    # Deduct bet
    await db.users.update_one({"id": user["id"]}, {"$inc": {"balance.dl": -req.bet}})
    net = 0.0
    if req.won:
        # payout is total return (bet * multiplier). Credit that.
        credit = round(req.payout, 4)
        await db.users.update_one({"id": user["id"]}, {"$inc": {"balance.dl": credit}})
        net = credit - req.bet

    # award XP for VIP progress
    xp_gain = int(req.bet * 10)
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    vip = u.get("vip", {})
    xp = vip.get("xp", 0) + xp_gain
    xp_to = vip.get("xp_to_next", 1000)
    while xp >= xp_to:
        xp -= xp_to
        vip = level_up(vip)
        xp_to = vip.get("xp_to_next", 1000)
    vip["xp"] = xp
    vip["progress"] = int((xp / xp_to) * 100) if xp_to else 0
    await db.users.update_one({"id": user["id"]}, {"$set": {"vip": vip}})

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user["username"],
        "game": req.game,
        "bet": req.bet,
        "payout": req.payout if req.won else 0,
        "net": net if req.won else -req.bet,
        "won": req.won,
        "multiplier": req.multiplier,
        "meta": req.meta,
        "created_at": now_iso(),
    }
    await db.game_bets.insert_one(doc)
    doc.pop("_id", None)
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"bet": doc, "balance": updated["balance"], "vip": updated["vip"]}


LEVELS = [
    ("Bronze", 3),
    ("Silver", 4),
    ("Gold", 4),
    ("Platinum", 4),
    ("Diamond", 5),
]


def level_up(vip):
    cur = vip.get("level", "Bronze 1")
    tier, num = cur.rsplit(" ", 1)
    num = int(num)
    for i, (name, cap) in enumerate(LEVELS):
        if name == tier:
            if num < cap:
                new_level = f"{name} {num + 1}"
            elif i < len(LEVELS) - 1:
                new_level = f"{LEVELS[i + 1][0]} 1"
            else:
                new_level = cur  # max level
            break
    else:
        new_level = "Bronze 2"
    # next level
    ntier, nnum = new_level.rsplit(" ", 1)
    nnum = int(nnum)
    for i, (name, cap) in enumerate(LEVELS):
        if name == ntier:
            if nnum < cap:
                next_lvl = f"{name} {nnum + 1}"
            elif i < len(LEVELS) - 1:
                next_lvl = f"{LEVELS[i + 1][0]} 1"
            else:
                next_lvl = new_level
            break
    else:
        next_lvl = new_level
    return {
        "level": new_level,
        "next_level": next_lvl,
        "progress": 0,
        "xp": 0,
        "xp_to_next": (vip.get("xp_to_next", 1000) or 1000) + 1000,
    }


@api.get("/games/history")
async def game_history(user=Depends(get_current_user)):
    items = await db.game_bets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


# ---- Cases ----
@api.get("/cases")
async def list_cases(active_only: bool = True):
    query = {"is_active": True} if active_only else {}
    items = await db.cases.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/cases/{case_id}")
async def get_case(case_id: str):
    case_doc = await db.cases.find_one({"id": case_id}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found")
    return case_doc


@api.get("/cases/me/opens")
async def my_case_opens(user=Depends(get_current_user)):
    items = await db.case_opens.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@api.post("/cases/{case_id}/open")
async def open_case(case_id: str, user=Depends(get_current_user)):
    return await open_case_service(case_id, user["id"], {"source": "solo_case_open"})


@api.post("/admin/cases")
async def create_case(req: CaseUpsertReq, _=Depends(require_admin)):
    if req.price_dl <= 0:
        raise HTTPException(400, "price_dl must be > 0")
    items = normalize_case_items(req.items)
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "image": req.image,
        "price_dl": round(req.price_dl, 4),
        "is_active": req.is_active,
        "items": items,
        "created_at": now,
        "updated_at": now,
    }
    await db.cases.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/cases/{case_id}")
async def update_case(case_id: str, req: CaseUpsertReq, _=Depends(require_admin)):
    await ensure_case_exists(case_id)
    if req.price_dl <= 0:
        raise HTTPException(400, "price_dl must be > 0")
    items = normalize_case_items(req.items)
    update_doc = {
        "name": req.name.strip(),
        "image": req.image,
        "price_dl": round(req.price_dl, 4),
        "is_active": req.is_active,
        "items": items,
        "updated_at": now_iso(),
    }
    await db.cases.update_one({"id": case_id}, {"$set": update_doc})
    updated = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated


# ---- Battles ----
@api.get("/battles")
async def list_battles(status: Optional[str] = None):
    query = {}
    if status:
        query["battle_status"] = status
    items = await db.battles.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api.post("/battles")
async def create_battle(req: BattleCreateReq, user=Depends(get_current_user)):
    if req.mode not in ("normal", "jackpot"):
        raise HTTPException(400, "Invalid mode")
    if not req.selected_cases:
        raise HTTPException(400, "selected_cases must contain at least one case")
    for case_id in req.selected_cases:
        await ensure_case_exists(case_id)
    now = now_iso()
    battle_doc = {
        "id": str(uuid.uuid4()),
        "players": [{"user_id": user["id"], "username": user["username"]}],
        "selected_cases": req.selected_cases,
        "current_round": 0,
        "battle_status": "waiting",
        "mode": req.mode,
        "round_results": [],
        "totals_by_player": {user["id"]: 0.0},
        "winner_user_id": None,
        "winner_meta": None,
        "created_by": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.battles.insert_one(battle_doc)
    battle_doc.pop("_id", None)

    log_doc = await create_battle_log(
        battle_doc["id"],
        "BattleCreated",
        {"players": battle_doc["players"], "selected_cases": battle_doc["selected_cases"], "mode": battle_doc["mode"]},
        actor_user_id=user["id"],
    )
    await battle_ws_broadcast(battle_doc["id"], {"type": log_doc["event_type"], "log": log_doc})
    return battle_doc


@api.get("/battles/{battle_id}")
async def get_battle(battle_id: str):
    battle_doc = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle_doc:
        raise HTTPException(404, "Battle not found")
    return battle_doc


@api.get("/battles/{battle_id}/logs")
async def get_battle_logs(battle_id: str):
    items = await db.battle_logs.find({"battle_id": battle_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return items


@api.post("/battles/{battle_id}/join")
async def join_battle(battle_id: str, user=Depends(get_current_user)):
    battle_doc = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle_doc:
        raise HTTPException(404, "Battle not found")
    if battle_doc["battle_status"] != "waiting":
        raise HTTPException(400, "Battle is not open for joining")

    players = battle_doc.get("players", [])
    if any(p["user_id"] == user["id"] for p in players):
        return battle_doc
    if len(players) >= 4:
        raise HTTPException(400, "Battle is full")

    players.append({"user_id": user["id"], "username": user["username"]})
    totals = dict(battle_doc.get("totals_by_player", {}))
    totals[user["id"]] = 0.0
    await db.battles.update_one(
        {"id": battle_id},
        {"$set": {"players": players, "totals_by_player": totals, "updated_at": now_iso()}},
    )
    updated = await db.battles.find_one({"id": battle_id}, {"_id": 0})

    log_doc = await create_battle_log(
        battle_id,
        "PlayerJoined",
        {"user_id": user["id"], "username": user["username"], "player_count": len(players)},
        actor_user_id=user["id"],
    )
    await battle_ws_broadcast(battle_id, {"type": log_doc["event_type"], "log": log_doc})
    return updated


@api.post("/battles/{battle_id}/start")
async def start_battle(battle_id: str, user=Depends(get_current_user)):
    battle_doc = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle_doc:
        raise HTTPException(404, "Battle not found")
    if battle_doc["battle_status"] != "waiting":
        raise HTTPException(400, "Battle already started")
    if not any(p["user_id"] == user["id"] for p in battle_doc.get("players", [])):
        raise HTTPException(403, "Only participants can start this battle")
    if len(battle_doc.get("players", [])) < 2:
        raise HTTPException(400, "Need at least 2 players to start")

    await db.battles.update_one(
        {"id": battle_id},
        {"$set": {"battle_status": "active", "updated_at": now_iso()}},
    )
    updated = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    log_doc = await create_battle_log(
        battle_id,
        "BattleStarted",
        {"player_count": len(updated.get("players", []))},
        actor_user_id=user["id"],
    )
    await battle_ws_broadcast(battle_id, {"type": log_doc["event_type"], "log": log_doc})
    return updated


@api.post("/battles/{battle_id}/rounds/next")
async def play_next_round(battle_id: str, user=Depends(get_current_user)):
    battle_doc = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle_doc:
        raise HTTPException(404, "Battle not found")
    if battle_doc["battle_status"] != "active":
        raise HTTPException(400, "Battle is not active")
    if not any(p["user_id"] == user["id"] for p in battle_doc.get("players", [])):
        raise HTTPException(403, "Only participants can progress rounds")

    current_round = int(battle_doc.get("current_round", 0))
    selected_cases = battle_doc.get("selected_cases", [])
    if current_round >= len(selected_cases):
        raise HTTPException(400, "No rounds remaining")

    round_case_id = selected_cases[current_round]
    round_results = []
    for player in battle_doc.get("players", []):
        open_result = await open_case_service(
            round_case_id,
            player["user_id"],
            {
                "source": "battle",
                "battle_id": battle_id,
                "round": current_round + 1,
                "mode": battle_doc.get("mode"),
            },
        )
        opened = open_result["open"]
        round_results.append(
            {
                "user_id": player["user_id"],
                "username": player["username"],
                "item_id": opened["item"]["id"],
                "item_name": opened["item"]["name"],
                "item_value": opened["item"]["value"],
                "open_id": opened["id"],
            }
        )

    battle_doc.setdefault("round_results", []).append(
        {
            "round": current_round + 1,
            "case_id": round_case_id,
            "results": round_results,
            "created_at": now_iso(),
        }
    )
    battle_doc["current_round"] = current_round + 1
    battle_doc["totals_by_player"] = recompute_totals(battle_doc)

    round_log = await create_battle_log(
        battle_id,
        "RoundResult",
        {"round": current_round + 1, "case_id": round_case_id, "results": round_results, "totals": battle_doc["totals_by_player"]},
        actor_user_id=user["id"],
        round_number=current_round + 1,
    )
    await battle_ws_broadcast(battle_id, {"type": round_log["event_type"], "log": round_log})

    if battle_doc["current_round"] >= len(selected_cases):
        players = battle_doc.get("players", [])
        totals = battle_doc.get("totals_by_player", {})
        if battle_doc.get("mode") == "jackpot":
            weighted_values = [max(int(round(float(totals.get(p["user_id"], 0)) * 100)), 0) for p in players]
            winner_index = choose_weighted_player(weighted_values)
            winner = players[winner_index]
            battle_doc["winner_meta"] = {
                "mode": "jackpot",
                "weights": {p["user_id"]: weighted_values[idx] for idx, p in enumerate(players)},
            }
        else:
            winner = max(players, key=lambda p: (float(totals.get(p["user_id"], 0)), -players.index(p)))
            battle_doc["winner_meta"] = {
                "mode": "normal",
                "totals": totals,
                "tie_breaker": "earliest_join",
            }
        battle_doc["winner_user_id"] = winner["user_id"]
        battle_doc["battle_status"] = "finished"
        winner_log = await create_battle_log(
            battle_id,
            "BattleWinner",
            {
                "winner_user_id": winner["user_id"],
                "winner_username": winner["username"],
                "mode": battle_doc.get("mode"),
                "totals": totals,
            },
            round_number=battle_doc["current_round"],
        )
        await battle_ws_broadcast(battle_id, {"type": winner_log["event_type"], "log": winner_log})

    battle_doc["updated_at"] = now_iso()
    await db.battles.update_one(
        {"id": battle_id},
        {
            "$set": {
                "current_round": battle_doc["current_round"],
                "round_results": battle_doc["round_results"],
                "totals_by_player": battle_doc["totals_by_player"],
                "battle_status": battle_doc["battle_status"],
                "winner_user_id": battle_doc.get("winner_user_id"),
                "winner_meta": battle_doc.get("winner_meta"),
                "updated_at": battle_doc["updated_at"],
            }
        },
    )
    updated = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    return updated


# ---- Admin ----
@api.get("/admin/deposits")
async def admin_deposits(status: Optional[str] = None, _=Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    items = await db.deposits.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/admin/deposits/{deposit_id}/decide")
async def decide_deposit(deposit_id: str, req: ApproveReq, admin=Depends(require_admin)):
    dep = await db.deposits.find_one({"id": deposit_id}, {"_id": 0})
    if not dep:
        raise HTTPException(404, "Deposit not found")
    if dep["status"] != "pending":
        raise HTTPException(400, "Already decided")
    if req.status not in ("approved", "rejected"):
        raise HTTPException(400, "Invalid status")

    await db.deposits.update_one(
        {"id": deposit_id},
        {"$set": {
            "status": req.status,
            "approved_at": now_iso(),
            "admin_note": req.admin_note,
            "decided_by": admin["username"],
        }},
    )
    if req.status == "approved":
        await credit_user(dep["user_id"], dl=dep["dl_credit"])
    return {"ok": True}


@api.get("/admin/withdraws")
async def admin_withdraws(_=Depends(require_admin)):
    items = await db.withdraws.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/admin/withdraws/{wid}/decide")
async def decide_withdraw(wid: str, req: ApproveReq, _=Depends(require_admin)):
    wd = await db.withdraws.find_one({"id": wid}, {"_id": 0})
    if not wd:
        raise HTTPException(404, "Withdraw not found")
    if wd["status"] != "pending":
        raise HTTPException(400, "Already decided")
    if req.status not in ("approved", "rejected"):
        raise HTTPException(400, "Invalid status")

    await db.withdraws.update_one(
        {"id": wid},
        {"$set": {"status": req.status, "approved_at": now_iso(), "admin_note": req.admin_note}},
    )
    if req.status == "rejected":
        # refund the deducted balance
        field = "balance.dl" if wd["currency"] == "DL" else "balance.bgl"
        await db.users.update_one({"id": wd["user_id"]}, {"$inc": {field: wd["amount"]}})
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    users = await db.users.count_documents({})
    pending_dep = await db.deposits.count_documents({"status": "pending"})
    pending_wd = await db.withdraws.count_documents({"status": "pending"})
    total_bets = await db.game_bets.count_documents({})
    return {
        "users": users,
        "pending_deposits": pending_dep,
        "pending_withdraws": pending_wd,
        "total_bets": total_bets,
    }


# ---- Chat ----
@api.get("/chat/messages")
async def chat_messages():
    items = await db.chat.find({}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return list(reversed(items))


class ChatMsg(BaseModel):
    message: str


@api.post("/chat/messages")
async def send_chat(req: ChatMsg, user=Depends(get_current_user)):
    if not req.message.strip():
        raise HTTPException(400, "Empty message")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "username": user["username"],
        "avatar": user.get("avatar"),
        "level": user.get("vip", {}).get("level", "Bronze 1"),
        "message": req.message.strip()[:200],
        "created_at": now_iso(),
    }
    await db.chat.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---- Health ----
@api.get("/")
async def root():
    return {"message": "BetDice API", "status": "ok"}


@app.websocket("/ws/battles/{battle_id}")
async def battle_ws(websocket: WebSocket, battle_id: str):
    await battle_ws_connect(battle_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        battle_ws_disconnect(battle_id, websocket)
    except Exception:
        battle_ws_disconnect(battle_id, websocket)


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_indexes():
    await db.battle_logs.create_index([("battle_id", 1), ("created_at", 1)])
    await db.battles.create_index([("battle_status", 1), ("created_at", -1)])


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", "8080"))
    except ValueError:
        port = 8080
    uvicorn.run(app, host="0.0.0.0", port=port)
