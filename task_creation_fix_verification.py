#!/usr/bin/env python3
"""
Task Creation Verification Test - Verify the fix works for all scenarios
"""
import requests
import json
from datetime import datetime

def log(message):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

def test_task_creation_fix():
    """Test task creation fix comprehensively"""
    base_url = "https://projectflow-37.preview.emergentagent.com/api"
    
    log("🚀 Testing Task Creation Fix...")
    
    # Test users
    test_users = [
        {"email": "ceo@company.com", "password": "ceo123", "role": "CEO"},
        {"email": "tech@company.com", "password": "tech123", "role": "Tech"}
    ]
    
    # Test boards
    test_boards = [
        {"key": "GAM_BUY", "column": "col-gam-buy-todo", "name": "GAM Buy Board"},
        {"key": "SWE_BUY", "column": "col-swe-buy-todo", "name": "SWE Buy Board"},
        {"key": "TECH", "column": "col-tech-todo", "name": "Tech Board"},
        {"key": "EXPENSES", "column": "col-exp-pending", "name": "Expenses Board"}
    ]
    
    success_count = 0
    total_tests = 0
    
    for user in test_users:
        log(f"\n👤 Testing with {user['role']} user ({user['email']})...")
        
        # Login
        login_response = requests.post(f"{base_url}/auth/login", json={
            "email": user["email"],
            "password": user["password"]
        })
        
        if login_response.status_code != 200:
            log(f"❌ Login failed for {user['role']}")
            continue
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Get accessible boards
        boards_response = requests.get(f"{base_url}/boards", headers=headers)
        if boards_response.status_code != 200:
            log(f"❌ Failed to get boards for {user['role']}")
            continue
        
        accessible_boards = [board["key"] for board in boards_response.json()]
        log(f"   → Accessible boards: {accessible_boards}")
        
        # Test task creation on each accessible board
        for board in test_boards:
            if board["key"] not in accessible_boards:
                log(f"   ⏭️  Skipping {board['name']} (not accessible)")
                continue
            
            total_tests += 1
            log(f"   📋 Testing task creation on {board['name']}...")
            
            # Basic task data
            task_data = {
                "board_key": board["key"],
                "column_id": board["column"],
                "title": f"Test Task by {user['role']} on {board['key']}",
                "description": f"Testing task creation fix on {board['name']}",
                "priority": "medium"
            }
            
            # Add expense-specific fields for EXPENSES board
            if board["key"] == "EXPENSES":
                task_data["amount"] = 125.50
                task_data["category"] = "testing"
            
            # Create task
            create_response = requests.post(f"{base_url}/tasks", json=task_data, headers=headers)
            
            if create_response.status_code == 201:
                task = create_response.json()
                success_count += 1
                log(f"   ✅ Task created successfully!")
                log(f"      → Task ID: {task['id']}")
                log(f"      → Title: {task['title']}")
                log(f"      → Department ID: {task['department_id']}")
                log(f"      → Creator ID: {task['creator_id']}")
                if board["key"] == "EXPENSES":
                    log(f"      → Amount: ${task.get('amount', 'N/A')}")
                    log(f"      → Category: {task.get('category', 'N/A')}")
            else:
                log(f"   ❌ Task creation failed!")
                log(f"      → Status: {create_response.status_code}")
                log(f"      → Response: {create_response.text[:200]}")
    
    # Test edge cases
    log(f"\n🔍 Testing Edge Cases...")
    
    # Login as CEO for edge case testing
    login_response = requests.post(f"{base_url}/auth/login", json={
        "email": "ceo@company.com",
        "password": "ceo123"
    })
    
    if login_response.status_code == 200:
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        # Test 1: Task with assignee
        total_tests += 1
        task_data = {
            "board_key": "GAM_BUY",
            "column_id": "col-gam-buy-todo",
            "title": "Task with Assignee",
            "description": "Testing task creation with assignee",
            "assignee_id": "ceo-001"  # Assign to self
        }
        
        create_response = requests.post(f"{base_url}/tasks", json=task_data, headers=headers)
        if create_response.status_code == 201:
            success_count += 1
            task = create_response.json()
            log(f"   ✅ Task with assignee created!")
            log(f"      → Assignee ID: {task.get('assignee_id', 'N/A')}")
        else:
            log(f"   ❌ Task with assignee failed: {create_response.status_code}")
        
        # Test 2: Task with null assignee
        total_tests += 1
        task_data = {
            "board_key": "GAM_BUY",
            "column_id": "col-gam-buy-todo",
            "title": "Task with Null Assignee",
            "description": "Testing task creation with null assignee",
            "assignee_id": None
        }
        
        create_response = requests.post(f"{base_url}/tasks", json=task_data, headers=headers)
        if create_response.status_code == 201:
            success_count += 1
            task = create_response.json()
            log(f"   ✅ Task with null assignee created!")
            log(f"      → Assignee ID: {task.get('assignee_id', 'None')}")
        else:
            log(f"   ❌ Task with null assignee failed: {create_response.status_code}")
        
        # Test 3: Task without assignee field
        total_tests += 1
        task_data = {
            "board_key": "GAM_BUY",
            "column_id": "col-gam-buy-todo",
            "title": "Task without Assignee Field",
            "description": "Testing task creation without assignee field"
        }
        
        create_response = requests.post(f"{base_url}/tasks", json=task_data, headers=headers)
        if create_response.status_code == 201:
            success_count += 1
            task = create_response.json()
            log(f"   ✅ Task without assignee field created!")
            log(f"      → Assignee ID: {task.get('assignee_id', 'None')}")
        else:
            log(f"   ❌ Task without assignee field failed: {create_response.status_code}")
    
    # Summary
    log(f"\n📊 Task Creation Fix Test Summary:")
    log(f"   Total tests: {total_tests}")
    log(f"   Successful: {success_count}")
    log(f"   Failed: {total_tests - success_count}")
    log(f"   Success rate: {(success_count/total_tests)*100:.1f}%")
    
    if success_count == total_tests:
        log(f"🎉 ALL TESTS PASSED! Task creation fix is working correctly!")
        return True
    else:
        log(f"⚠️  Some tests failed. Task creation may still have issues.")
        return False

if __name__ == "__main__":
    test_task_creation_fix()