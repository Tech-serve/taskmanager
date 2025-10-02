#!/usr/bin/env python3
"""
Task Creation Debug Test - Focused testing for task creation failure
Debug task creation failure - "Failed to create task: Unknown error"
"""
import requests
import sys
import json
from datetime import datetime

class TaskCreationDebugger:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.boards = {}
        self.columns = {}
        self.departments = {}
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
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=30)

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
                self.log(f"   Response: {response.text[:500]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                return False, response.text

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, str(e)

    def setup_authentication(self):
        """Setup authentication for different user roles"""
        self.log("\n🔐 Setting up Authentication...")
        
        # Test users from the new ACL system
        test_users = [
            {"email": "ceo@company.com", "password": "ceo123", "role": "ceo"},
            {"email": "buyer@company.com", "password": "buyer123", "role": "buyer"},
            {"email": "designer@company.com", "password": "designer123", "role": "designer"},
            {"email": "tech@company.com", "password": "tech123", "role": "tech"},
            {"email": "lead@company.com", "password": "lead123", "role": "lead"},
            {"email": "head@company.com", "password": "head123", "role": "head"}
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
                self.log(f"   ✓ Got token for {user_data['role']}: {user_data['email']}")
                
                # Log user structure for debugging
                user_info = response['user']
                self.log(f"   → User ID: {user_info.get('id')}")
                self.log(f"   → Roles: {user_info.get('roles', [])}")
                self.log(f"   → Primary Dept: {user_info.get('primary_department_id', 'None')}")
            else:
                self.log(f"   ❌ Failed to get token for {user_data['role']}")

    def get_boards_and_columns(self):
        """Get boards and columns for each user"""
        self.log("\n📋 Getting Boards and Columns...")
        
        for role, token in self.tokens.items():
            # Get boards
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
                self.log(f"   ✓ {role} can access boards: {board_keys}")
                
                # Get columns for each board
                for board in boards:
                    board_id = board['id']
                    board_key = board['key']
                    
                    success, response = self.run_test(
                        f"Get columns for {board_key} as {role}",
                        "GET",
                        f"/boards/{board_id}/columns",
                        200,
                        user_token=token
                    )
                    
                    if success:
                        columns = response
                        if role not in self.columns:
                            self.columns[role] = {}
                        self.columns[role][board_key] = columns
                        column_names = [col['name'] for col in columns]
                        self.log(f"   → {board_key} columns: {column_names}")

    def get_departments(self):
        """Get departments for department_id field"""
        self.log("\n🏢 Getting Departments...")
        
        # Try to get departments as CEO (should have admin access)
        if 'ceo' in self.tokens:
            success, response = self.run_test(
                "Get departments as CEO",
                "GET",
                "/admin/departments",
                200,
                user_token=self.tokens['ceo']
            )
            
            if success:
                departments = response
                self.departments = {dept['id']: dept for dept in departments}
                dept_names = [dept['name'] for dept in departments]
                self.log(f"   ✓ Found departments: {dept_names}")
                for dept in departments:
                    self.log(f"   → {dept['name']}: {dept['id']} (type: {dept.get('type', 'N/A')})")
            else:
                self.log(f"   ❌ Failed to get departments")

    def test_task_creation_comprehensive(self):
        """Comprehensive task creation testing"""
        self.log("\n➕ COMPREHENSIVE TASK CREATION TESTING...")
        
        # Test boards to focus on
        test_boards = ['GAM_BUY', 'SWE_BUY', 'TECH', 'EXPENSES']
        
        for role, token in self.tokens.items():
            self.log(f"\n🔍 Testing task creation as {role}...")
            
            if role not in self.boards or not self.boards[role]:
                self.log(f"   ❌ No boards available for {role}")
                continue
            
            user_info = self.users[role]
            user_id = user_info['id']
            user_roles = user_info.get('roles', [])
            primary_dept = user_info.get('primary_department_id')
            
            self.log(f"   → User ID: {user_id}")
            self.log(f"   → User roles: {user_roles}")
            self.log(f"   → Primary department: {primary_dept}")
            
            # Test on each accessible board
            for board in self.boards[role]:
                board_key = board['key']
                board_id = board['id']
                
                if board_key not in test_boards:
                    continue
                
                self.log(f"\n   📋 Testing on board: {board_key}")
                
                # Get columns for this board
                if role in self.columns and board_key in self.columns[role]:
                    columns = self.columns[role][board_key]
                    if not columns:
                        self.log(f"   ❌ No columns found for {board_key}")
                        continue
                    
                    first_column = columns[0]
                    column_id = first_column['id']
                    column_name = first_column['name']
                    
                    self.log(f"   → Using column: {column_name} ({column_id})")
                    
                    # Determine department_id based on board and user
                    department_id = None
                    if primary_dept:
                        department_id = primary_dept
                    elif self.departments:
                        # Try to match department based on board
                        if 'GAM' in board_key:
                            dept_id = next((d['id'] for d in self.departments.values() if d.get('type') == 'gambling'), None)
                            if dept_id:
                                department_id = dept_id
                        elif 'SWE' in board_key:
                            dept_id = next((d['id'] for d in self.departments.values() if d.get('type') == 'sweeps'), None)
                            if dept_id:
                                department_id = dept_id
                        elif board_key == 'TECH':
                            dept_id = next((d['id'] for d in self.departments.values() if d.get('type') == 'tech'), None)
                            if dept_id:
                                department_id = dept_id
                        elif board_key == 'EXPENSES':
                            dept_id = next((d['id'] for d in self.departments.values() if d.get('type') == 'office'), None)
                            if dept_id:
                                department_id = dept_id
                    
                    # If still no department_id, use first available department
                    if not department_id and self.departments:
                        department_id = list(self.departments.keys())[0]
                    
                    self.log(f"   → Using department_id: {department_id}")
                    
                    # Test 1: Basic task creation
                    task_data = {
                        "board_key": board_key,
                        "column_id": column_id,
                        "title": f"Test Task by {role} on {board_key}",
                        "description": f"Test task created by {role} user for debugging",
                        "priority": "medium"
                    }
                    
                    # Add department_id if we have one
                    if department_id:
                        task_data["department_id"] = department_id
                    
                    # Add amount for expense boards
                    if board_key == 'EXPENSES':
                        task_data["amount"] = 150.75
                        task_data["category"] = "office_supplies"
                    
                    success, response = self.run_test(
                        f"Create basic task on {board_key} as {role}",
                        "POST",
                        "/tasks",
                        201,
                        data=task_data,
                        user_token=token
                    )
                    
                    if success and isinstance(response, dict) and 'id' in response:
                        task_id = response['id']
                        self.log(f"   ✅ Created task: {task_id}")
                        self.log(f"   → Title: {response.get('title', 'N/A')}")
                        self.log(f"   → Creator: {response.get('creator_id', 'N/A')}")
                        self.log(f"   → Department: {response.get('department_id', 'N/A')}")
                        
                        # Test 2: Task creation with assignee
                        task_data_with_assignee = task_data.copy()
                        task_data_with_assignee["title"] = f"Test Task with Assignee by {role}"
                        task_data_with_assignee["assignee_id"] = user_id  # Assign to self
                        
                        success2, response2 = self.run_test(
                            f"Create task with assignee on {board_key} as {role}",
                            "POST",
                            "/tasks",
                            201,
                            data=task_data_with_assignee,
                            user_token=token
                        )
                        
                        if success2 and isinstance(response2, dict) and 'id' in response2:
                            self.log(f"   ✅ Created task with assignee: {response2['id']}")
                            self.log(f"   → Assignee: {response2.get('assignee_id', 'N/A')}")
                        
                        # Test 3: Task creation with null assignee
                        task_data_null_assignee = task_data.copy()
                        task_data_null_assignee["title"] = f"Test Task null assignee by {role}"
                        task_data_null_assignee["assignee_id"] = None
                        
                        success3, response3 = self.run_test(
                            f"Create task with null assignee on {board_key} as {role}",
                            "POST",
                            "/tasks",
                            201,
                            data=task_data_null_assignee,
                            user_token=token
                        )
                        
                        if success3 and isinstance(response3, dict) and 'id' in response3:
                            self.log(f"   ✅ Created task with null assignee: {response3['id']}")
                    
                    else:
                        self.log(f"   ❌ Failed to create basic task on {board_key}")
                        self.log(f"   → Response: {str(response)[:200]}")
                        
                        # Try without department_id to see if that's the issue
                        if department_id:
                            task_data_no_dept = task_data.copy()
                            del task_data_no_dept["department_id"]
                            
                            success_no_dept, response_no_dept = self.run_test(
                                f"Create task WITHOUT department_id on {board_key} as {role}",
                                "POST",
                                "/tasks",
                                201,
                                data=task_data_no_dept,
                                user_token=token
                            )
                            
                            if success_no_dept:
                                self.log(f"   ⚠️  Task creation works WITHOUT department_id - this is the issue!")
                            else:
                                self.log(f"   ❌ Task creation still fails without department_id")

    def test_validation_edge_cases(self):
        """Test validation edge cases that might cause 'Unknown error'"""
        self.log("\n🔍 TESTING VALIDATION EDGE CASES...")
        
        if 'ceo' not in self.tokens:
            self.log("   ❌ No CEO token available for validation tests")
            return
        
        token = self.tokens['ceo']
        
        # Get a board and column for testing
        if 'ceo' not in self.boards or not self.boards['ceo']:
            self.log("   ❌ No boards available for CEO")
            return
        
        board = self.boards['ceo'][0]
        board_key = board['key']
        
        if 'ceo' not in self.columns or board_key not in self.columns['ceo']:
            self.log(f"   ❌ No columns available for {board_key}")
            return
        
        columns = self.columns['ceo'][board_key]
        if not columns:
            self.log(f"   ❌ No columns found for {board_key}")
            return
        
        column_id = columns[0]['id']
        department_id = list(self.departments.keys())[0] if self.departments else None
        
        # Test 1: Missing required fields
        test_cases = [
            {
                "name": "Missing board_key",
                "data": {
                    "column_id": column_id,
                    "title": "Test Task",
                    "department_id": department_id
                },
                "expected": 422
            },
            {
                "name": "Missing column_id", 
                "data": {
                    "board_key": board_key,
                    "title": "Test Task",
                    "department_id": department_id
                },
                "expected": 422
            },
            {
                "name": "Missing title",
                "data": {
                    "board_key": board_key,
                    "column_id": column_id,
                    "department_id": department_id
                },
                "expected": 422
            },
            {
                "name": "Missing department_id",
                "data": {
                    "board_key": board_key,
                    "column_id": column_id,
                    "title": "Test Task"
                },
                "expected": 422
            },
            {
                "name": "Invalid column_id",
                "data": {
                    "board_key": board_key,
                    "column_id": "invalid-column-id",
                    "title": "Test Task",
                    "department_id": department_id
                },
                "expected": 404
            },
            {
                "name": "Invalid board_key",
                "data": {
                    "board_key": "INVALID_BOARD",
                    "column_id": column_id,
                    "title": "Test Task",
                    "department_id": department_id
                },
                "expected": 403
            },
            {
                "name": "Invalid assignee_id",
                "data": {
                    "board_key": board_key,
                    "column_id": column_id,
                    "title": "Test Task",
                    "department_id": department_id,
                    "assignee_id": "invalid-user-id"
                },
                "expected": 201  # Backend might not validate assignee_id existence
            }
        ]
        
        for test_case in test_cases:
            success, response = self.run_test(
                f"Validation test: {test_case['name']}",
                "POST",
                "/tasks",
                test_case['expected'],
                data=test_case['data'],
                user_token=token
            )
            
            if not success:
                self.log(f"   → Validation response: {str(response)[:200]}")

    def test_user_role_structure_compatibility(self):
        """Test if new User model RoleRef structure breaks validation"""
        self.log("\n🔍 TESTING USER ROLE STRUCTURE COMPATIBILITY...")
        
        for role, user_info in self.users.items():
            self.log(f"\n   👤 Analyzing {role} user structure:")
            self.log(f"   → ID: {user_info.get('id')}")
            self.log(f"   → Email: {user_info.get('email')}")
            self.log(f"   → Full Name: {user_info.get('full_name')}")
            self.log(f"   → Roles: {user_info.get('roles', [])}")
            self.log(f"   → Groups: {user_info.get('groups', [])}")
            self.log(f"   → Primary Department: {user_info.get('primary_department_id')}")
            
            # Check role structure
            roles = user_info.get('roles', [])
            for i, role_ref in enumerate(roles):
                if isinstance(role_ref, dict):
                    self.log(f"   → Role {i}: {role_ref}")
                    if 'role' not in role_ref:
                        self.log(f"   ⚠️  Role {i} missing 'role' field!")
                else:
                    self.log(f"   → Role {i}: {role_ref} (not dict structure)")

    def run_debug_tests(self):
        """Run all debug tests"""
        self.log("🚀 Starting Task Creation Debug Tests...")
        self.log(f"Testing against: {self.base_url}")
        
        try:
            # Setup
            self.setup_authentication()
            if not self.tokens:
                self.log("❌ No authentication tokens available, stopping")
                return False
            
            self.get_departments()
            self.get_boards_and_columns()
            
            # Debug tests
            self.test_user_role_structure_compatibility()
            self.test_validation_edge_cases()
            self.test_task_creation_comprehensive()
            
            # Print summary
            self.log(f"\n📊 Debug Test Summary:")
            self.log(f"Tests run: {self.tests_run}")
            self.log(f"Tests passed: {self.tests_passed}")
            self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
            self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            if self.failed_tests:
                self.log(f"\n❌ Failed Tests (Potential Issues):")
                for failure in self.failed_tests:
                    self.log(f"   - {failure['test']}")
                    if 'error' in failure:
                        self.log(f"     Error: {failure['error']}")
                    else:
                        self.log(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
                        if 'response' in failure:
                            self.log(f"     Response: {failure['response'][:200]}")
            
            return True
            
        except Exception as e:
            self.log(f"❌ Debug test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    debugger = TaskCreationDebugger()
    success = debugger.run_debug_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())