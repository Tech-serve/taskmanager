#!/usr/bin/env python3
"""
Focused Backend API Testing for User Requirements
Tests authentication, EXP board tasks, user management, and RBAC
"""
import requests
import sys
import json
from datetime import datetime

class FocusedJiraAPITester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.admin_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.critical_issues = []

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
                self.log(f"   Response: {response.text[:300]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_admin_authentication(self):
        """Test admin authentication as specified by user"""
        self.log("\n🔐 Testing Admin Authentication...")
        
        # Test admin login with specified credentials
        success, response = self.run_test(
            "Admin login (admin@company.com/admin123)",
            "POST",
            "/auth/login",
            200,
            data={"email": "admin@company.com", "password": "admin123"}
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.log(f"   ✅ Admin login successful")
            self.log(f"   → Token received: {self.admin_token[:20]}...")
            
            # Test JWT token validity
            success, user_response = self.run_test(
                "JWT token validity check",
                "GET",
                "/auth/me",
                200,
                user_token=self.admin_token
            )
            
            if success:
                self.log(f"   ✅ JWT token is valid")
                self.log(f"   → User: {user_response.get('full_name', 'N/A')} ({user_response.get('email', 'N/A')})")
                self.log(f"   → Roles: {user_response.get('roles', [])}")
                return True
            else:
                self.critical_issues.append("JWT token validation failed")
                return False
        else:
            self.critical_issues.append("Admin login failed with specified credentials")
            return False

    def test_boards_and_tasks(self):
        """Test boards and tasks as specified by user"""
        self.log("\n📋 Testing Boards and Tasks...")
        
        if not self.admin_token:
            self.log("❌ No admin token available for testing")
            return False
        
        # Get all boards first
        success, boards_response = self.run_test(
            "Get all boards as admin",
            "GET",
            "/boards",
            200,
            user_token=self.admin_token
        )
        
        if success:
            boards = boards_response
            board_keys = [board['key'] for board in boards]
            self.log(f"   ✅ Found boards: {board_keys}")
            
            # Check for EXP board (user mentioned expense board)
            exp_board_exists = any(board['key'] == 'EXP' for board in boards)
            buy_board_exists = any(board['key'] == 'BUY' for board in boards)
            
            self.log(f"   → EXP board exists: {exp_board_exists}")
            self.log(f"   → BUY board exists: {buy_board_exists}")
            
            # Test GET /api/boards/EXP/tasks (user expects 5 expense tasks)
            if exp_board_exists:
                success, exp_tasks = self.run_test(
                    "GET /api/boards/EXP/tasks (should return 5 expense tasks)",
                    "GET",
                    "/boards/EXP/tasks",
                    200,
                    user_token=self.admin_token
                )
                
                if success:
                    self.log(f"   ✅ EXP board tasks retrieved: {len(exp_tasks)} tasks")
                    if len(exp_tasks) == 5:
                        self.log(f"   ✅ Correct number of expense tasks (5)")
                    else:
                        self.log(f"   ⚠️  Expected 5 expense tasks, found {len(exp_tasks)}")
                    
                    # Show sample tasks
                    for i, task in enumerate(exp_tasks[:3]):
                        self.log(f"   → Task {i+1}: {task.get('title', 'N/A')}")
                else:
                    self.critical_issues.append("Cannot retrieve EXP board tasks")
            else:
                self.critical_issues.append("EXP board not found - user mentioned expense board should exist")
            
            # Test GET /api/boards/BUY/tasks (user expects buyer tasks)
            if buy_board_exists:
                success, buy_tasks = self.run_test(
                    "GET /api/boards/BUY/tasks (should return buyer tasks)",
                    "GET",
                    "/boards/BUY/tasks",
                    200,
                    user_token=self.admin_token
                )
                
                if success:
                    self.log(f"   ✅ BUY board tasks retrieved: {len(buy_tasks)} tasks")
                    
                    # Show sample tasks
                    for i, task in enumerate(buy_tasks[:3]):
                        self.log(f"   → Task {i+1}: {task.get('title', 'N/A')}")
                else:
                    self.critical_issues.append("Cannot retrieve BUY board tasks")
            else:
                self.critical_issues.append("BUY board not found")
            
            return True
        else:
            self.critical_issues.append("Cannot retrieve boards list")
            return False

    def test_task_creation_with_amount(self):
        """Test task creation with amount for EXP board"""
        self.log("\n➕ Testing Task Creation with Amount for EXP Board...")
        
        if not self.admin_token:
            self.log("❌ No admin token available for testing")
            return False
        
        # First get EXP board details and columns
        success, boards_response = self.run_test(
            "Get boards to find EXP board",
            "GET",
            "/boards",
            200,
            user_token=self.admin_token
        )
        
        if not success:
            self.critical_issues.append("Cannot get boards for task creation test")
            return False
        
        exp_board = None
        for board in boards_response:
            if board['key'] == 'EXP':
                exp_board = board
                break
        
        if not exp_board:
            self.log("❌ EXP board not found for task creation test")
            self.critical_issues.append("EXP board missing - cannot test task creation")
            return False
        
        # Get columns for EXP board
        success, columns_response = self.run_test(
            "Get EXP board columns",
            "GET",
            f"/boards/{exp_board['id']}/columns",
            200,
            user_token=self.admin_token
        )
        
        if not success or not columns_response:
            self.critical_issues.append("Cannot get EXP board columns")
            return False
        
        # Use first column for task creation
        first_column = columns_response[0]
        
        # Test POST /api/tasks with amount for EXP board
        task_data = {
            "boardKey": "EXP",
            "columnId": first_column['id'],
            "title": "Test Expense Task with Amount",
            "description": "Testing expense task creation with amount field",
            "priority": "high",
            "tags": ["expense", "test"],
            "amount": 1500.50  # User mentioned amount field for EXP board
        }
        
        success, task_response = self.run_test(
            "POST /api/tasks (create expense task with amount)",
            "POST",
            "/tasks",
            201,
            data=task_data,
            user_token=self.admin_token
        )
        
        if success:
            self.log(f"   ✅ Expense task created successfully")
            self.log(f"   → Task ID: {task_response.get('id', 'N/A')}")
            self.log(f"   → Title: {task_response.get('title', 'N/A')}")
            
            # Check if amount field is supported
            if 'amount' in task_response:
                self.log(f"   ✅ Amount field supported: {task_response['amount']}")
            else:
                self.log(f"   ⚠️  Amount field not found in response - may not be implemented")
            
            return True
        else:
            self.critical_issues.append("Cannot create expense task with amount")
            return False

    def test_user_management_for_admin(self):
        """Test user management APIs for admin"""
        self.log("\n👥 Testing User Management APIs for Admin...")
        
        if not self.admin_token:
            self.log("❌ No admin token available for testing")
            return False
        
        # Test GET /api/users (list all users)
        success, users_response = self.run_test(
            "GET /api/users (list all users)",
            "GET",
            "/users",
            200,
            user_token=self.admin_token
        )
        
        if success:
            users = users_response
            self.log(f"   ✅ Retrieved {len(users)} users")
            
            # Show user details
            for user in users[:5]:  # Show first 5 users
                self.log(f"   → User: {user.get('email', 'N/A')} - {user.get('full_name', 'N/A')} - Roles: {user.get('roles', [])}")
            
            # Find a non-admin user for password reset test
            test_user = None
            for user in users:
                if 'admin' not in user.get('roles', []):
                    test_user = user
                    break
            
            if test_user:
                # Test PUT /api/users/:id with password (password reset)
                password_reset_data = {
                    "password": "newpassword123"
                }
                
                success, reset_response = self.run_test(
                    f"PUT /api/users/{test_user['id']} (password reset)",
                    "PUT",
                    f"/users/{test_user['id']}",
                    200,
                    data=password_reset_data,
                    user_token=self.admin_token
                )
                
                if success:
                    self.log(f"   ✅ Password reset successful for user: {test_user['email']}")
                else:
                    self.log(f"   ❌ Password reset failed for user: {test_user['email']}")
                    self.critical_issues.append("Password reset functionality not working")
            else:
                self.log(f"   ⚠️  No non-admin users found for password reset test")
            
            return True
        else:
            self.critical_issues.append("Cannot retrieve users list")
            return False

    def test_rbac_access_rights(self):
        """Test RBAC and access rights"""
        self.log("\n🔒 Testing RBAC and Access Rights...")
        
        if not self.admin_token:
            self.log("❌ No admin token available for testing")
            return False
        
        # Test that admin can see all tasks across all boards
        success, boards_response = self.run_test(
            "Get all boards for RBAC test",
            "GET",
            "/boards",
            200,
            user_token=self.admin_token
        )
        
        if success:
            total_tasks = 0
            for board in boards_response:
                board_key = board['key']
                success, tasks_response = self.run_test(
                    f"Admin access to {board_key} board tasks",
                    "GET",
                    f"/boards/{board_key}/tasks",
                    200,
                    user_token=self.admin_token
                )
                
                if success:
                    task_count = len(tasks_response)
                    total_tasks += task_count
                    self.log(f"   ✅ Admin can access {board_key} board: {task_count} tasks")
                else:
                    self.log(f"   ❌ Admin cannot access {board_key} board")
                    self.critical_issues.append(f"Admin cannot access {board_key} board")
            
            self.log(f"   📊 Admin can see {total_tasks} total tasks across all boards")
            return True
        else:
            self.critical_issues.append("Cannot test RBAC - boards not accessible")
            return False

    def run_focused_tests(self):
        """Run focused tests based on user requirements"""
        self.log("🎯 Starting Focused Backend API Tests...")
        self.log(f"Testing against: {self.base_url}")
        self.log("Testing user requirements:")
        self.log("1. Admin authentication (admin@company.com/admin123)")
        self.log("2. JWT token validity and lifetime")
        self.log("3. GET /api/boards/EXP/tasks (should return 5 expense tasks)")
        self.log("4. GET /api/boards/BUY/tasks (should return buyer tasks)")
        self.log("5. POST /api/tasks with amount for EXP board")
        self.log("6. Admin access rights (sees all tasks)")
        self.log("7. GET /api/users and PUT /api/users/:id with password")
        
        try:
            # Run focused test suites
            if not self.test_admin_authentication():
                self.log("❌ Admin authentication failed, continuing with other tests...")
            
            self.test_boards_and_tasks()
            self.test_task_creation_with_amount()
            self.test_user_management_for_admin()
            self.test_rbac_access_rights()
            
            # Print summary
            self.log(f"\n📊 Focused Test Summary:")
            self.log(f"Tests run: {self.tests_run}")
            self.log(f"Tests passed: {self.tests_passed}")
            self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
            self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            # Print critical issues
            if self.critical_issues:
                self.log(f"\n🚨 CRITICAL ISSUES FOUND:")
                for i, issue in enumerate(self.critical_issues, 1):
                    self.log(f"   {i}. {issue}")
            else:
                self.log(f"\n✅ No critical issues found!")
            
            # Print failed tests
            if self.failed_tests:
                self.log(f"\n❌ Failed Tests Details:")
                for failure in self.failed_tests:
                    self.log(f"   - {failure['test']}")
                    if 'error' in failure:
                        self.log(f"     Error: {failure['error']}")
                    else:
                        self.log(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
                        if failure.get('response'):
                            self.log(f"     Response: {failure['response']}")
            
            return len(self.critical_issues) == 0
            
        except Exception as e:
            self.log(f"❌ Test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    tester = FocusedJiraAPITester()
    success = tester.run_focused_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())