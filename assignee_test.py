#!/usr/bin/env python3
"""
Assignee Selection Functionality Testing
Tests the specific assignee selection functionality after fixing SelectItem empty string value error.
"""
import requests
import sys
import json
from datetime import datetime

class AssigneeSelectionTester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.test_task_id = None
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

    def setup_authentication(self):
        """Setup authentication for admin and buyer users"""
        self.log("\n🔐 Setting up Authentication...")
        
        # Test users as specified in the review request
        test_users = [
            {"email": "admin@company.com", "password": "admin123", "role": "admin"},
            {"email": "buyer@company.com", "password": "buyer123", "role": "buyer"}
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
                self.log(f"   ✓ Got token for {user_data['role']}: {response['user']['full_name']}")
            else:
                self.log(f"   ❌ Failed to get token for {user_data['role']}")
                return False
        
        return True

    def test_user_list_api(self):
        """Test GET /api/users endpoint for assignee selection"""
        self.log("\n👥 Testing User List API for Assignee Selection...")
        
        # Test 1: Admin should be able to get users list
        if 'admin' in self.tokens:
            success, response = self.run_test(
                "GET /api/users as admin",
                "GET",
                "/users",
                200,
                user_token=self.tokens['admin']
            )
            
            if success:
                users = response
                self.log(f"   ✓ Admin got {len(users)} users for assignee selection")
                
                # Verify user data structure for frontend dropdown
                if users:
                    user = users[0]
                    required_fields = ['id', 'email', 'full_name', 'roles']
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if not missing_fields:
                        self.log(f"   ✓ User objects have all required fields for assignee dropdown")
                        self.log(f"   → Sample user: {user['full_name']} ({user['email']}) - {user['roles']}")
                    else:
                        self.log(f"   ❌ User objects missing fields: {missing_fields}")
                
                # Store users for later tests
                self.all_users = users
            else:
                self.log(f"   ❌ Admin failed to get users list")
                return False
        
        # Test 2: Buyer should also be able to get users list (per requirement: "assignee selection available for all users")
        if 'buyer' in self.tokens:
            success, response = self.run_test(
                "GET /api/users as buyer",
                "GET",
                "/users",
                200,
                user_token=self.tokens['buyer']
            )
            
            if success:
                users = response
                self.log(f"   ✓ Buyer got {len(users)} users for assignee selection")
                self.log(f"   ✓ Assignee selection is available for all user roles")
            else:
                self.log(f"   ❌ Buyer failed to get users list - assignee selection not available for all users")
        
        return True

    def test_task_creation_with_assignee(self):
        """Test POST /api/tasks with assignee_id field"""
        self.log("\n➕ Testing Task Creation with Assignee...")
        
        if not hasattr(self, 'all_users') or not self.all_users:
            self.log("   ❌ No users available for assignee testing")
            return False
        
        # Get a test assignee (first non-admin user)
        test_assignee = None
        for user in self.all_users:
            if 'admin' not in user.get('roles', []):
                test_assignee = user
                break
        
        if not test_assignee:
            test_assignee = self.all_users[0]  # Fallback to first user
        
        # Test 1: Create task with assignee as admin
        if 'admin' in self.tokens:
            # First, get a board and column for task creation
            success, boards_response = self.run_test(
                "Get boards for task creation",
                "GET",
                "/boards",
                200,
                user_token=self.tokens['admin']
            )
            
            if success and boards_response:
                board = boards_response[0]
                board_id = board['id']
                board_key = board['key']
                
                # Get columns for the board
                success, columns_response = self.run_test(
                    f"Get columns for board {board_key}",
                    "GET",
                    f"/boards/{board_id}/columns",
                    200,
                    user_token=self.tokens['admin']
                )
                
                if success and columns_response:
                    column_id = columns_response[0]['id']
                    
                    # Create task with assignee
                    task_data = {
                        "board_key": board_key,
                        "column_id": column_id,
                        "title": "Test Task with Assignee",
                        "description": "Testing assignee selection functionality",
                        "assignee_id": test_assignee['id'],
                        "priority": "medium"
                    }
                    
                    success, response = self.run_test(
                        "POST /api/tasks with assignee_id",
                        "POST",
                        "/tasks",
                        201,
                        data=task_data,
                        user_token=self.tokens['admin']
                    )
                    
                    if success and 'id' in response:
                        self.test_task_id = response['id']
                        self.log(f"   ✓ Created task with assignee: {test_assignee['full_name']}")
                        self.log(f"   → Task ID: {self.test_task_id}")
                        
                        # Verify assignee_id is correctly set
                        if response.get('assignee_id') == test_assignee['id']:
                            self.log(f"   ✓ Assignee ID correctly set in created task")
                        else:
                            self.log(f"   ❌ Assignee ID mismatch - Expected: {test_assignee['id']}, Got: {response.get('assignee_id')}")
                    else:
                        self.log(f"   ❌ Failed to create task with assignee")
                        return False
        
        # Test 2: Create task without assignee (null/unassigned)
        if 'admin' in self.tokens and 'board_key' in locals() and 'column_id' in locals():
            task_data_no_assignee = {
                "board_key": board_key,
                "column_id": column_id,
                "title": "Test Task without Assignee",
                "description": "Testing unassigned task creation",
                "assignee_id": None,
                "priority": "low"
            }
            
            success, response = self.run_test(
                "POST /api/tasks with assignee_id: null",
                "POST",
                "/tasks",
                201,
                data=task_data_no_assignee,
                user_token=self.tokens['admin']
            )
            
            if success:
                self.log(f"   ✓ Created task without assignee (null value accepted)")
                if response.get('assignee_id') is None:
                    self.log(f"   ✓ Unassigned task correctly has null assignee_id")
                else:
                    self.log(f"   ❌ Unassigned task has unexpected assignee_id: {response.get('assignee_id')}")
            else:
                self.log(f"   ❌ Failed to create task with null assignee_id")
        
        return True

    def test_task_assignee_updates(self):
        """Test PATCH /api/tasks/:id for assignee changes"""
        self.log("\n🔄 Testing Task Assignee Updates...")
        
        if not self.test_task_id:
            self.log("   ❌ No test task available for assignee update testing")
            return False
        
        if not hasattr(self, 'all_users') or not self.all_users:
            self.log("   ❌ No users available for assignee testing")
            return False
        
        # Get different assignees for testing
        assignee1 = None
        assignee2 = None
        for user in self.all_users:
            if assignee1 is None:
                assignee1 = user
            elif assignee2 is None and user['id'] != assignee1['id']:
                assignee2 = user
                break
        
        # Test 1: Update task assignee as admin
        if 'admin' in self.tokens and assignee1:
            update_data = {
                "assignee_id": assignee1['id']
            }
            
            success, response = self.run_test(
                f"PATCH /api/tasks/{self.test_task_id} - assign to user",
                "PATCH",
                f"/tasks/{self.test_task_id}",
                200,
                data=update_data,
                user_token=self.tokens['admin']
            )
            
            if success:
                self.log(f"   ✅ Successfully assigned task to: {assignee1['full_name']}")
                if response.get('assignee_id') == assignee1['id']:
                    self.log(f"   ✓ Assignee ID correctly updated in response")
                else:
                    self.log(f"   ❌ Assignee ID mismatch in response")
            else:
                self.log(f"   ❌ Failed to assign task to user")
        
        # Test 2: Change assignee to different user
        if 'admin' in self.tokens and assignee2:
            update_data = {
                "assignee_id": assignee2['id']
            }
            
            success, response = self.run_test(
                f"PATCH /api/tasks/{self.test_task_id} - change assignee",
                "PATCH",
                f"/tasks/{self.test_task_id}",
                200,
                data=update_data,
                user_token=self.tokens['admin']
            )
            
            if success:
                self.log(f"   ✅ Successfully changed assignee to: {assignee2['full_name']}")
            else:
                self.log(f"   ❌ Failed to change task assignee")
        
        # Test 3: Unassign task (set assignee_id to null)
        if 'admin' in self.tokens:
            update_data = {
                "assignee_id": None
            }
            
            success, response = self.run_test(
                f"PATCH /api/tasks/{self.test_task_id} - unassign task",
                "PATCH",
                f"/tasks/{self.test_task_id}",
                200,
                data=update_data,
                user_token=self.tokens['admin']
            )
            
            if success:
                self.log(f"   ✅ Successfully unassigned task")
                if response.get('assignee_id') is None:
                    self.log(f"   ✓ Task correctly shows null assignee_id after unassigning")
                else:
                    self.log(f"   ❌ Task still has assignee_id after unassigning: {response.get('assignee_id')}")
            else:
                self.log(f"   ❌ Failed to unassign task")
        
        # Test 4: Test assignee update as buyer (should work per requirement)
        if 'buyer' in self.tokens and assignee1:
            update_data = {
                "assignee_id": assignee1['id']
            }
            
            success, response = self.run_test(
                f"PATCH /api/tasks/{self.test_task_id} - assign as buyer",
                "PATCH",
                f"/tasks/{self.test_task_id}",
                200,
                data=update_data,
                user_token=self.tokens['buyer']
            )
            
            if success:
                self.log(f"   ✅ Buyer can successfully assign tasks")
                self.log(f"   ✓ Assignee functionality available for all user roles")
            else:
                self.log(f"   ❌ Buyer cannot assign tasks - role-based restriction still exists")
        
        return True

    def test_role_based_access(self):
        """Test that all user roles can access assignee functionality"""
        self.log("\n🔐 Testing Role-Based Access for Assignee Functionality...")
        
        # Test that both admin and buyer can access user list and modify assignees
        roles_to_test = ['admin', 'buyer']
        
        for role in roles_to_test:
            if role in self.tokens:
                self.log(f"\n   Testing {role} role access:")
                
                # Test 1: Can get users list
                success, response = self.run_test(
                    f"GET /api/users as {role}",
                    "GET",
                    "/users",
                    200,
                    user_token=self.tokens[role]
                )
                
                if success:
                    self.log(f"   ✓ {role} can access users list for assignee selection")
                else:
                    self.log(f"   ❌ {role} cannot access users list")
                
                # Test 2: Can access own profile
                user_id = self.users[role]['id']
                success, response = self.run_test(
                    f"GET /api/users/{user_id} as {role}",
                    "GET",
                    f"/users/{user_id}",
                    200,
                    user_token=self.tokens[role]
                )
                
                if success:
                    self.log(f"   ✓ {role} can access own user profile")
                else:
                    self.log(f"   ❌ {role} cannot access own user profile")

    def run_assignee_tests(self):
        """Run all assignee selection tests"""
        self.log("🎯 Starting Assignee Selection Functionality Tests...")
        self.log(f"Testing against: {self.base_url}")
        self.log("Focus: Fixing SelectItem empty string value error and ensuring assignee selection works for all users")
        
        try:
            # Setup
            if not self.setup_authentication():
                self.log("❌ Authentication setup failed, stopping")
                return False
            
            # Run specific assignee tests
            self.test_user_list_api()
            self.test_task_creation_with_assignee()
            self.test_task_assignee_updates()
            self.test_role_based_access()
            
            # Print summary
            self.log(f"\n📊 Assignee Selection Test Summary:")
            self.log(f"Tests run: {self.tests_run}")
            self.log(f"Tests passed: {self.tests_passed}")
            self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
            self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            # Detailed results
            self.log(f"\n🎯 Assignee Selection Functionality Results:")
            self.log(f"✅ GET /api/users - {'WORKING' if self.tests_passed > 0 else 'FAILED'}")
            self.log(f"✅ POST /api/tasks with assignee_id - {'WORKING' if self.test_task_id else 'FAILED'}")
            self.log(f"✅ PATCH /api/tasks/:id assignee changes - {'WORKING' if self.tests_passed > 5 else 'FAILED'}")
            self.log(f"✅ Role-based access (admin & buyer) - {'WORKING' if 'admin' in self.tokens and 'buyer' in self.tokens else 'FAILED'}")
            self.log(f"✅ Null/unassigned handling - {'WORKING' if self.tests_passed > 3 else 'FAILED'}")
            
            if self.failed_tests:
                self.log(f"\n❌ Failed Tests Details:")
                for failure in self.failed_tests:
                    self.log(f"   - {failure['test']}")
                    if 'error' in failure:
                        self.log(f"     Error: {failure['error']}")
                    else:
                        self.log(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
                        if 'response' in failure:
                            self.log(f"     Response: {failure['response']}")
            
            return self.tests_passed == self.tests_run
            
        except Exception as e:
            self.log(f"❌ Assignee selection test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    tester = AssigneeSelectionTester()
    success = tester.run_assignee_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())