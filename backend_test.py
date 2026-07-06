#!/usr/bin/env python3
"""
Comprehensive backend API test for BetDice platform.
Tests all endpoints in the order specified in the review request.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://play-vault-beta-1.preview.emergentagent.com/api"

# Admin credentials
ADMIN_GROW_ID = "HAYABUSAN"
ADMIN_PASSWORD = "hongprokh123"

# Test state
test_results = []
tokens = {}
users = {}
deposits = []
withdraws = []


class TestResult:
    def __init__(self, name: str, passed: bool, message: str = "", details: Any = None):
        self.name = name
        self.passed = passed
        self.message = message
        self.details = details


def log_test(name: str, passed: bool, message: str = "", details: Any = None):
    """Log a test result."""
    result = TestResult(name, passed, message, details)
    test_results.append(result)
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if message:
        print(f"  → {message}")
    if details and not passed:
        print(f"  → Details: {details}")


def make_request(method: str, endpoint: str, token: Optional[str] = None, 
                 json_data: Optional[Dict] = None, params: Optional[Dict] = None) -> requests.Response:
    """Make HTTP request with optional auth."""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=10)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        return resp
    except Exception as e:
        print(f"Request failed: {e}")
        raise


def test_auth():
    """Test 1: Authentication endpoints."""
    print("\n=== TEST 1: Authentication ===")
    
    # 1.1: Login with random new GrowID (non-admin)
    test_user = "TESTUSER01"
    resp = make_request("POST", "/auth/login", json_data={"grow_id": test_user})
    
    if resp.status_code == 200:
        data = resp.json()
        if "token" in data and "user" in data:
            user = data["user"]
            if (user.get("is_admin") == False and 
                user.get("balance", {}).get("dl") == 0 and
                user.get("balance", {}).get("bgl") == 0 and
                user.get("balance", {}).get("wl") == 0):
                tokens[test_user] = data["token"]
                users[test_user] = user
                log_test("Auth: Regular user login", True, f"User {test_user} created with 0 balance")
            else:
                log_test("Auth: Regular user login", False, "User data incorrect", user)
        else:
            log_test("Auth: Regular user login", False, "Missing token or user in response", data)
    else:
        log_test("Auth: Regular user login", False, f"Status {resp.status_code}", resp.text)
    
    # 1.2: Login as admin without password → should fail
    resp = make_request("POST", "/auth/login", json_data={"grow_id": ADMIN_GROW_ID})
    if resp.status_code == 401:
        log_test("Auth: Admin login without password rejected", True, "Correctly returned 401")
    else:
        log_test("Auth: Admin login without password rejected", False, f"Expected 401, got {resp.status_code}", resp.text)
    
    # 1.3: Login as admin with wrong password → should fail
    resp = make_request("POST", "/auth/login", json_data={"grow_id": ADMIN_GROW_ID, "admin_password": "wrongpass"})
    if resp.status_code == 401:
        log_test("Auth: Admin login with wrong password rejected", True, "Correctly returned 401")
    else:
        log_test("Auth: Admin login with wrong password rejected", False, f"Expected 401, got {resp.status_code}", resp.text)
    
    # 1.4: Login as admin with correct password → should succeed
    resp = make_request("POST", "/auth/login", json_data={"grow_id": ADMIN_GROW_ID, "admin_password": ADMIN_PASSWORD})
    if resp.status_code == 200:
        data = resp.json()
        if "token" in data and "user" in data:
            user = data["user"]
            if user.get("is_admin") == True and user.get("balance", {}).get("dl", 0) >= 0:
                tokens[ADMIN_GROW_ID] = data["token"]
                users[ADMIN_GROW_ID] = user
                log_test("Auth: Admin login with correct password", True, f"Admin logged in, balance: {user['balance']['dl']} DL")
            else:
                log_test("Auth: Admin login with correct password", False, "Admin flag or balance incorrect", user)
        else:
            log_test("Auth: Admin login with correct password", False, "Missing token or user", data)
    else:
        log_test("Auth: Admin login with correct password", False, f"Status {resp.status_code}", resp.text)
    
    # 1.5: GET /api/auth/me with token
    if test_user in tokens:
        resp = make_request("GET", "/auth/me", token=tokens[test_user])
        if resp.status_code == 200:
            user = resp.json()
            if user.get("grow_id") == test_user:
                log_test("Auth: GET /auth/me", True, f"Returns correct user: {user['grow_id']}")
            else:
                log_test("Auth: GET /auth/me", False, "User mismatch", user)
        else:
            log_test("Auth: GET /auth/me", False, f"Status {resp.status_code}", resp.text)


def test_config():
    """Test 2: Config endpoint."""
    print("\n=== TEST 2: Config Endpoint ===")
    
    resp = make_request("GET", "/config")
    if resp.status_code == 200:
        config = resp.json()
        required_fields = ["qris_image_url", "dana_phone", "dana_name", "paypal_email", 
                          "rate_idr_per_dl", "rate_usd_per_dl"]
        missing = [f for f in required_fields if f not in config]
        if not missing:
            log_test("Config: GET /config", True, f"All fields present. IDR rate: {config['rate_idr_per_dl']}, USD rate: {config['rate_usd_per_dl']}")
        else:
            log_test("Config: GET /config", False, f"Missing fields: {missing}", config)
    else:
        log_test("Config: GET /config", False, f"Status {resp.status_code}", resp.text)


def test_deposits():
    """Test 3: Deposit creation."""
    print("\n=== TEST 3: Deposit Creation ===")
    
    test_user = "TESTUSER01"
    if test_user not in tokens:
        log_test("Deposits: Skipped", False, "Test user not logged in")
        return
    
    token = tokens[test_user]
    
    # 3.1: Growtopia method
    resp = make_request("POST", "/deposits", token=token, json_data={
        "method": "growtopia",
        "amount": 10,
        "currency": "DL"
    })
    if resp.status_code == 200:
        dep = resp.json()
        if dep.get("status") == "pending" and dep.get("dl_credit") == 10:
            deposits.append(dep)
            log_test("Deposits: Growtopia method", True, f"Created deposit with 10 DL credit, ID: {dep['id']}")
        else:
            log_test("Deposits: Growtopia method", False, "Status or dl_credit incorrect", dep)
    else:
        log_test("Deposits: Growtopia method", False, f"Status {resp.status_code}", resp.text)
    
    # 3.2: QRIS without proof → should fail
    resp = make_request("POST", "/deposits", token=token, json_data={
        "method": "qris",
        "amount": 50000,
        "currency": "IDR"
    })
    if resp.status_code == 400:
        log_test("Deposits: QRIS without proof rejected", True, "Correctly returned 400")
    else:
        log_test("Deposits: QRIS without proof rejected", False, f"Expected 400, got {resp.status_code}", resp.text)
    
    # 3.3: QRIS with proof
    resp = make_request("POST", "/deposits", token=token, json_data={
        "method": "qris",
        "amount": 50000,
        "currency": "IDR",
        "proof_image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    })
    if resp.status_code == 200:
        dep = resp.json()
        expected_dl = 50000 / 10000  # 5 DL
        if dep.get("status") == "pending" and abs(dep.get("dl_credit", 0) - expected_dl) < 0.01:
            deposits.append(dep)
            log_test("Deposits: QRIS with proof", True, f"Created deposit with {dep['dl_credit']} DL credit")
        else:
            log_test("Deposits: QRIS with proof", False, f"Expected {expected_dl} DL credit", dep)
    else:
        log_test("Deposits: QRIS with proof", False, f"Status {resp.status_code}", resp.text)
    
    # 3.4: PayPal
    resp = make_request("POST", "/deposits", token=token, json_data={
        "method": "paypal",
        "amount": 6.5,
        "currency": "USD",
        "proof_image": "data:image/png;base64,AAA"
    })
    if resp.status_code == 200:
        dep = resp.json()
        expected_dl = 6.5 / 0.65  # 10 DL
        if dep.get("status") == "pending" and abs(dep.get("dl_credit", 0) - expected_dl) < 0.01:
            deposits.append(dep)
            log_test("Deposits: PayPal", True, f"Created deposit with {dep['dl_credit']} DL credit")
        else:
            log_test("Deposits: PayPal", False, f"Expected {expected_dl} DL credit", dep)
    else:
        log_test("Deposits: PayPal", False, f"Status {resp.status_code}", resp.text)
    
    # 3.5: DANA
    resp = make_request("POST", "/deposits", token=token, json_data={
        "method": "dana",
        "amount": 100000,
        "currency": "IDR",
        "proof_image": "data:image/png;base64,AAA"
    })
    if resp.status_code == 200:
        dep = resp.json()
        expected_dl = 100000 / 10000  # 10 DL
        if dep.get("status") == "pending" and abs(dep.get("dl_credit", 0) - expected_dl) < 0.01:
            deposits.append(dep)
            log_test("Deposits: DANA", True, f"Created deposit with {dep['dl_credit']} DL credit")
        else:
            log_test("Deposits: DANA", False, f"Expected {expected_dl} DL credit", dep)
    else:
        log_test("Deposits: DANA", False, f"Status {resp.status_code}", resp.text)


def test_my_deposits():
    """Test 4: List user deposits."""
    print("\n=== TEST 4: List User Deposits ===")
    
    test_user = "TESTUSER01"
    if test_user not in tokens:
        log_test("My Deposits: Skipped", False, "Test user not logged in")
        return
    
    resp = make_request("GET", "/deposits/me", token=tokens[test_user])
    if resp.status_code == 200:
        deps = resp.json()
        if len(deps) >= 4:
            log_test("My Deposits: GET /deposits/me", True, f"Found {len(deps)} deposits")
        else:
            log_test("My Deposits: GET /deposits/me", False, f"Expected at least 4 deposits, got {len(deps)}", deps)
    else:
        log_test("My Deposits: GET /deposits/me", False, f"Status {resp.status_code}", resp.text)


def test_admin_deposits():
    """Test 5: Admin deposit approval."""
    print("\n=== TEST 5: Admin Deposit Approval ===")
    
    if ADMIN_GROW_ID not in tokens:
        log_test("Admin Deposits: Skipped", False, "Admin not logged in")
        return
    
    admin_token = tokens[ADMIN_GROW_ID]
    test_user = "TESTUSER01"
    user_token = tokens.get(test_user)
    
    # 5.1: Admin GET deposits
    resp = make_request("GET", "/admin/deposits", token=admin_token)
    if resp.status_code == 200:
        deps = resp.json()
        log_test("Admin: GET /admin/deposits", True, f"Found {len(deps)} deposits")
    else:
        log_test("Admin: GET /admin/deposits", False, f"Status {resp.status_code}", resp.text)
        return
    
    # 5.2: Non-admin GET deposits → should fail
    if user_token:
        resp = make_request("GET", "/admin/deposits", token=user_token)
        if resp.status_code == 403:
            log_test("Admin: Non-admin access rejected", True, "Correctly returned 403")
        else:
            log_test("Admin: Non-admin access rejected", False, f"Expected 403, got {resp.status_code}", resp.text)
    
    # 5.3: Approve growtopia deposit (first one)
    if len(deposits) > 0:
        growtopia_dep = deposits[0]
        dep_id = growtopia_dep["id"]
        
        # Get user balance before
        resp = make_request("GET", "/auth/me", token=user_token)
        balance_before = resp.json().get("balance", {}).get("dl", 0) if resp.status_code == 200 else 0
        
        # Approve
        resp = make_request("POST", f"/admin/deposits/{dep_id}/decide", token=admin_token, json_data={
            "status": "approved"
        })
        if resp.status_code == 200:
            # Check balance increased
            resp = make_request("GET", "/auth/me", token=user_token)
            if resp.status_code == 200:
                balance_after = resp.json().get("balance", {}).get("dl", 0)
                expected_increase = growtopia_dep["dl_credit"]
                actual_increase = balance_after - balance_before
                if abs(actual_increase - expected_increase) < 0.01:
                    log_test("Admin: Approve growtopia deposit", True, f"Balance increased by {actual_increase} DL")
                else:
                    log_test("Admin: Approve growtopia deposit", False, f"Expected +{expected_increase} DL, got +{actual_increase} DL")
            else:
                log_test("Admin: Approve growtopia deposit", False, "Could not verify balance")
        else:
            log_test("Admin: Approve growtopia deposit", False, f"Status {resp.status_code}", resp.text)
    
    # 5.4: Approve QRIS deposit
    if len(deposits) > 1:
        qris_dep = deposits[1]
        dep_id = qris_dep["id"]
        
        resp = make_request("GET", "/auth/me", token=user_token)
        balance_before = resp.json().get("balance", {}).get("dl", 0) if resp.status_code == 200 else 0
        
        resp = make_request("POST", f"/admin/deposits/{dep_id}/decide", token=admin_token, json_data={
            "status": "approved"
        })
        if resp.status_code == 200:
            resp = make_request("GET", "/auth/me", token=user_token)
            if resp.status_code == 200:
                balance_after = resp.json().get("balance", {}).get("dl", 0)
                expected_increase = qris_dep["dl_credit"]
                actual_increase = balance_after - balance_before
                if abs(actual_increase - expected_increase) < 0.01:
                    log_test("Admin: Approve QRIS deposit", True, f"Balance increased by {actual_increase} DL")
                else:
                    log_test("Admin: Approve QRIS deposit", False, f"Expected +{expected_increase} DL, got +{actual_increase} DL")
        else:
            log_test("Admin: Approve QRIS deposit", False, f"Status {resp.status_code}", resp.text)
    
    # 5.5: Reject PayPal deposit (balance should NOT increase)
    if len(deposits) > 2:
        paypal_dep = deposits[2]
        dep_id = paypal_dep["id"]
        
        resp = make_request("GET", "/auth/me", token=user_token)
        balance_before = resp.json().get("balance", {}).get("dl", 0) if resp.status_code == 200 else 0
        
        resp = make_request("POST", f"/admin/deposits/{dep_id}/decide", token=admin_token, json_data={
            "status": "rejected"
        })
        if resp.status_code == 200:
            resp = make_request("GET", "/auth/me", token=user_token)
            if resp.status_code == 200:
                balance_after = resp.json().get("balance", {}).get("dl", 0)
                if balance_after == balance_before:
                    log_test("Admin: Reject deposit (no balance change)", True, "Balance unchanged as expected")
                else:
                    log_test("Admin: Reject deposit (no balance change)", False, f"Balance changed by {balance_after - balance_before} DL")
        else:
            log_test("Admin: Reject deposit", False, f"Status {resp.status_code}", resp.text)


def test_withdrawals():
    """Test 6: Withdrawals."""
    print("\n=== TEST 6: Withdrawals ===")
    
    test_user = "TESTUSER01"
    if test_user not in tokens:
        log_test("Withdrawals: Skipped", False, "Test user not logged in")
        return
    
    user_token = tokens[test_user]
    admin_token = tokens.get(ADMIN_GROW_ID)
    
    # Get current balance
    resp = make_request("GET", "/auth/me", token=user_token)
    if resp.status_code != 200:
        log_test("Withdrawals: Skipped", False, "Could not get user balance")
        return
    
    balance = resp.json().get("balance", {}).get("dl", 0)
    
    # 6.1: Withdraw more than balance → should fail
    resp = make_request("POST", "/withdraws", token=user_token, json_data={
        "amount": balance + 100,
        "currency": "DL",
        "grow_id": test_user
    })
    if resp.status_code == 400:
        log_test("Withdrawals: Insufficient balance rejected", True, "Correctly returned 400")
    else:
        log_test("Withdrawals: Insufficient balance rejected", False, f"Expected 400, got {resp.status_code}", resp.text)
    
    # 6.2: Valid withdrawal
    if balance >= 5:
        withdraw_amount = 5.0
        resp = make_request("POST", "/withdraws", token=user_token, json_data={
            "amount": withdraw_amount,
            "currency": "DL",
            "grow_id": test_user
        })
        if resp.status_code == 200:
            wd = resp.json()
            withdraws.append(wd)
            
            # Verify balance decreased
            resp = make_request("GET", "/auth/me", token=user_token)
            if resp.status_code == 200:
                new_balance = resp.json().get("balance", {}).get("dl", 0)
                if abs((balance - new_balance) - withdraw_amount) < 0.01:
                    log_test("Withdrawals: Create withdrawal", True, f"Balance decreased by {withdraw_amount} DL")
                else:
                    log_test("Withdrawals: Create withdrawal", False, f"Balance change incorrect: {balance} → {new_balance}")
            else:
                log_test("Withdrawals: Create withdrawal", False, "Could not verify balance")
        else:
            log_test("Withdrawals: Create withdrawal", False, f"Status {resp.status_code}", resp.text)
    else:
        log_test("Withdrawals: Create withdrawal", False, f"Insufficient balance for test: {balance} DL")
    
    # 6.3: Admin list withdrawals
    if admin_token:
        resp = make_request("GET", "/admin/withdraws", token=admin_token)
        if resp.status_code == 200:
            wds = resp.json()
            log_test("Admin: GET /admin/withdraws", True, f"Found {len(wds)} withdrawals")
        else:
            log_test("Admin: GET /admin/withdraws", False, f"Status {resp.status_code}", resp.text)
    
    # 6.4: Admin reject withdrawal (should refund)
    if len(withdraws) > 0 and admin_token:
        wd = withdraws[0]
        wd_id = wd["id"]
        
        resp = make_request("GET", "/auth/me", token=user_token)
        balance_before = resp.json().get("balance", {}).get("dl", 0) if resp.status_code == 200 else 0
        
        resp = make_request("POST", f"/admin/withdraws/{wd_id}/decide", token=admin_token, json_data={
            "status": "rejected"
        })
        if resp.status_code == 200:
            resp = make_request("GET", "/auth/me", token=user_token)
            if resp.status_code == 200:
                balance_after = resp.json().get("balance", {}).get("dl", 0)
                refund = balance_after - balance_before
                if abs(refund - wd["amount"]) < 0.01:
                    log_test("Admin: Reject withdrawal (refund)", True, f"Balance refunded {refund} DL")
                else:
                    log_test("Admin: Reject withdrawal (refund)", False, f"Expected refund {wd['amount']} DL, got {refund} DL")
        else:
            log_test("Admin: Reject withdrawal", False, f"Status {resp.status_code}", resp.text)
    
    # 6.5: Create another withdrawal and approve (balance stays deducted)
    resp = make_request("GET", "/auth/me", token=user_token)
    if resp.status_code == 200:
        balance = resp.json().get("balance", {}).get("dl", 0)
        if balance >= 3:
            withdraw_amount = 3.0
            resp = make_request("POST", "/withdraws", token=user_token, json_data={
                "amount": withdraw_amount,
                "currency": "DL",
                "grow_id": test_user
            })
            if resp.status_code == 200:
                wd = resp.json()
                wd_id = wd["id"]
                
                resp = make_request("GET", "/auth/me", token=user_token)
                balance_after_create = resp.json().get("balance", {}).get("dl", 0) if resp.status_code == 200 else 0
                
                # Admin approve
                if admin_token:
                    resp = make_request("POST", f"/admin/withdraws/{wd_id}/decide", token=admin_token, json_data={
                        "status": "approved"
                    })
                    if resp.status_code == 200:
                        resp = make_request("GET", "/auth/me", token=user_token)
                        if resp.status_code == 200:
                            balance_after_approve = resp.json().get("balance", {}).get("dl", 0)
                            if balance_after_approve == balance_after_create:
                                log_test("Admin: Approve withdrawal (no refund)", True, "Balance stays deducted")
                            else:
                                log_test("Admin: Approve withdrawal (no refund)", False, f"Balance changed: {balance_after_create} → {balance_after_approve}")


def test_tips():
    """Test 7: Tips."""
    print("\n=== TEST 7: Tips ===")
    
    test_user = "TESTUSER01"
    recipient = "LUCKYUSER"
    
    if test_user not in tokens:
        log_test("Tips: Skipped", False, "Test user not logged in")
        return
    
    user_token = tokens[test_user]
    
    # Get sender balance
    resp = make_request("GET", "/auth/me", token=user_token)
    if resp.status_code != 200:
        log_test("Tips: Skipped", False, "Could not get sender balance")
        return
    
    sender_balance_before = resp.json().get("balance", {}).get("dl", 0)
    
    if sender_balance_before < 1:
        log_test("Tips: Skipped", False, f"Insufficient balance: {sender_balance_before} DL")
        return
    
    tip_amount = 1.0
    
    # Send tip
    resp = make_request("POST", "/tips", token=user_token, json_data={
        "to_username": recipient,
        "amount": tip_amount,
        "message": "Good luck!"
    })
    
    if resp.status_code == 200:
        # Verify sender balance decreased
        resp = make_request("GET", "/auth/me", token=user_token)
        if resp.status_code == 200:
            sender_balance_after = resp.json().get("balance", {}).get("dl", 0)
            if abs((sender_balance_before - sender_balance_after) - tip_amount) < 0.01:
                # Login as recipient and verify balance
                resp = make_request("POST", "/auth/login", json_data={"grow_id": recipient})
                if resp.status_code == 200:
                    recipient_data = resp.json()
                    recipient_balance = recipient_data["user"].get("balance", {}).get("dl", 0)
                    if abs(recipient_balance - tip_amount) < 0.01:
                        log_test("Tips: Send tip", True, f"Sender -{tip_amount} DL, Recipient +{tip_amount} DL")
                    else:
                        log_test("Tips: Send tip", False, f"Recipient balance incorrect: {recipient_balance} DL")
                else:
                    log_test("Tips: Send tip", False, "Could not verify recipient balance")
            else:
                log_test("Tips: Send tip", False, f"Sender balance change incorrect: {sender_balance_before} → {sender_balance_after}")
    else:
        log_test("Tips: Send tip", False, f"Status {resp.status_code}", resp.text)


def test_games():
    """Test 8: Games/betting."""
    print("\n=== TEST 8: Games/Betting ===")
    
    test_user = "TESTUSER01"
    if test_user not in tokens:
        log_test("Games: Skipped", False, "Test user not logged in")
        return
    
    user_token = tokens[test_user]
    
    # Get balance
    resp = make_request("GET", "/auth/me", token=user_token)
    if resp.status_code != 200:
        log_test("Games: Skipped", False, "Could not get user balance")
        return
    
    balance = resp.json().get("balance", {}).get("dl", 0)
    
    # 8.1: Insufficient bet → should fail
    resp = make_request("POST", "/games/bet", token=user_token, json_data={
        "game": "dice",
        "bet": balance + 100,
        "payout": 0,
        "won": False
    })
    if resp.status_code == 400:
        log_test("Games: Insufficient balance rejected", True, "Correctly returned 400")
    else:
        log_test("Games: Insufficient balance rejected", False, f"Expected 400, got {resp.status_code}", resp.text)
    
    # 8.2: Winning bet
    if balance >= 1:
        bet_amount = 1.0
        multiplier = 1.94
        payout = bet_amount * multiplier
        
        resp = make_request("POST", "/games/bet", token=user_token, json_data={
            "game": "dice",
            "bet": bet_amount,
            "payout": payout,
            "won": True,
            "multiplier": multiplier
        })
        
        if resp.status_code == 200:
            data = resp.json()
            new_balance = data.get("balance", {}).get("dl", 0)
            expected_balance = balance - bet_amount + payout
            
            if abs(new_balance - expected_balance) < 0.01:
                vip = data.get("vip", {})
                if "xp" in vip:
                    log_test("Games: Winning bet", True, f"Balance: {balance:.2f} → {new_balance:.2f} DL, XP: {vip['xp']}")
                else:
                    log_test("Games: Winning bet", False, "VIP XP not updated", data)
            else:
                log_test("Games: Winning bet", False, f"Balance incorrect: expected {expected_balance:.2f}, got {new_balance:.2f}")
        else:
            log_test("Games: Winning bet", False, f"Status {resp.status_code}", resp.text)
        
        balance = new_balance if resp.status_code == 200 else balance
    
    # 8.3: Losing bet
    if balance >= 1:
        bet_amount = 1.0
        
        resp = make_request("POST", "/games/bet", token=user_token, json_data={
            "game": "dice",
            "bet": bet_amount,
            "payout": 0,
            "won": False
        })
        
        if resp.status_code == 200:
            data = resp.json()
            new_balance = data.get("balance", {}).get("dl", 0)
            expected_balance = balance - bet_amount
            
            if abs(new_balance - expected_balance) < 0.01:
                vip = data.get("vip", {})
                log_test("Games: Losing bet", True, f"Balance: {balance:.2f} → {new_balance:.2f} DL, XP: {vip.get('xp', 0)}")
            else:
                log_test("Games: Losing bet", False, f"Balance incorrect: expected {expected_balance:.2f}, got {new_balance:.2f}")
        else:
            log_test("Games: Losing bet", False, f"Status {resp.status_code}", resp.text)


def test_game_history():
    """Test 9: Game history."""
    print("\n=== TEST 9: Game History ===")
    
    test_user = "TESTUSER01"
    if test_user not in tokens:
        log_test("Game History: Skipped", False, "Test user not logged in")
        return
    
    resp = make_request("GET", "/games/history", token=tokens[test_user])
    if resp.status_code == 200:
        history = resp.json()
        if len(history) >= 2:
            log_test("Game History: GET /games/history", True, f"Found {len(history)} bets")
        else:
            log_test("Game History: GET /games/history", False, f"Expected at least 2 bets, got {len(history)}")
    else:
        log_test("Game History: GET /games/history", False, f"Status {resp.status_code}", resp.text)


def test_chat():
    """Test 10: Chat."""
    print("\n=== TEST 10: Chat ===")
    
    test_user = "TESTUSER01"
    if test_user not in tokens:
        log_test("Chat: Skipped", False, "Test user not logged in")
        return
    
    user_token = tokens[test_user]
    
    # Send message
    resp = make_request("POST", "/chat/messages", token=user_token, json_data={
        "message": "Hello from test!"
    })
    
    if resp.status_code == 200:
        msg = resp.json()
        log_test("Chat: POST /chat/messages", True, f"Message sent: {msg.get('message')}")
        
        # Get messages
        resp = make_request("GET", "/chat/messages")
        if resp.status_code == 200:
            messages = resp.json()
            found = any(m.get("message") == "Hello from test!" for m in messages)
            if found:
                log_test("Chat: GET /chat/messages", True, f"Found message in {len(messages)} messages")
            else:
                log_test("Chat: GET /chat/messages", False, "Message not found in chat history")
        else:
            log_test("Chat: GET /chat/messages", False, f"Status {resp.status_code}", resp.text)
    else:
        log_test("Chat: POST /chat/messages", False, f"Status {resp.status_code}", resp.text)


def print_summary():
    """Print test summary."""
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for t in test_results if t.passed)
    failed = sum(1 for t in test_results if not t.passed)
    total = len(test_results)
    
    print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed}")
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for t in test_results:
            if not t.passed:
                print(f"  - {t.name}")
                if t.message:
                    print(f"    {t.message}")
    
    print("\n" + "="*60)
    return failed == 0


def main():
    """Run all tests."""
    print("="*60)
    print("BetDice Backend API Test Suite")
    print(f"Base URL: {BASE_URL}")
    print("="*60)
    
    try:
        test_auth()
        test_config()
        test_deposits()
        test_my_deposits()
        test_admin_deposits()
        test_withdrawals()
        test_tips()
        test_games()
        test_game_history()
        test_chat()
        
        success = print_summary()
        sys.exit(0 if success else 1)
    
    except Exception as e:
        print(f"\n❌ CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
