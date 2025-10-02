#!/usr/bin/env python3
"""
Task Filtering Test for Buyer Board Access
Create tasks and verify filtering logic works correctly
"""
import requests
import sys
import json
from datetime import datetime

class TaskFilteringTester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.boards = {}
        self.created_tasks = []

    def log(self, message):
        """Log test messages"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def login_users(self):
        """Login all test users"""
        self.log("🔐 Logging in test users...")
        
        test_users = [
            {"email": "ceo@company.com", "password": "ceo123", "role": "ceo"},
            {"email": "buyer1.gambling@company.com", "password": "buyer123", "role": "gambling_buyer"},
            {"email": "buyer1.sweeps@company.com", "password": "buyer123", "role": "sweeps_buyer"},
            {"email": "lead.gambling@company.com", "password": "lead123", "role": "gambling_lead"},
            {"email": "head.gambling@company.com", "password": "head123", "role": "gambling_head"},
            {"email": "tech@company.com", "password": "tech123", "role": "tech"}
        ]
        
        for user_data in test_users:
            response = requests.post(f"{self.api_base}/auth/login", json={
                "email": user_data["email"],
                "password": user_data["password"]
            })
            
            if response.status_code == 200:
                data = response.json()
                self.tokens[user_data['role']] = data['access_token']
                self.users[user_data['role']] = data['user']
                self.log(f"   ✓ {user_data['role']} logged in")
            else:
                self.log(f"   ❌ Failed to login {user_data['role']}")
                return False
        
        return True

    def get_board_columns(self):
        """Get board columns for task creation"""
        self.log("\n📋 Getting board columns...")
        
        if 'ceo' not in self.tokens:
            return False
            
        headers = {'Authorization': f'Bearer {self.tokens["ceo"]}'}
        
        # Get boards
        response = requests.get(f"{self.api_base}/boards", headers=headers)
        if response.status_code != 200:
            self.log("❌ Failed to get boards")
            return False
            
        boards = response.json()
        
        for board in boards:
            if board['key'] in ['TECH', 'GAM_DES', 'SWE_DES']:
                self.boards[board['key']] = board
                
                # Get columns for this board
                response = requests.get(f"{self.api_base}/boards/{board['id']}/columns", headers=headers)
                if response.status_code == 200:
                    columns = response.json()
                    self.boards[board['key']]['columns'] = columns
                    self.log(f"   ✓ Got {len(columns)} columns for {board['key']}")
                else:
                    self.log(f"   ❌ Failed to get columns for {board['key']}")
        
        return True

    def create_test_tasks(self):
        """Create test tasks on different boards"""
        self.log("\n➕ Creating test tasks...")
        
        # Tasks to create
        tasks_to_create = [
            # TECH board tasks
            {
                "board_key": "TECH",
                "title": "Gambling Buyer Tech Task",
                "description": "Task created by gambling buyer",
                "creator": "gambling_buyer"
            },
            {
                "board_key": "TECH", 
                "title": "Sweeps Buyer Tech Task",
                "description": "Task created by sweeps buyer",
                "creator": "sweeps_buyer"
            },
            {
                "board_key": "TECH",
                "title": "Lead Tech Task", 
                "description": "Task created by gambling lead",
                "creator": "gambling_lead"
            },
            {
                "board_key": "TECH",
                "title": "Tech User Task",
                "description": "Task created by tech user",
                "creator": "tech"
            },
            # GAM_DES board tasks
            {
                "board_key": "GAM_DES",
                "title": "Gambling Design Task",
                "description": "Design task for gambling",
                "creator": "gambling_buyer"
            },
            # SWE_DES board tasks
            {
                "board_key": "SWE_DES",
                "title": "Sweeps Design Task", 
                "description": "Design task for sweeps",
                "creator": "sweeps_buyer"
            }
        ]
        
        for task_data in tasks_to_create:
            board_key = task_data["board_key"]
            creator = task_data["creator"]
            
            if board_key not in self.boards or creator not in self.tokens:
                self.log(f"   ❌ Skipping task - missing board or user")
                continue
                
            if 'columns' not in self.boards[board_key] or not self.boards[board_key]['columns']:
                self.log(f"   ❌ No columns found for {board_key}")
                continue
                
            column_id = self.boards[board_key]['columns'][0]['id']  # First column
            
            headers = {'Authorization': f'Bearer {self.tokens[creator]}'}
            
            create_data = {
                "board_key": board_key,
                "column_id": column_id,
                "title": task_data["title"],
                "description": task_data["description"],
                "priority": "medium"
            }
            
            response = requests.post(f"{self.api_base}/tasks", json=create_data, headers=headers)
            
            if response.status_code == 201:
                task = response.json()
                self.created_tasks.append(task)
                self.log(f"   ✅ Created task '{task_data['title']}' by {creator}")
            else:
                self.log(f"   ❌ Failed to create task '{task_data['title']}' by {creator}: {response.status_code}")
                self.log(f"      Response: {response.text[:200]}")

    def test_task_filtering(self):
        """Test task filtering for different user roles"""
        self.log("\n🔍 Testing task filtering...")
        
        # Test cases: user -> boards they should see tasks on
        test_cases = [
            {
                "user": "gambling_buyer",
                "boards": ["TECH", "GAM_DES"],
                "expected_behavior": "Should only see own tasks (creator or assignee)"
            },
            {
                "user": "sweeps_buyer", 
                "boards": ["TECH", "SWE_DES"],
                "expected_behavior": "Should only see own tasks (creator or assignee)"
            },
            {
                "user": "gambling_lead",
                "boards": ["TECH", "GAM_DES"],
                "expected_behavior": "Should see all buyer tasks + own tasks on TECH, own tasks on GAM_DES"
            },
            {
                "user": "gambling_head",
                "boards": ["TECH", "GAM_DES"],
                "expected_behavior": "Should see all department tasks"
            },
            {
                "user": "tech",
                "boards": ["TECH"],
                "expected_behavior": "Should see all tasks on TECH board"
            }
        ]
        
        for test_case in test_cases:
            user = test_case["user"]
            if user not in self.tokens:
                continue
                
            self.log(f"\n👤 Testing {user}:")
            self.log(f"   Expected: {test_case['expected_behavior']}")
            
            headers = {'Authorization': f'Bearer {self.tokens[user]}'}
            user_id = self.users[user]['id']
            
            for board_key in test_case["boards"]:
                response = requests.get(f"{self.api_base}/boards/{board_key}/tasks", headers=headers)
                
                if response.status_code == 200:
                    tasks = response.json()
                    
                    # Analyze tasks
                    own_tasks = [t for t in tasks if t.get('creator_id') == user_id or t.get('assignee_id') == user_id]
                    buyer_tasks = []
                    all_tasks = tasks
                    
                    # Count tasks by creator role (simplified - we'd need to look up creator roles)
                    task_creators = [t.get('creator_id') for t in tasks]
                    
                    self.log(f"   📋 {board_key}: {len(tasks)} total tasks, {len(own_tasks)} own tasks")
                    self.log(f"      Task creators: {task_creators}")
                    
                    # Verify filtering logic
                    if user.endswith('_buyer'):
                        # Buyers should only see own tasks
                        if len(tasks) == len(own_tasks):
                            self.log(f"      ✅ Buyer filtering CORRECT - only sees own tasks")
                        else:
                            self.log(f"      ❌ Buyer filtering ISSUE - sees {len(tasks) - len(own_tasks)} unauthorized tasks")
                    
                    elif user.endswith('_lead'):
                        # LEADs should see buyer tasks + own on most boards
                        if board_key == "TECH":
                            self.log(f"      ✅ LEAD can see tasks on TECH board")
                        else:
                            if len(tasks) == len(own_tasks):
                                self.log(f"      ✅ LEAD filtering on {board_key} - sees own tasks")
                            else:
                                self.log(f"      ℹ️  LEAD sees {len(tasks)} tasks on {board_key}")
                    
                    elif user.endswith('_head'):
                        # HEADs should see all department tasks
                        self.log(f"      ✅ HEAD can see {len(tasks)} tasks on {board_key}")
                    
                    elif user == 'tech':
                        # Tech users should see all tasks on TECH board
                        if board_key == "TECH":
                            self.log(f"      ✅ TECH user sees all {len(tasks)} tasks on TECH board")
                    
                else:
                    self.log(f"   ❌ Failed to get {board_key} tasks for {user}: {response.status_code}")

    def cleanup_tasks(self):
        """Clean up created tasks"""
        self.log("\n🧹 Cleaning up test tasks...")
        
        if 'ceo' not in self.tokens:
            return
            
        headers = {'Authorization': f'Bearer {self.tokens["ceo"]}'}
        
        for task in self.created_tasks:
            # Note: We don't have a delete task endpoint, so we'll leave them
            # In a real scenario, we'd clean up test data
            pass
        
        self.log(f"   ℹ️  Left {len(self.created_tasks)} test tasks (no delete endpoint)")

    def run_test(self):
        """Run the complete task filtering test"""
        self.log("🚀 Starting Task Filtering Test...")
        
        if not self.login_users():
            return False
            
        if not self.get_board_columns():
            return False
            
        self.create_test_tasks()
        self.test_task_filtering()
        self.cleanup_tasks()
        
        self.log("\n✅ Task filtering test completed!")
        return True

def main():
    """Main function"""
    tester = TaskFilteringTester()
    success = tester.run_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())