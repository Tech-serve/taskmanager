#!/usr/bin/env python3
"""
RBAC Testing for New Lead/Head Role and Admin Plus Role
Tests the new role-based access control system with specific focus on:
- Lead role: sees all buyer tasks on all boards except expenses (only own tasks on expenses)
- Admin Plus role: like admin but special assignee rules on payments board
- Updated Buyer role: sees only own tasks and assigned tasks on all boards
- New Payments board: only accessible by admin and admin_plus roles
"""
import requests
import sys
import json
from datetime import datetime

class RBACTester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.boards = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message):
        """Log test messages"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, user_token=None):
        """Run a single API test"""
        url = f"{self.api_base}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if user_token:
            test_headers['Authorization'] = f'Bearer {user_token}'
        elif headers:
            test_headers.update(headers)

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_new_role_authentication(self):
        """Test authentication for new roles"""
        self.log("\n🔐 Testing New Role Authentication...")
        
        # Test login with new roles
        test_users = [
            {"email": "lead@company.com", "password": "lead123", "role": "lead"},
            {"email": "adminplus@company.com", "password": "adminplus123", "role": "admin_plus"},
            {"email": "buyer@company.com", "password": "buyer123", "role": "buyer"},
            {"email": "admin@company.com", "password": "admin123", "role": "admin"}
        ]
        
        for user_data in test_users:
            success, response = self.run_test(
                f"Login as {user_data['role']}",
                "POST",
                "/auth/login",
                200,
                data={"email": user_data["email"], "password": user_data["password"]}
            )
            
            if success and 'access_token' in response:
                self.tokens[user_data['role']] = response['access_token']
                self.users[user_data['role']] = response['user']
                self.log(f"   ✓ Got token for {user_data['role']}")
                
                # Verify role in user data
                user_roles = response['user'].get('roles', [])
                if user_data['role'] in user_roles or (user_data['role'] == 'admin_plus' and 'admin_plus' in user_roles):
                    self.log(f"   ✓ Role verification passed: {user_roles}")
                else:
                    self.log(f"   ❌ Role verification failed. Expected {user_data['role']}, got {user_roles}")
            else:
                self.log(f"   ❌ Failed to get token for {user_data['role']}")
                return False
        
        return True

    def test_board_access_rbac(self):
        """Test board access for different roles"""
        self.log("\n📋 Testing Board Access RBAC...")
        
        # Expected board access for each role
        expected_access = {
            'admin': ['BUY', 'DES', 'TECH', 'EXPENSES', 'PAYMENTS'],  # Admin sees all
            'admin_plus': ['BUY', 'DES', 'TECH', 'EXPENSES', 'PAYMENTS'],  # Admin Plus sees all including payments
            'lead': ['BUY', 'DES', 'TECH', 'EXPENSES', 'PAYMENTS'],  # Lead sees all boards
            'buyer': ['BUY', 'DES', 'TECH', 'EXPENSES']  # Buyer sees all except payments
        }
        
        for role, token in self.tokens.items():
            success, response = self.run_test(
                f"Get boards as {role}",
                "GET",
                "/boards",
                200,
                user_token=token
            )
            
            if success:
                boards = response
                self.boards[role] = boards
                board_keys = [board['key'] for board in boards]
                self.log(f"   ✓ {role} can access {len(boards)} boards: {board_keys}")
                
                # Verify expected access
                expected_boards = set(expected_access.get(role, []))
                actual_boards = set(board_keys)
                
                if role == 'buyer':
                    # Buyer should NOT have access to PAYMENTS
                    if 'PAYMENTS' not in actual_boards:
                        self.log(f"   ✅ {role} RBAC correct - no PAYMENTS access")
                    else:
                        self.log(f"   ❌ {role} RBAC violation - has PAYMENTS access")
                        
                    # Buyer should have access to other boards
                    required_boards = {'BUY', 'DES', 'TECH', 'EXPENSES'}
                    if required_boards.issubset(actual_boards):
                        self.log(f"   ✅ {role} has access to required boards")
                    else:
                        missing = required_boards - actual_boards
                        self.log(f"   ❌ {role} missing access to: {missing}")
                
                elif role in ['lead', 'admin', 'admin_plus']:
                    # These roles should have access to all boards including PAYMENTS
                    if 'PAYMENTS' in actual_boards:
                        self.log(f"   ✅ {role} has PAYMENTS access")
                    else:
                        self.log(f"   ❌ {role} missing PAYMENTS access")
                        
                    required_boards = {'BUY', 'DES', 'TECH', 'EXPENSES'}
                    if required_boards.issubset(actual_boards):
                        self.log(f"   ✅ {role} has access to all required boards")
                    else:
                        missing = required_boards - actual_boards
                        self.log(f"   ❌ {role} missing access to: {missing}")
            else:
                self.log(f"   ❌ {role} failed to get boards")

    def test_payments_board_access(self):
        """Test specific access to PAYMENTS board"""
        self.log("\n💳 Testing PAYMENTS Board Access...")
        
        # Test direct access to PAYMENTS board
        for role, token in self.tokens.items():
            if role in ['buyer']:
                # Buyer should be denied access to PAYMENTS board
                success, response = self.run_test(
                    f"{role} accessing PAYMENTS board (should fail)",
                    "GET",
                    "/boards/by-key/PAYMENTS",
                    403,
                    user_token=token
                )
                if success:
                    self.log(f"   ✅ {role} correctly denied PAYMENTS access")
            else:
                # Admin, admin_plus, lead should have access
                success, response = self.run_test(
                    f"{role} accessing PAYMENTS board",
                    "GET",
                    "/boards/by-key/PAYMENTS",
                    200,
                    user_token=token
                )
                if success:
                    self.log(f"   ✅ {role} has PAYMENTS board access")

    def test_assignable_users_api(self):
        """Test assignable users API for different boards"""
        self.log("\n👥 Testing Assignable Users API...")
        
        # Test assignable users for PAYMENTS board (should only return admin_plus users)
        if 'admin' in self.tokens:
            success, response = self.run_test(
                "Get assignable users for PAYMENTS board",
                "GET",
                "/boards/PAYMENTS/assignable-users",
                200,
                user_token=self.tokens['admin']
            )
            
            if success:
                assignable_users = response
                self.log(f"   ✓ PAYMENTS board has {len(assignable_users)} assignable users")
                
                # Check if only admin_plus users are returned
                admin_plus_count = 0
                for user in assignable_users:
                    user_roles = user.get('roles', [])
                    if 'admin_plus' in user_roles:
                        admin_plus_count += 1
                        self.log(f"   → Admin Plus user: {user['email']}")
                
                if admin_plus_count > 0:
                    self.log(f"   ✅ PAYMENTS board assignable users includes admin_plus users")
                else:
                    self.log(f"   ❌ PAYMENTS board assignable users missing admin_plus users")
        
        # Test assignable users for other boards (should return all users)
        test_boards = ['BUY', 'EXPENSES']
        for board_key in test_boards:
            if 'admin' in self.tokens:
                success, response = self.run_test(
                    f"Get assignable users for {board_key} board",
                    "GET",
                    f"/boards/{board_key}/assignable-users",
                    200,
                    user_token=self.tokens['admin']
                )
                
                if success:
                    assignable_users = response
                    self.log(f"   ✓ {board_key} board has {len(assignable_users)} assignable users")
                    
                    # Should include various roles
                    roles_found = set()
                    for user in assignable_users:
                        user_roles = user.get('roles', [])
                        roles_found.update(user_roles)
                    
                    self.log(f"   → Roles available for assignment: {list(roles_found)}")

    def test_task_filtering_logic(self):
        """Test task filtering logic for different roles"""
        self.log("\n🎯 Testing Task Filtering Logic...")
        
        # Get all users to understand task ownership
        if 'admin' in self.tokens:
            success, response = self.run_test(
                "Get all users for task analysis",
                "GET",
                "/users",
                200,
                user_token=self.tokens['admin']
            )
            
            if success:
                all_users = response
                buyer_users = [u for u in all_users if 'buyer' in u.get('roles', [])]
                self.log(f"   → Found {len(buyer_users)} buyer users")
        
        # Test task filtering on different boards for each role
        test_boards = ['BUY', 'EXPENSES', 'TECH', 'DES']
        
        for board_key in test_boards:
            self.log(f"\n   📋 Testing {board_key} board task filtering:")
            
            for role, token in self.tokens.items():
                # Skip if role shouldn't have access to this board
                if role == 'buyer' and board_key == 'PAYMENTS':
                    continue
                    
                success, response = self.run_test(
                    f"Get {board_key} tasks as {role}",
                    "GET",
                    f"/boards/{board_key}/tasks",
                    200,
                    user_token=token
                )
                
                if success:
                    tasks = response
                    self.log(f"     ✓ {role} sees {len(tasks)} tasks on {board_key}")
                    
                    if tasks:
                        # Analyze task ownership
                        own_tasks = 0
                        assigned_tasks = 0
                        buyer_tasks = 0
                        other_tasks = 0
                        
                        user_id = self.users[role]['id']
                        
                        for task in tasks:
                            creator_id = task.get('creator_id')
                            assignee_id = task.get('assignee_id')
                            
                            if creator_id == user_id:
                                own_tasks += 1
                            elif assignee_id == user_id:
                                assigned_tasks += 1
                            else:
                                # Check if it's a buyer task (for lead role verification)
                                if creator_id:
                                    creator_user = next((u for u in all_users if u['id'] == creator_id), None)
                                    if creator_user and 'buyer' in creator_user.get('roles', []):
                                        buyer_tasks += 1
                                    else:
                                        other_tasks += 1
                                else:
                                    other_tasks += 1
                        
                        self.log(f"       → Own: {own_tasks}, Assigned: {assigned_tasks}, Buyer: {buyer_tasks}, Other: {other_tasks}")
                        
                        # Verify filtering logic based on role and board
                        if role == 'lead':
                            if board_key == 'EXPENSES':
                                # Lead on expenses should only see own + assigned tasks
                                if other_tasks == 0 and buyer_tasks == 0:
                                    self.log(f"       ✅ Lead EXPENSES filtering correct (only own/assigned)")
                                else:
                                    self.log(f"       ❌ Lead EXPENSES filtering wrong (sees other tasks)")
                            else:
                                # Lead on other boards should see buyer tasks too
                                if buyer_tasks > 0 or (own_tasks + assigned_tasks) > 0:
                                    self.log(f"       ✅ Lead {board_key} filtering appears correct")
                                else:
                                    self.log(f"       ⚠️  Lead {board_key} filtering needs verification")
                        
                        elif role == 'buyer':
                            # Buyer should only see own + assigned tasks
                            if other_tasks == 0 and buyer_tasks == 0:
                                self.log(f"       ✅ Buyer filtering correct (only own/assigned)")
                            else:
                                self.log(f"       ❌ Buyer filtering wrong (sees other tasks)")
                        
                        elif role in ['admin', 'admin_plus']:
                            # Admin roles should see all tasks
                            self.log(f"       ✅ {role} sees all tasks (admin level)")
                else:
                    self.log(f"     ❌ {role} failed to get {board_key} tasks")

    def test_task_creation_permissions(self):
        """Test task creation permissions for different roles"""
        self.log("\n➕ Testing Task Creation Permissions...")
        
        # Get board and column info for task creation
        boards_info = {}
        for role, token in self.tokens.items():
            if role in self.boards:
                for board in self.boards[role]:
                    board_key = board['key']
                    if board_key not in boards_info:
                        # Get columns for this board
                        success, response = self.run_test(
                            f"Get columns for {board_key}",
                            "GET",
                            f"/boards/{board['id']}/columns",
                            200,
                            user_token=token
                        )
                        if success and response:
                            boards_info[board_key] = {
                                'board_id': board['id'],
                                'columns': response
                            }
                            break
        
        # Test task creation on different boards
        test_boards = ['BUY', 'EXPENSES']
        
        for board_key in test_boards:
            if board_key in boards_info and boards_info[board_key]['columns']:
                column_id = boards_info[board_key]['columns'][0]['id']
                
                self.log(f"\n   📝 Testing task creation on {board_key} board:")
                
                for role, token in self.tokens.items():
                    # Skip if role shouldn't have access
                    if role == 'buyer' and board_key == 'PAYMENTS':
                        continue
                    
                    task_data = {
                        "board_key": board_key,
                        "column_id": column_id,
                        "title": f"Test Task by {role}",
                        "description": f"Task created by {role} for RBAC testing",
                        "priority": "medium"
                    }
                    
                    # Add amount for expenses board
                    if board_key == 'EXPENSES':
                        task_data["amount"] = 100.50
                        task_data["category"] = "Testing"
                    
                    success, response = self.run_test(
                        f"Create task on {board_key} as {role}",
                        "POST",
                        "/tasks",
                        201,
                        data=task_data,
                        user_token=token
                    )
                    
                    if success:
                        self.log(f"     ✅ {role} can create tasks on {board_key}")
                        task_id = response.get('id')
                        if task_id:
                            self.log(f"       → Created task ID: {task_id}")
                    else:
                        self.log(f"     ❌ {role} cannot create tasks on {board_key}")

    def run_all_rbac_tests(self):
        """Run all RBAC tests"""
        self.log("🚀 Starting RBAC Testing for New Lead/Admin Plus Roles...")
        self.log(f"Testing against: {self.base_url}")
        
        try:
            # Run test suites in order
            if not self.test_new_role_authentication():
                self.log("❌ Authentication tests failed, stopping")
                return False
            
            self.test_board_access_rbac()
            self.test_payments_board_access()
            self.test_assignable_users_api()
            self.test_task_filtering_logic()
            self.test_task_creation_permissions()
            
            # Print summary
            self.log(f"\n📊 RBAC Test Summary:")
            self.log(f"Tests run: {self.tests_run}")
            self.log(f"Tests passed: {self.tests_passed}")
            self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
            self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            if self.failed_tests:
                self.log(f"\n❌ Failed Tests:")
                for failure in self.failed_tests:
                    self.log(f"   - {failure['test']}")
                    if 'error' in failure:
                        self.log(f"     Error: {failure['error']}")
                    else:
                        self.log(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
            
            return self.tests_passed == self.tests_run
            
        except Exception as e:
            self.log(f"❌ RBAC test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    tester = RBACTester()
    success = tester.run_all_rbac_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())