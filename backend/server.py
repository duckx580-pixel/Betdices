from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import jwt
import uvicorn
import asyncio
import random
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from decimal import Decimal
from pymongo import UpdateOne
try:
    from backend.growtopia_import import parse_growtopia_import_file, load_default_growtopia_items
    from backend.case_battle_utils import probability_to_points, choose_weighted_player, build_battle_snapshot
except ModuleNotFoundError as exc:
    if exc.name != "backend":
        raise
    from growtopia_import import parse_growtopia_import_file, load_default_growtopia_items
    from case_battle_utils import probability_to_points, choose_weighted_player, build_battle_snapshot


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
    growtopia_item_id: str
    probability_percentage: float


class CaseUpsertReq(BaseModel):
    name: str
    image: Optional[str] = None
    price_bgl: float
    is_active: bool = True
    popularity_score: float = 0.0
    items: List[CaseItemIn]


class BattleCreateReq(BaseModel):
    selected_cases: List[str]
    mode: str = "normal"  # normal | jackpot
    player_slots: int = 2
    add_bots: bool = False
    bot_count: int = 0


class CaseStatusReq(BaseModel):
    is_active: bool


battle_connections: Dict[str, Set[WebSocket]] = {}
GROWTOPIA_SEED_PATH = ROOT_DIR / "data" / "growtopia_items_seed.json"

BOT_NAME_POOL = [
    "VoidRusher",
    "NeonPixel",
    "LuckyGnome",
    "ShadowBrick",
    "BoltFarmer",
    "NightClover",
    "AstraWrench",
    "FrostCrate",
]


async def normalize_case_items(items: List[CaseItemIn]) -> List[Dict[str, Any]]:
    if not items:
        raise HTTPException(400, "Case must contain at least one item")
    growtopia_item_ids = [item.growtopia_item_id for item in items]
    if len(set(growtopia_item_ids)) != len(growtopia_item_ids):
        raise HTTPException(400, "Duplicate Growtopia items are not allowed in one case")
    growtopia_items = await db.growtopia_items.find(
        {"id": {"$in": growtopia_item_ids}},
        {"_id": 0},
    ).to_list(len(growtopia_item_ids))
    growtopia_map = {item["id"]: item for item in growtopia_items}
    missing_ids = [item_id for item_id in growtopia_item_ids if item_id not in growtopia_map]
    if missing_ids:
        raise HTTPException(400, f"Unknown Growtopia item ids: {', '.join(missing_ids)}")

    normalized = []
    total_points = 0
    for item in items:
        gt_item = growtopia_map[item.growtopia_item_id]
        points = probability_to_points(item.probability_percentage)
        total_points += points
        normalized.append(
            {
                "id": str(uuid.uuid4()),
                "growtopia_item_id": gt_item["id"],
                "name": gt_item["name"],
                "icon_url": gt_item.get("icon_url"),
                "market_value_bgl": round(float(gt_item.get("market_value_bgl", 0)), 4),
                "probability_percentage": float((Decimal(points) / Decimal("10000")).quantize(Decimal("0.0001"))),
                "probability_points": points,
            }
        )
    if total_points != 1000000:
        raise HTTPException(400, "Total probability_percentage must equal exactly 100.0000")
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


async def broadcast_battle_log_event(battle_id: str, log_doc: Dict[str, Any], battle_doc: Optional[Dict[str, Any]] = None):
    battle_snapshot = build_battle_snapshot(battle_doc)
    if battle_snapshot is None:
        existing = await db.battles.find_one({"id": battle_id}, {"_id": 0})
        battle_snapshot = build_battle_snapshot(existing)
    await battle_ws_broadcast(
        battle_id,
        {
            "type": "BattleEvent",
            "event_type": log_doc["event_type"],
            "log": log_doc,
            "battle": battle_snapshot,
        },
    )


def make_bot_player_profile() -> Dict[str, Any]:
    alias = random.choice(BOT_NAME_POOL)
    suffix = f"{random.randint(1000, 9999)}"
    username = f"{alias}_{suffix}"
    return {
        "id": f"bot-{uuid.uuid4()}",
        "username": username,
        "avatar": f"https://i.pravatar.cc/120?u={username}",
    }


