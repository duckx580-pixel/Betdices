import pytest

from backend.case_battle_utils import build_battle_snapshot, probability_to_points
from backend.growtopia_import import parse_growtopia_import_file


def test_parse_growtopia_import_json_with_rejections():
    raw = b"""
    [
      {"id":"diamond-lock","name":"Diamond Lock","market_value_bgl":1,"icon_url":"https://example.com/dl.png"},
      {"id":"diamond-lock","name":"Diamond Lock 2","market_value_bgl":2,"icon_url":"https://example.com/dl2.png"},
      {"id":"","name":"","market_value_bgl":"abc","icon_url":"bad-url"}
    ]
    """
    parsed = parse_growtopia_import_file("items.json", raw)
    assert parsed["total_rows"] == 3
    assert len(parsed["items"]) == 1
    assert len(parsed["rejected"]) == 2


def test_parse_growtopia_import_csv_success():
    raw = (
        "id,name,market_value_bgl,icon_url\n"
        "rayman-fist,Rayman's Fist,355,https://example.com/rayman.png\n"
        "ghc,Golden Heart Crystal,280,https://example.com/ghc.png\n"
    ).encode("utf-8")
    parsed = parse_growtopia_import_file("items.csv", raw)
    assert parsed["total_rows"] == 2
    assert len(parsed["items"]) == 2
    assert parsed["rejected"] == []


def test_probability_to_points_constraints():
    assert probability_to_points(12.3456) == 123456
    with pytest.raises(Exception):
        probability_to_points(0)


def test_build_battle_snapshot_contains_bot_and_totals():
    doc = {
        "id": "battle-1",
        "players": [{"user_id": "bot-1", "username": "BOT", "is_bot": True}],
        "selected_cases": ["case-a"],
        "current_round": 1,
        "battle_status": "active",
        "mode": "normal",
        "player_slots": 2,
        "add_bots": True,
        "bot_count": 1,
        "round_results": [],
        "totals_by_player": {"bot-1": 5.5},
    }
    snapshot = build_battle_snapshot(doc)
    assert snapshot["players"][0]["is_bot"] is True
    assert snapshot["totals_by_player"]["bot-1"] == 5.5
