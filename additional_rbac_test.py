#!/usr/bin/env python3
"""
Additional RBAC Testing for Different User Roles
Tests buyer, designer, tech user access and task creation
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

    def test_user_logins(self):
        """Test login for different user roles"""
        self.log("\n🔐 Testing User Role Logins...")
        
        # Test users from the system
        test_users = [
            {"email": "admin@company.com", "password": "admin123", "role": "admin"},
            {"email": "buyer@company.com", "password": "buyer123", "role": "buyer"},
            {"email": "designer@company.com", "password": "designer123", "role": "designer"},
            {"email": "tech@company.com", "password": "tech123", "role": "tech"}
        ]
        
        for user_data in test_users:
            success, response = self.run_test(
                f"Login as {user_data['role']} ({user_data['email']})",
                "POST",
                "/auth/login",
                200,
                data={"email": user_data["email"], "password": user_data["password"]}
            )
            
            if success and 'token' in response:
                self.tokens[user_data['role']] = response['token']
                self.users[user_data['role']] = response['user']
                self.log(f"   ✓ Got token for {user_data['role']}")
            else:
                self.log(f"   ❌ Failed to get token for {user_data['role']}")

    def test_board_access_by_role(self):
        """Test board access for different roles"""
        self.log("\n📋 Testing Board Access by Role...")
        
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
                board_keys = [board['key'] for board in boards]
                self.log(f"   ✓ {role} can access boards: {board_keys}")
                
                # Test specific board access
                for board_key in board_keys:
                    success, tasks_response = self.run_test(
                        f"{role} accessing {board_key} tasks",
                        "GET",
                        f"/boards/{board_key}/tasks",
                        200,
                        user_token=token
                    )
                    
                    if success:
                        task_count = len(tasks_response)
                        self.log(f"   → {role} sees {task_count} tasks on {board_key} board")
                    else:
                        self.log(f"   ❌ {role} cannot access {board_key} tasks")

    def test_task_creation_by_different_users(self):
        """Test task creation by different user roles"""
        self.log("\n➕ Testing Task Creation by Different Users...")
        
        # Test buyer creating task on BUY board
        if 'buyer' in self.tokens:
            # Get BUY board columns
            success, boards_response = self.run_test(
                "Get boards for buyer task creation",
                "GET",
                "/boards",
                200,
                user_token=self.tokens['buyer']
            )
            
            if success:
                buy_board = None
                for board in boards_response:
                    if board['key'] == 'BUY':
                        buy_board = board
                        break
                
                if buy_board:
                    # Get columns
                    success, columns_response = self.run_test(
                        "Get BUY board columns for buyer",
                        "GET",
                        f"/boards/{buy_board['id']}/columns",
                        200,
                        user_token=self.tokens['buyer']
                    )
                    
                    if success and columns_response:
                        first_column = columns_response[0]
                        
                        # Create task as buyer
                        task_data = {
                            "boardKey": "BUY",
                            "columnId": first_column['id'],
                            "title": "Buyer Created Task - Test",
                            "description": "Task created by buyer user for testing",
                            "priority": "medium",
                            "tags": ["buyer-test"]
                        }
                        
                        success, task_response = self.run_test(
                            "Buyer creating task on BUY board",
                            "POST",
                            "/tasks",
                            201,
                            data=task_data,
                            user_token=self.tokens['buyer']
                        )
                        
                        if success:
                            self.log(f"   ✅ Buyer successfully created task: {task_response.get('title', 'N/A')}")
                        else:
                            self.log(f"   ❌ Buyer failed to create task")

    def test_unauthorized_access(self):
        """Test unauthorized access attempts"""
        self.log("\n🚫 Testing Unauthorized Access...")
        
        # Test buyer trying to access admin-only endpoints
        if 'buyer' in self.tokens:
            # Try to get all users (admin only)
            self.run_test(
                "Buyer trying to get all users (should fail)",
                "GET",
                "/users",
                403,
                user_token=self.tokens['buyer']
            )
            
            # Try to create a user (admin only)
            user_data = {
                "email": "unauthorized@test.com",
                "fullName": "Unauthorized User",
                "password": "test123",
                "roles": ["buyer"]
            }
            
            self.run_test(
                "Buyer trying to create user (should fail)",
                "POST",
                "/users",
                403,
                data=user_data,
                user_token=self.tokens['buyer']
            )

    def run_rbac_tests(self):
        """Run all RBAC tests"""
        self.log("🎯 Starting Additional RBAC Tests...")
        self.log(f"Testing against: {self.base_url}")
        
        try:
            self.test_user_logins()
            self.test_board_access_by_role()
            self.test_task_creation_by_different_users()
            self.test_unauthorized_access()
            
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
            self.log(f"❌ Test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    tester = RBACTester()
    success = tester.run_rbac_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())