async def ensure_bot_user() -> Dict[str, Any]:
    profile = make_bot_player_profile()
    doc = {
        "id": profile["id"],
        "grow_id": profile["username"].upper(),
        "username": profile["username"],
        "avatar": profile["avatar"],
        "balance": {"dl": 10000.0, "bgl": 10000.0, "wl": 0.0},
        "vip": {
            "level": "Diamond 1",
            "next_level": "Diamond 2",
            "progress": 30,
            "xp": 3000,
            "xp_to_next": 10000,
        },
        "is_admin": False,
        "is_bot": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def fill_battle_with_bots(battle_id: str):
    battle_doc = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle_doc or battle_doc.get("battle_status") != "waiting":
        return
    if not battle_doc.get("add_bots"):
        return

    players = list(battle_doc.get("players", []))
    player_slots = int(battle_doc.get("player_slots", 2))
    configured_bot_count = int(battle_doc.get("bot_count", 0))
    open_slots = max(player_slots - len(players), 0)
    bots_to_add = min(open_slots, configured_bot_count)
    if bots_to_add <= 0:
        return

    totals = dict(battle_doc.get("totals_by_player", {}))
    created_logs: List[Dict[str, Any]] = []
    for _ in range(bots_to_add):
        bot_user = await ensure_bot_user()
        player_data = {
            "user_id": bot_user["id"],
            "username": bot_user["username"],
            "avatar": bot_user.get("avatar"),
            "is_bot": True,
        }
        players.append(player_data)
        totals[bot_user["id"]] = 0.0
        log_doc = await create_battle_log(
            battle_id,
            "PlayerJoined",
            {
                "user_id": bot_user["id"],
                "username": bot_user["username"],
                "player_count": len(players),
                "is_bot": True,
            },
            actor_user_id=bot_user["id"],
        )
        created_logs.append(log_doc)

    await db.battles.update_one(
        {"id": battle_id},
        {"$set": {"players": players, "totals_by_player": totals, "updated_at": now_iso()}},
    )
    updated_battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    for log_doc in created_logs:
        await broadcast_battle_log_event(battle_id, log_doc, updated_battle)


async def schedule_battle_bot_fill(battle_id: str, delay_seconds: int = 5):
    await asyncio.sleep(delay_seconds)
    try:
        await fill_battle_with_bots(battle_id)
    except Exception:
        logger.exception("Failed to auto-fill battle with bots")


async def open_case_service(case_id: str, user_id: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    case_doc = await db.cases.find_one({"id": case_id, "is_active": True}, {"_id": 0})
    if not case_doc:
        raise HTTPException(404, "Case not found or inactive")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")

    price_bgl = case_doc.get("price_bgl")
    using_bgl = price_bgl is not None
    if using_bgl:
        price = round(float(price_bgl), 4)
        user_balance = float(user.get("balance", {}).get("bgl", 0))
        if user_balance < price:
            raise HTTPException(400, "Insufficient BGL balance")
    else:
        price = round(float(case_doc.get("price_dl", 0)), 4)
        user_balance = float(user.get("balance", {}).get("dl", 0))
        if user_balance < price:
            raise HTTPException(400, "Insufficient DL balance")

    items = case_doc.get("items", [])
    if not items:
        raise HTTPException(400, "Case has no prizes")
    weights = [int(i.get("probability_points", i.get("probability_basis", 0))) for i in items]
    valid_total = 1000000 if any(i.get("probability_points") is not None for i in items) else 10000
    if not all(w > 0 for w in weights) or sum(weights) != valid_total:
        raise HTTPException(400, "Case probability configuration is invalid")

    chosen_index = choose_weighted_player(weights)
    selected_item = items[chosen_index]
    selected_value = round(float(selected_item.get("market_value_bgl", selected_item.get("value", 0))), 4)
    net = round(selected_value - price, 4)

    balance_field = "balance.bgl" if using_bgl else "balance.dl"
    await db.users.update_one({"id": user_id}, {"$inc": {balance_field: net}})
    await db.cases.update_one({"id": case_id}, {"$inc": {"opens_count": 1}})
    updated_user = await db.users.find_one({"id": user_id}, {"_id": 0})

    open_doc = {
        "id": str(uuid.uuid4()),
        "case_id": case_doc["id"],
        "case_name": case_doc["name"],
        "case_price_bgl": price if using_bgl else None,
        "case_price_dl": None if using_bgl else price,
        "user_id": user["id"],
        "username": user.get("username"),
        "item": {
            "id": selected_item["id"],
            "growtopia_item_id": selected_item.get("growtopia_item_id"),
            "name": selected_item["name"],
            "icon_url": selected_item.get("icon_url"),
            "market_value_bgl": selected_value,
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
@api.get("/growtopia-items")
async def list_growtopia_items(
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    query: Dict[str, Any] = {}
    if q and q.strip():
        query["name"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    total = await db.growtopia_items.count_documents(query)
    items = await db.growtopia_items.find(query, {"_id": 0}).sort("name", 1).skip(offset).limit(limit).to_list(limit)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


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
    if req.price_bgl <= 0 or req.price_bgl > 400:
        raise HTTPException(400, "price_bgl must be > 0 and <= 400")
    if not req.name.strip():
        raise HTTPException(400, "Case name is required")
    items = await normalize_case_items(req.items)
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "image": req.image,
        "price_bgl": round(req.price_bgl, 4),
        "popularity_score": round(float(req.popularity_score or 0), 4),
        "opens_count": 0,
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
    if req.price_bgl <= 0 or req.price_bgl > 400:
        raise HTTPException(400, "price_bgl must be > 0 and <= 400")
    if not req.name.strip():
        raise HTTPException(400, "Case name is required")
    items = await normalize_case_items(req.items)
    update_doc = {
        "name": req.name.strip(),
        "image": req.image,
        "price_bgl": round(req.price_bgl, 4),
        "popularity_score": round(float(req.popularity_score or 0), 4),
        "is_active": req.is_active,
        "items": items,
        "updated_at": now_iso(),
    }
    await db.cases.update_one({"id": case_id}, {"$set": update_doc})
    updated = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated


@api.patch("/admin/cases/{case_id}/status")
async def set_case_status(case_id: str, req: CaseStatusReq, _=Depends(require_admin)):
    await ensure_case_exists(case_id)
    await db.cases.update_one(
        {"id": case_id},
        {"$set": {"is_active": bool(req.is_active), "updated_at": now_iso()}},
    )
    updated = await db.cases.find_one({"id": case_id}, {"_id": 0})
    return updated


@api.get("/admin/growtopia-items")
async def list_admin_growtopia_items(
    q: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    _=Depends(require_admin),
):
    return await list_growtopia_items(q=q, limit=limit, offset=offset)


@api.post("/admin/growtopia-items/import")
async def import_admin_growtopia_items(file: UploadFile = File(...), _=Depends(require_admin)):
    filename = file.filename or ""
    content = await file.read()
    parsed = parse_growtopia_import_file(filename, content)
    items: List[Dict[str, Any]] = parsed["items"]
    rejected: List[Dict[str, Any]] = parsed["rejected"]

    existing_ids = []
    if items:
        existing_docs = await db.growtopia_items.find({"id": {"$in": [item["id"] for item in items]}}, {"_id": 0, "id": 1}).to_list(len(items))
        existing_ids = [doc["id"] for doc in existing_docs]

    now = now_iso()
    operations = [
        UpdateOne(
            {"id": item["id"]},
            {
                "$set": {
                    "id": item["id"],
                    "name": item["name"],
                    "market_value_bgl": item["market_value_bgl"],
                    "icon_url": item["icon_url"],
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        for item in items
    ]
    if operations:
        await db.growtopia_items.bulk_write(operations, ordered=False)

    return {
        "total_rows": parsed["total_rows"],
        "imported_count": len(items),
        "created_count": len([item for item in items if item["id"] not in existing_ids]),
        "updated_count": len([item for item in items if item["id"] in existing_ids]),
        "rejected_count": len(rejected),
        "rejected": rejected[:200],
    }


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
    if req.player_slots < 2 or req.player_slots > 4:
        raise HTTPException(400, "player_slots must be between 2 and 4")
    if req.add_bots and (req.bot_count < 1 or req.bot_count > 6):
        raise HTTPException(400, "bot_count must be between 1 and 6")
    if not req.add_bots and req.bot_count != 0:
        raise HTTPException(400, "bot_count must be 0 when add_bots is false")
    max_bot_slots = req.player_slots - 1
    if req.add_bots and req.bot_count > max_bot_slots:
        raise HTTPException(400, f"bot_count cannot exceed available slots ({max_bot_slots})")
    if not req.selected_cases:
        raise HTTPException(400, "selected_cases must contain at least one case")
    for case_id in req.selected_cases:
        await ensure_case_exists(case_id)
    now = now_iso()
    battle_doc = {
        "id": str(uuid.uuid4()),
        "players": [{"user_id": user["id"], "username": user["username"], "avatar": user.get("avatar"), "is_bot": False}],
        "selected_cases": req.selected_cases,
        "current_round": 0,
        "battle_status": "waiting",
        "mode": req.mode,
        "player_slots": req.player_slots,
        "add_bots": req.add_bots,
        "bot_count": req.bot_count,
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
        {
            "players": battle_doc["players"],
            "selected_cases": battle_doc["selected_cases"],
            "mode": battle_doc["mode"],
            "player_slots": battle_doc["player_slots"],
            "add_bots": battle_doc["add_bots"],
            "bot_count": battle_doc["bot_count"],
        },
        actor_user_id=user["id"],
    )
    await broadcast_battle_log_event(battle_doc["id"], log_doc, battle_doc)
    if req.add_bots and req.bot_count > 0:
        asyncio.create_task(schedule_battle_bot_fill(battle_doc["id"], 5))
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
    max_players = int(battle_doc.get("player_slots", 4))
    if len(players) >= max_players:
        raise HTTPException(400, "Battle is full")

    players.append({"user_id": user["id"], "username": user["username"], "avatar": user.get("avatar"), "is_bot": False})
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
        {"user_id": user["id"], "username": user["username"], "player_count": len(players), "is_bot": False},
        actor_user_id=user["id"],
    )
    await broadcast_battle_log_event(battle_id, log_doc, updated)
    if updated.get("add_bots") and int(updated.get("bot_count", 0)) > 0 and updated.get("battle_status") == "waiting":
        asyncio.create_task(schedule_battle_bot_fill(battle_id, 2))
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
    player_slots = int(battle_doc.get("player_slots", 2))
    if len(battle_doc.get("players", [])) < max(2, player_slots):
        raise HTTPException(400, "Battle must be full before it can start")

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
    await broadcast_battle_log_event(battle_id, log_doc, updated)
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
                "avatar": player.get("avatar"),
                "is_bot": bool(player.get("is_bot")),
                "item_id": opened["item"]["id"],
                "item_name": opened["item"]["name"],
                "item_icon_url": opened["item"].get("icon_url"),
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
    await broadcast_battle_log_event(battle_id, round_log, battle_doc)

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
                "winner_is_bot": bool(winner.get("is_bot")),
                "mode": battle_doc.get("mode"),
                "totals": totals,
            },
            round_number=battle_doc["current_round"],
        )
        await broadcast_battle_log_event(battle_id, winner_log, battle_doc)

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
SEED_BATCH_SIZE = 1000
growtopia_seed_task: Optional[asyncio.Task] = None


async def seed_growtopia_items():
    try:
        seed_items = load_default_growtopia_items(GROWTOPIA_SEED_PATH, logger)
        if not seed_items:
            return
        now = now_iso()
        operations: List[UpdateOne] = []
        total_upserted = 0
        for seed_item in seed_items:
            operations.append(
                UpdateOne(
                    {"id": seed_item["id"]},
                    {
                        "$set": {
                            "id": seed_item["id"],
                            "name": seed_item["name"],
                            "icon_url": seed_item["icon_url"],
                            "market_value_bgl": round(float(seed_item["market_value_bgl"]), 4),
                            "updated_at": now,
                        },
                        "$setOnInsert": {"created_at": now},
                    },
                    upsert=True,
                )
            )
            if len(operations) >= SEED_BATCH_SIZE:
                await db.growtopia_items.bulk_write(operations, ordered=False)
                total_upserted += len(operations)
                operations.clear()
        if operations:
            await db.growtopia_items.bulk_write(operations, ordered=False)
            total_upserted += len(operations)
        logger.info("Growtopia seed upsert finished in background: %s items", total_upserted)
    except Exception:
        logger.exception("Growtopia seed upsert failed")


@app.on_event("startup")
async def startup_indexes():
    global growtopia_seed_task
    await db.battle_logs.create_index([("battle_id", 1), ("created_at", 1)])
    await db.battles.create_index([("battle_status", 1), ("created_at", -1)])
    await db.growtopia_items.create_index([("id", 1)], unique=True)
    await db.growtopia_items.create_index([("name", 1)])
    await db.cases.create_index([("is_active", 1), ("created_at", -1)])
    if growtopia_seed_task is None or growtopia_seed_task.done():
        growtopia_seed_task = asyncio.create_task(seed_growtopia_items())
        logger.info("Scheduled background Growtopia seed upsert")


@app.on_event("shutdown")
async def shutdown_db_client():
    global growtopia_seed_task
    if growtopia_seed_task and not growtopia_seed_task.done():
        growtopia_seed_task.cancel()
        try:
            await growtopia_seed_task
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Error while stopping Growtopia seed task")
    client.close()


if __name__ == "__main__":
    try:
        port = int(os.environ.get("PORT", "8080"))
    except ValueError:
        port = 8080
    uvicorn.run(app, host="0.0.0.0", port=port)
