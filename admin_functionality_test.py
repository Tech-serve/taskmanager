#!/usr/bin/env python3
"""
Admin Functionality Testing for Simplified Jira Application
Tests Group CRUD, Board Creation, Board Visibility Settings, and Department Users Lookup
"""
import requests
import sys
import json
from datetime import datetime

class AdminFunctionalityTester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.ceo_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_resources = {
            'groups': [],
            'boards': [],
            'departments': []
        }

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
        """Authenticate as CEO for admin access"""
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
            self.log(f"   → CEO: {response['user']['full_name']}")
            return True
        else:
            self.log(f"   ❌ CEO authentication failed")
            return False

    def test_group_crud_operations(self):
        """Test Group CRUD Operations"""
        self.log("\n👥 Testing Group CRUD Operations...")
        
        # First, get existing groups to understand the structure
        success, response = self.run_test(
            "Get existing groups",
            "GET",
            "/admin/groups",
            200
        )
        
        existing_groups = []
        if success:
            existing_groups = response
            self.log(f"   ✓ Found {len(existing_groups)} existing groups")
            for group in existing_groups[:3]:  # Show first 3
                self.log(f"   → Group: {group.get('name', 'N/A')} (ID: {group.get('id', 'N/A')})")
        
        # Get departments for group creation
        success, response = self.run_test(
            "Get departments for group creation",
            "GET",
            "/admin/departments",
            200
        )
        
        departments = []
        if success:
            departments = response
            self.log(f"   ✓ Found {len(departments)} departments")
        
        if not departments:
            self.log(f"   ❌ No departments found - cannot test group creation")
            return False
        
        # Test 1: Create new group
        test_group_data = {
            "name": f"Test Admin Group {datetime.now().strftime('%H%M%S')}",
            "department_id": departments[0]['id'],
            "lead_user_id": None,
            "member_ids": []
        }
        
        success, response = self.run_test(
            "Create new group",
            "POST",
            "/admin/groups",
            201,
            data=test_group_data
        )
        
        created_group_id = None
        if success and 'id' in response:
            created_group_id = response['id']
            self.created_resources['groups'].append(created_group_id)
            self.log(f"   ✓ Created group with ID: {created_group_id}")
            self.log(f"   → Group name: {response.get('name', 'N/A')}")
            self.log(f"   → Department ID: {response.get('department_id', 'N/A')}")
        
        # Test 2: Update group (PUT /api/admin/groups/{group_id})
        if created_group_id:
            updated_group_data = {
                "name": f"Updated Test Group {datetime.now().strftime('%H%M%S')}",
                "department_id": departments[0]['id'],
                "lead_user_id": None,
                "member_ids": []
            }
            
            success, response = self.run_test(
                "Update group name and details",
                "PUT",
                f"/admin/groups/{created_group_id}",
                200,
                data=updated_group_data
            )
            
            if success:
                self.log(f"   ✓ Updated group successfully")
                self.log(f"   → New name: {response.get('name', 'N/A')}")
            
            # Test updating with members (if we have users)
            success, users_response = self.run_test(
                "Get users for group member test",
                "GET",
                "/users",
                200
            )
            
            if success and users_response:
                # Add first user as member
                user_ids = [user['id'] for user in users_response[:2]]  # Take first 2 users
                
                updated_group_with_members = {
                    "name": updated_group_data['name'],
                    "department_id": departments[0]['id'],
                    "lead_user_id": user_ids[0] if user_ids else None,
                    "member_ids": user_ids
                }
                
                success, response = self.run_test(
                    "Update group with lead and members",
                    "PUT",
                    f"/admin/groups/{created_group_id}",
                    200,
                    data=updated_group_with_members
                )
                
                if success:
                    self.log(f"   ✓ Updated group with members successfully")
                    self.log(f"   → Lead user ID: {response.get('lead_user_id', 'N/A')}")
                    self.log(f"   → Member count: {len(response.get('member_ids', []))}")
        
        # Test 3: Delete group (DELETE /api/admin/groups/{group_id})
        if created_group_id:
            success, response = self.run_test(
                "Delete group",
                "DELETE",
                f"/admin/groups/{created_group_id}",
                200
            )
            
            if success:
                self.log(f"   ✓ Deleted group successfully")
                self.log(f"   → Response: {response.get('message', 'N/A')}")
                
                # Verify group is deleted
                success, response = self.run_test(
                    "Verify group deletion",
                    "GET",
                    "/admin/groups",
                    200
                )
                
                if success:
                    remaining_groups = response
                    group_ids = [g['id'] for g in remaining_groups]
                    if created_group_id not in group_ids:
                        self.log(f"   ✓ Group successfully removed from database")
                    else:
                        self.log(f"   ❌ Group still exists in database")
        
        # Test 4: Test group validation
        invalid_group_data = {
            "name": "",  # Empty name should fail
            "department_id": "invalid-dept-id"
        }
        
        self.run_test(
            "Create group with invalid data (should fail)",
            "POST",
            "/admin/groups",
            400,
            data=invalid_group_data
        )
        
        return True

    def test_board_creation(self):
        """Test Board Creation with visibility settings"""
        self.log("\n📋 Testing Board Creation...")
        
        # Get departments and groups for board creation
        success, departments_response = self.run_test(
            "Get departments for board creation",
            "GET",
            "/admin/departments",
            200
        )
        
        success, groups_response = self.run_test(
            "Get groups for board creation",
            "GET",
            "/admin/groups",
            200
        )
        
        success, users_response = self.run_test(
            "Get users for board creation",
            "GET",
            "/users",
            200
        )
        
        departments = departments_response if departments_response else []
        groups = groups_response if groups_response else []
        users = users_response if users_response else []
        
        # Test 1: Create board with users mode visibility
        board_data_users = {
            "name": f"Test Board Users Mode {datetime.now().strftime('%H%M%S')}",
            "key": f"TEST_USERS_{datetime.now().strftime('%H%M%S')}",
            "type": "tasks",
            "template": "kanban-basic",
            "allowed_roles": ["ceo", "buyer"],
            "allowed_group_ids": [],
            "members": [],
            "owners": []
        }
        
        success, response = self.run_test(
            "Create board with users mode",
            "POST",
            "/boards",
            201,
            data=board_data_users
        )
        
        created_board_users_id = None
        if success and 'id' in response:
            created_board_users_id = response['id']
            self.created_resources['boards'].append(created_board_users_id)
            self.log(f"   ✓ Created board (users mode) with ID: {created_board_users_id}")
            self.log(f"   → Board name: {response.get('name', 'N/A')}")
            self.log(f"   → Board key: {response.get('key', 'N/A')}")
        
        # Test 2: Create board with groups mode visibility
        board_data_groups = {
            "name": f"Test Board Groups Mode {datetime.now().strftime('%H%M%S')}",
            "key": f"TEST_GROUPS_{datetime.now().strftime('%H%M%S')}",
            "type": "tasks",
            "template": "kanban-basic",
            "allowed_roles": ["ceo"],
            "allowed_group_ids": [groups[0]['id']] if groups else [],
            "members": [],
            "owners": []
        }
        
        success, response = self.run_test(
            "Create board with groups mode",
            "POST",
            "/boards",
            201,
            data=board_data_groups
        )
        
        created_board_groups_id = None
        if success and 'id' in response:
            created_board_groups_id = response['id']
            self.created_resources['boards'].append(created_board_groups_id)
            self.log(f"   ✓ Created board (groups mode) with ID: {created_board_groups_id}")
        
        # Test 3: Create board with default department
        if departments:
            board_data_with_dept = {
                "name": f"Test Board With Dept {datetime.now().strftime('%H%M%S')}",
                "key": f"TEST_DEPT_{datetime.now().strftime('%H%M%S')}",
                "type": "expenses",
                "template": "kanban-basic",
                "allowed_roles": ["ceo"],
                "default_department_id": departments[0]['id']
            }
            
            success, response = self.run_test(
                "Create board with default department",
                "POST",
                "/boards",
                201,
                data=board_data_with_dept
            )
            
            if success and 'id' in response:
                created_board_dept_id = response['id']
                self.created_resources['boards'].append(created_board_dept_id)
                self.log(f"   ✓ Created board with department with ID: {created_board_dept_id}")
                self.log(f"   → Default department: {response.get('default_department_id', 'N/A')}")
        
        # Test 4: Test board creation validation
        invalid_board_data = {
            "name": "",  # Empty name
            "key": "",   # Empty key
        }
        
        self.run_test(
            "Create board with invalid data (should fail)",
            "POST",
            "/boards",
            422,  # Validation error
            data=invalid_board_data
        )
        
        # Test 5: Test duplicate key validation
        if created_board_users_id:
            duplicate_key_data = {
                "name": "Duplicate Key Board",
                "key": board_data_users['key'],  # Same key as first board
                "type": "tasks"
            }
            
            self.run_test(
                "Create board with duplicate key (should fail)",
                "POST",
                "/boards",
                400,
                data=duplicate_key_data
            )
        
        return True

    def test_board_visibility_settings(self):
        """Test Board Visibility Settings Save (PATCH /api/boards/{board_id}/visibility)"""
        self.log("\n🔒 Testing Board Visibility Settings...")
        
        # Get existing boards to test visibility updates
        success, response = self.run_test(
            "Get existing boards for visibility testing",
            "GET",
            "/boards",
            200
        )
        
        boards = []
        if success:
            boards = response
            self.log(f"   ✓ Found {len(boards)} boards for visibility testing")
        
        if not boards:
            self.log(f"   ❌ No boards found for visibility testing")
            return False
        
        test_board = boards[0]
        board_id = test_board['id']
        
        # Get users and groups for visibility settings
        success, users_response = self.run_test(
            "Get users for visibility settings",
            "GET",
            "/users",
            200
        )
        
        success, groups_response = self.run_test(
            "Get groups for visibility settings",
            "GET",
            "/admin/groups",
            200
        )
        
        users = users_response if users_response else []
        groups = groups_response if groups_response else []
        
        # Test 1: Update board visibility to users mode
        if users:
            user_ids = [user['id'] for user in users[:3]]  # Take first 3 users
            
            visibility_users_data = {
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
                "Update board visibility to users mode",
                "PATCH",
                f"/boards/{board_id}/visibility",
                200,
                data=visibility_users_data
            )
            
            if success:
                self.log(f"   ✓ Updated board visibility to users mode")
                visibility = response.get('visibility', {})
                self.log(f"   → Mode: {visibility.get('mode', 'N/A')}")
                self.log(f"   → Allowed users count: {len(visibility.get('allowed_user_ids', []))}")
                self.log(f"   → Allowed groups count: {len(visibility.get('allowed_group_ids', []))}")
        
        # Test 2: Update board visibility to groups mode
        if groups:
            group_ids = [group['id'] for group in groups[:2]]  # Take first 2 groups
            
            visibility_groups_data = {
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
                "Update board visibility to groups mode",
                "PATCH",
                f"/boards/{board_id}/visibility",
                200,
                data=visibility_groups_data
            )
            
            if success:
                self.log(f"   ✓ Updated board visibility to groups mode")
                visibility = response.get('visibility', {})
                self.log(f"   → Mode: {visibility.get('mode', 'N/A')}")
                self.log(f"   → Allowed users count: {len(visibility.get('allowed_user_ids', []))}")
                self.log(f"   → Allowed groups count: {len(visibility.get('allowed_group_ids', []))}")
        
        # Test 3: Test validation - groups mode with user IDs (should fail)
        invalid_visibility_data = {
            "visibility": {
                "mode": "groups",
                "allowed_user_ids": [users[0]['id']] if users else ["test-user-id"],
                "allowed_group_ids": [groups[0]['id']] if groups else ["test-group-id"]
            }
        }
        
        self.run_test(
            "Update visibility with invalid mode/data combination (should fail)",
            "PATCH",
            f"/boards/{board_id}/visibility",
            400,
            data=invalid_visibility_data
        )
        
        # Test 4: Test validation - users mode with group IDs (should fail)
        invalid_visibility_data_2 = {
            "visibility": {
                "mode": "users",
                "allowed_user_ids": [users[0]['id']] if users else ["test-user-id"],
                "allowed_group_ids": [groups[0]['id']] if groups else ["test-group-id"]
            }
        }
        
        self.run_test(
            "Update visibility users mode with group IDs (should fail)",
            "PATCH",
            f"/boards/{board_id}/visibility",
            400,
            data=invalid_visibility_data_2
        )
        
        # Test 5: Test with non-existent board ID
        self.run_test(
            "Update visibility for non-existent board (should fail)",
            "PATCH",
            "/boards/non-existent-board-id/visibility",
            404,
            data=visibility_users_data
        )
        
        return True

    def test_department_users_lookup(self):
        """Test Department Users Lookup (GET /api/admin/users filtered by department)"""
        self.log("\n🏢 Testing Department Users Lookup...")
        
        # Get all users first
        success, response = self.run_test(
            "Get all users for department filtering",
            "GET",
            "/users",
            200
        )
        
        all_users = []
        if success:
            all_users = response
            self.log(f"   ✓ Found {len(all_users)} total users")
        
        # Get departments
        success, response = self.run_test(
            "Get departments for user lookup",
            "GET",
            "/admin/departments",
            200
        )
        
        departments = []
        if success:
            departments = response
            self.log(f"   ✓ Found {len(departments)} departments")
        
        # Test 1: Verify user data structure includes proper roles and group memberships
        if all_users:
            sample_user = all_users[0]
            self.log(f"   → Sample user structure:")
            self.log(f"     - ID: {sample_user.get('id', 'N/A')}")
            self.log(f"     - Email: {sample_user.get('email', 'N/A')}")
            self.log(f"     - Full Name: {sample_user.get('full_name', 'N/A')}")
            self.log(f"     - Roles: {sample_user.get('roles', 'N/A')}")
            self.log(f"     - Groups: {sample_user.get('groups', 'N/A')}")
            self.log(f"     - Primary Department: {sample_user.get('primary_department_id', 'N/A')}")
            
            # Verify required fields are present
            required_fields = ['id', 'email', 'full_name', 'roles']
            missing_fields = [field for field in required_fields if field not in sample_user]
            
            if not missing_fields:
                self.log(f"   ✅ User data structure contains all required fields")
            else:
                self.log(f"   ❌ User data missing fields: {missing_fields}")
        
        # Test 2: Filter users by department (simulate department user modal)
        if departments and all_users:
            for dept in departments[:2]:  # Test first 2 departments
                dept_id = dept['id']
                dept_name = dept['name']
                
                # Filter users by department manually (since there's no specific endpoint)
                dept_users = [
                    user for user in all_users 
                    if user.get('primary_department_id') == dept_id
                ]
                
                self.log(f"   → Department '{dept_name}' has {len(dept_users)} users")
                
                if dept_users:
                    for user in dept_users[:3]:  # Show first 3 users
                        roles = user.get('roles', [])
                        role_names = []
                        if isinstance(roles, list):
                            for role in roles:
                                if isinstance(role, dict):
                                    role_names.append(role.get('role', 'unknown'))
                                else:
                                    role_names.append(str(role))
                        
                        self.log(f"     - {user.get('full_name', 'N/A')} ({user.get('email', 'N/A')}) - Roles: {role_names}")
        
        # Test 3: Test user roles structure
        if all_users:
            role_types_found = set()
            users_with_groups = 0
            
            for user in all_users:
                roles = user.get('roles', [])
                if isinstance(roles, list):
                    for role in roles:
                        if isinstance(role, dict):
                            role_types_found.add(role.get('role', 'unknown'))
                        else:
                            role_types_found.add(str(role))
                
                if user.get('groups') and len(user.get('groups', [])) > 0:
                    users_with_groups += 1
            
            self.log(f"   → Role types found: {sorted(list(role_types_found))}")
            self.log(f"   → Users with group memberships: {users_with_groups}")
        
        # Test 4: Test admin access to user management endpoints
        success, response = self.run_test(
            "Test admin access to user management",
            "GET",
            "/admin/users",
            200
        )
        
        if success:
            admin_users = response
            self.log(f"   ✓ Admin endpoint returned {len(admin_users)} users")
        else:
            # If /admin/users doesn't exist, that's okay - we tested /users instead
            self.log(f"   ℹ️ No specific /admin/users endpoint - using /users for user lookup")
        
        return True

    def cleanup_resources(self):
        """Clean up created test resources"""
        self.log("\n🧹 Cleaning up test resources...")
        
        # Clean up boards
        for board_id in self.created_resources['boards']:
            success, response = self.run_test(
                f"Cleanup board {board_id}",
                "DELETE",
                f"/boards/{board_id}",
                200
            )
            if success:
                self.log(f"   ✓ Cleaned up board {board_id}")
        
        # Clean up groups
        for group_id in self.created_resources['groups']:
            success, response = self.run_test(
                f"Cleanup group {group_id}",
                "DELETE",
                f"/admin/groups/{group_id}",
                200
            )
            if success:
                self.log(f"   ✓ Cleaned up group {group_id}")

    def run_all_tests(self):
        """Run all admin functionality tests"""
        self.log("🚀 Starting Admin Functionality Tests...")
        self.log(f"Testing against: {self.base_url}")
        
        try:
            # Authenticate as CEO
            if not self.authenticate_ceo():
                self.log("❌ CEO authentication failed, stopping")
                return False
            
            # Run test suites
            self.test_group_crud_operations()
            self.test_board_creation()
            self.test_board_visibility_settings()
            self.test_department_users_lookup()
            
            # Clean up
            self.cleanup_resources()
            
            # Print summary
            self.log(f"\n📊 Admin Functionality Test Summary:")
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
    tester = AdminFunctionalityTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())