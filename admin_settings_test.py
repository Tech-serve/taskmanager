#!/usr/bin/env python3
"""
AdminSettings Fixes Testing
Tests the specific fixes mentioned in the review request:
1. Board Visibility Settings API (PATCH /api/boards/{board_id}/visibility)
2. Group Data Integrity (verify proper group names)
3. User Creation with Department Selection (POST /api/admin/users)
4. Department/Group CRUD Operations (/api/admin/ endpoints)
"""
import requests
import sys
import json
from datetime import datetime

class AdminSettingsTester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.ceo_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log(self, message):
        """Log test messages"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_base}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.ceo_token:
            test_headers['Authorization'] = f'Bearer {self.ceo_token}'
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

    def authenticate_ceo(self):
        """Authenticate as CEO for admin-level access"""
        self.log("\n🔐 Authenticating as CEO...")
        
        success, response = self.run_test(
            "CEO Login",
            "POST",
            "/auth/login",
            200,
            data={"email": "ceo@company.com", "password": "ceo123"}
        )
        
        if success and 'access_token' in response:
            self.ceo_token = response['access_token']
            self.log(f"   ✓ CEO authenticated successfully")
            return True
        else:
            self.log(f"   ❌ CEO authentication failed")
            return False

    def test_group_data_integrity(self):
        """Test that database contains proper group names"""
        self.log("\n📊 Testing Group Data Integrity...")
        
        success, response = self.run_test(
            "Get all groups",
            "GET",
            "/admin/groups",
            200
        )
        
        if success:
            groups = response
            self.log(f"   ✓ Retrieved {len(groups)} groups")
            
            # Check for proper group names
            group_names = [group['name'] for group in groups]
            self.log(f"   → Group names found: {group_names}")
            
            # Verify proper group names exist
            expected_groups = ['Buyers Gambling', 'Buyers Sweep']
            found_proper_groups = []
            
            for expected in expected_groups:
                if expected in group_names:
                    found_proper_groups.append(expected)
                    self.log(f"   ✅ Found proper group: '{expected}'")
                else:
                    self.log(f"   ❌ Missing proper group: '{expected}'")
            
            # Check for bad group names (cyrillic text, 'alpha beta' pattern, empty names)
            bad_patterns = ['alpha beta', 'альфа', 'бета']
            found_bad_groups = []
            
            for group_name in group_names:
                # Check for cyrillic characters or specific bad patterns
                has_cyrillic = any(ord(char) > 127 for char in group_name)
                has_bad_pattern = any(bad in group_name.lower() for bad in bad_patterns)
                is_empty = not group_name.strip()
                
                if has_cyrillic or has_bad_pattern or is_empty:
                    found_bad_groups.append(group_name)
                    self.log(f"   ❌ Found bad group name: '{group_name}'")
            
            if len(found_proper_groups) >= 2 and len(found_bad_groups) == 0:
                self.log(f"   ✅ Group data integrity PASSED - proper names found, no bad names")
                return True
            else:
                self.log(f"   ❌ Group data integrity FAILED - {len(found_proper_groups)}/2 proper groups, {len(found_bad_groups)} bad groups")
                return False
        else:
            self.log(f"   ❌ Failed to retrieve groups")
            return False

    def test_department_crud(self):
        """Test Department CRUD operations"""
        self.log("\n🏢 Testing Department CRUD Operations...")
        
        # Test 1: Get all departments
        success, response = self.run_test(
            "Get all departments",
            "GET",
            "/admin/departments",
            200
        )
        
        if success:
            departments = response
            self.log(f"   ✓ Retrieved {len(departments)} departments")
            dept_names = [dept['name'] for dept in departments]
            self.log(f"   → Department names: {dept_names}")
        else:
            self.log(f"   ❌ Failed to get departments")
            return False
        
        # Test 2: Create new department with unique name
        import uuid
        unique_suffix = str(uuid.uuid4())[:8]
        new_dept_data = {
            "name": f"Test Department AdminSettings {unique_suffix}",
            "type": "office"
        }
        
        success, response = self.run_test(
            "Create new department",
            "POST",
            "/admin/departments",
            201,
            data=new_dept_data
        )
        
        created_dept_id = None
        if success and 'id' in response:
            created_dept_id = response['id']
            self.log(f"   ✓ Created department with ID: {created_dept_id}")
            self.log(f"   → Department name: {response.get('name')}")
        else:
            self.log(f"   ❌ Failed to create department")
        
        # Test 3: Try to create duplicate department (should fail)
        self.run_test(
            "Create duplicate department (should fail)",
            "POST",
            "/admin/departments",
            400,
            data=new_dept_data
        )
        
        return created_dept_id is not None

    def test_group_crud(self):
        """Test Group CRUD operations"""
        self.log("\n👥 Testing Group CRUD Operations...")
        
        # First get departments to use for group creation
        success, departments = self.run_test(
            "Get departments for group creation",
            "GET",
            "/admin/departments",
            200
        )
        
        if not success or not departments:
            self.log(f"   ❌ Cannot test groups without departments")
            return False
        
        dept_id = departments[0]['id']
        
        # Test 1: Get all groups
        success, response = self.run_test(
            "Get all groups",
            "GET",
            "/admin/groups",
            200
        )
        
        if success:
            groups = response
            self.log(f"   ✓ Retrieved {len(groups)} groups")
        else:
            self.log(f"   ❌ Failed to get groups")
            return False
        
        # Test 2: Create new group with unique name
        import uuid
        unique_suffix = str(uuid.uuid4())[:8]
        new_group_data = {
            "name": f"Test Group AdminSettings {unique_suffix}",
            "department_id": dept_id,
            "member_ids": []
        }
        
        success, response = self.run_test(
            "Create new group",
            "POST",
            "/admin/groups",
            201,
            data=new_group_data
        )
        
        created_group_id = None
        if success and 'id' in response:
            created_group_id = response['id']
            self.log(f"   ✓ Created group with ID: {created_group_id}")
            self.log(f"   → Group name: {response.get('name')}")
            self.log(f"   → Department ID: {response.get('department_id')}")
        else:
            self.log(f"   ❌ Failed to create group")
        
        return created_group_id is not None

    def test_user_creation_with_department(self):
        """Test user creation with proper null handling for 'No Department' selection"""
        self.log("\n👤 Testing User Creation with Department Selection...")
        
        # Test 1: Create user with no department (null handling) with unique email
        import uuid
        unique_suffix = str(uuid.uuid4())[:8]
        user_data_no_dept = {
            "email": f"testuser.nodept.{unique_suffix}@company.com",
            "password": "testpass123",
            "full_name": "Test User No Department",
            "roles": [{"role": "buyer", "department_id": None}],
            "primary_department_id": None
        }
        
        success, response = self.run_test(
            "Create user with no department",
            "POST",
            "/admin/users",
            201,
            data=user_data_no_dept
        )
        
        created_user_id_1 = None
        if success and 'id' in response:
            created_user_id_1 = response['id']
            self.log(f"   ✅ Created user with no department - ID: {created_user_id_1}")
            self.log(f"   → Email: {response.get('email')}")
            self.log(f"   → Primary Department: {response.get('primary_department_id')}")
        else:
            self.log(f"   ❌ Failed to create user with no department")
        
        # Test 2: Get departments for user creation with department
        success, departments = self.run_test(
            "Get departments for user creation",
            "GET",
            "/admin/departments",
            200
        )
        
        if success and departments:
            dept_id = departments[0]['id']
            
            # Test 3: Create user with department with unique email
            user_data_with_dept = {
                "email": f"testuser.withdept.{unique_suffix}@company.com",
                "password": "testpass456",
                "full_name": "Test User With Department",
                "roles": [{"role": "buyer", "department_id": dept_id}],
                "primary_department_id": dept_id
            }
            
            success, response = self.run_test(
                "Create user with department",
                "POST",
                "/admin/users",
                201,
                data=user_data_with_dept
            )
            
            created_user_id_2 = None
            if success and 'id' in response:
                created_user_id_2 = response['id']
                self.log(f"   ✅ Created user with department - ID: {created_user_id_2}")
                self.log(f"   → Email: {response.get('email')}")
                self.log(f"   → Primary Department: {response.get('primary_department_id')}")
            else:
                self.log(f"   ❌ Failed to create user with department")
        
        # Test 4: Test validation - missing required fields
        invalid_user_data = {
            "email": "invalid@company.com"
            # Missing required fields
        }
        
        self.run_test(
            "Create user with missing fields (should fail)",
            "POST",
            "/admin/users",
            422,  # Validation error
            data=invalid_user_data
        )
        
        # Test 5: Test duplicate email validation
        if created_user_id_1:
            duplicate_user_data = {
                "email": f"testuser.nodept.{unique_suffix}@company.com",  # Same email as first user
                "password": "testpass789",
                "full_name": "Duplicate User",
                "roles": [{"role": "designer", "department_id": None}]
            }
            
            self.run_test(
                "Create user with duplicate email (should fail)",
                "POST",
                "/admin/users",
                400,
                data=duplicate_user_data
            )
        
        return created_user_id_1 is not None

    def test_board_visibility_settings(self):
        """Test Board Visibility Settings API"""
        self.log("\n👁️ Testing Board Visibility Settings API...")
        
        # First get all boards to find one to test with
        success, boards = self.run_test(
            "Get all boards",
            "GET",
            "/boards",
            200
        )
        
        if not success or not boards:
            self.log(f"   ❌ Cannot test board visibility without boards")
            return False
        
        # Use first board for testing
        test_board = boards[0]
        board_id = test_board['id']
        board_key = test_board['key']
        
        self.log(f"   → Testing with board: {board_key} (ID: {board_id})")
        
        # Get users and groups for visibility testing
        success, users = self.run_test(
            "Get users for visibility testing",
            "GET",
            "/users",
            200
        )
        
        success, groups = self.run_test(
            "Get groups for visibility testing",
            "GET",
            "/admin/groups",
            200
        )
        
        if not users or not groups:
            self.log(f"   ❌ Need users and groups for visibility testing")
            return False
        
        user_ids = [user['id'] for user in users[:3]]  # Use first 3 users
        group_ids = [group['id'] for group in groups[:2]]  # Use first 2 groups
        
        # Test 1: Set board visibility to 'users' mode
        users_visibility_data = {
            "visibility": {
                "mode": "users",
                "allowed_user_ids": user_ids,
                "allowed_group_ids": [],  # Should be empty for users mode
                "permissions": {
                    "read": True,
                    "create": True,
                    "edit": True,
                    "manage": False
                }
            }
        }
        
        success, response = self.run_test(
            "Set board visibility to 'users' mode",
            "PATCH",
            f"/boards/{board_id}/visibility",
            200,
            data=users_visibility_data
        )
        
        if success:
            self.log(f"   ✅ Board visibility set to 'users' mode")
            visibility = response.get('visibility', {})
            self.log(f"   → Mode: {visibility.get('mode')}")
            self.log(f"   → Allowed users: {len(visibility.get('allowed_user_ids', []))}")
            self.log(f"   → Allowed groups: {len(visibility.get('allowed_group_ids', []))}")
        else:
            self.log(f"   ❌ Failed to set board visibility to 'users' mode")
        
        # Test 2: Set board visibility to 'groups' mode
        groups_visibility_data = {
            "visibility": {
                "mode": "groups",
                "allowed_user_ids": [],  # Should be empty for groups mode
                "allowed_group_ids": group_ids,
                "permissions": {
                    "read": True,
                    "create": True,
                    "edit": False,
                    "manage": False
                }
            }
        }
        
        success, response = self.run_test(
            "Set board visibility to 'groups' mode",
            "PATCH",
            f"/boards/{board_id}/visibility",
            200,
            data=groups_visibility_data
        )
        
        if success:
            self.log(f"   ✅ Board visibility set to 'groups' mode")
            visibility = response.get('visibility', {})
            self.log(f"   → Mode: {visibility.get('mode')}")
            self.log(f"   → Allowed users: {len(visibility.get('allowed_user_ids', []))}")
            self.log(f"   → Allowed groups: {len(visibility.get('allowed_group_ids', []))}")
        else:
            self.log(f"   ❌ Failed to set board visibility to 'groups' mode")
        
        # Test 3: Test validation - users mode with group IDs (should fail)
        invalid_users_mode_data = {
            "visibility": {
                "mode": "users",
                "allowed_user_ids": user_ids,
                "allowed_group_ids": group_ids  # Invalid - should be empty for users mode
            }
        }
        
        self.run_test(
            "Invalid users mode with group IDs (should fail)",
            "PATCH",
            f"/boards/{board_id}/visibility",
            400,
            data=invalid_users_mode_data
        )
        
        # Test 4: Test validation - groups mode with user IDs (should fail)
        invalid_groups_mode_data = {
            "visibility": {
                "mode": "groups",
                "allowed_user_ids": user_ids,  # Invalid - should be empty for groups mode
                "allowed_group_ids": group_ids
            }
        }
        
        self.run_test(
            "Invalid groups mode with user IDs (should fail)",
            "PATCH",
            f"/boards/{board_id}/visibility",
            400,
            data=invalid_groups_mode_data
        )
        
        # Test 5: Test with non-existent board ID
        self.run_test(
            "Update visibility for non-existent board (should fail)",
            "PATCH",
            "/boards/non-existent-board-id/visibility",
            404,
            data=users_visibility_data
        )
        
        return True

    def run_all_tests(self):
        """Run all AdminSettings tests"""
        self.log("🚀 Starting AdminSettings Fixes Testing...")
        self.log(f"Testing against: {self.base_url}")
        
        try:
            # Authenticate as CEO
            if not self.authenticate_ceo():
                self.log("❌ CEO authentication failed, stopping")
                return False
            
            # Run test suites
            self.test_group_data_integrity()
            self.test_department_crud()
            self.test_group_crud()
            self.test_user_creation_with_department()
            self.test_board_visibility_settings()
            
            # Print summary
            self.log(f"\n📊 AdminSettings Test Summary:")
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
    tester = AdminSettingsTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())