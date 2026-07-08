import secrets
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from fastapi import HTTPException


def probability_to_points(probability_percentage: float) -> int:
    try:
        value = Decimal(str(probability_percentage))
    except (InvalidOperation, TypeError):
        raise HTTPException(400, "Invalid probability value")
    if value <= 0:
        raise HTTPException(400, "Probability must be > 0")
    points = (value * Decimal("10000")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(points)


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


def build_battle_snapshot(battle_doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not battle_doc:
        return None
    return {
        "id": battle_doc.get("id"),
        "players": battle_doc.get("players", []),
        "selected_cases": battle_doc.get("selected_cases", []),
        "current_round": battle_doc.get("current_round", 0),
        "battle_status": battle_doc.get("battle_status"),
        "mode": battle_doc.get("mode"),
        "player_slots": battle_doc.get("player_slots", 2),
        "add_bots": battle_doc.get("add_bots", False),
        "bot_count": battle_doc.get("bot_count", 0),
        "round_results": battle_doc.get("round_results", []),
        "totals_by_player": battle_doc.get("totals_by_player", {}),
        "winner_user_id": battle_doc.get("winner_user_id"),
        "winner_meta": battle_doc.get("winner_meta"),
        "updated_at": battle_doc.get("updated_at"),
    }
