#!/usr/bin/env python3
"""
CEO ACL System Testing - Department-based ACL System
Tests the new ACL system to identify why CEO user cannot see boards
"""
import requests
import sys
import json
from datetime import datetime

class CEOACLTester:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.ceo_token = None
        self.ceo_user = None
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
                self.log(f"   Response: {response.text[:500]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
                })
                return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_ceo_authentication(self):
        """Test CEO authentication"""
        self.log("\n🔐 Testing CEO Authentication...")
        
        # Test CEO login
        success, response = self.run_test(
            "CEO Login (ceo@company.com/ceo123)",
            "POST",
            "/auth/login",
            200,
            data={"email": "ceo@company.com", "password": "ceo123"}
        )
        
        if success and 'access_token' in response:
            self.ceo_token = response['access_token']
            self.ceo_user = response['user']
            self.log(f"   ✓ CEO login successful")
            self.log(f"   → CEO User ID: {self.ceo_user['id']}")
            self.log(f"   → CEO Email: {self.ceo_user['email']}")
            self.log(f"   → CEO Name: {self.ceo_user['full_name']}")
            return True
        else:
            self.log(f"   ❌ CEO login failed")
            return False

    def test_ceo_user_structure(self):
        """Test CEO user structure in database"""
        self.log("\n👤 Testing CEO User Structure...")
        
        if not self.ceo_token:
            self.log("   ❌ No CEO token available")
            return False
        
        # Test /auth/me endpoint for CEO
        success, response = self.run_test(
            "GET /api/auth/me for CEO",
            "GET",
            "/auth/me",
            200,
            user_token=self.ceo_token
        )
        
        if success:
            self.log(f"   ✓ CEO user info retrieved successfully")
            self.log(f"   → User ID: {response.get('id', 'N/A')}")
            self.log(f"   → Email: {response.get('email', 'N/A')}")
            self.log(f"   → Full Name: {response.get('full_name', 'N/A')}")
            self.log(f"   → Roles Structure: {json.dumps(response.get('roles', []), indent=2)}")
            self.log(f"   → Groups: {response.get('groups', [])}")
            self.log(f"   → Primary Department ID: {response.get('primary_department_id', 'N/A')}")
            
            # Check if CEO has proper role structure
            roles = response.get('roles', [])
            if roles:
                self.log(f"   📋 Analyzing CEO Roles:")
                for i, role in enumerate(roles):
                    if isinstance(role, dict):
                        self.log(f"     Role {i+1}: {role.get('role', 'N/A')} (Dept: {role.get('department_id', 'None')})")
                    else:
                        self.log(f"     Role {i+1}: {role} (Legacy format)")
                
                # Check if CEO role is present
                has_ceo_role = any(
                    (isinstance(role, dict) and role.get('role') == 'ceo') or 
                    (isinstance(role, str) and role == 'ceo')
                    for role in roles
                )
                
                if has_ceo_role:
                    self.log(f"   ✅ CEO role found in user structure")
                else:
                    self.log(f"   ❌ CEO role NOT found in user structure")
                    self.log(f"   🔍 Available roles: {[r.get('role') if isinstance(r, dict) else r for r in roles]}")
            else:
                self.log(f"   ❌ No roles found for CEO user")
            
            return True
        else:
            self.log(f"   ❌ Failed to get CEO user info")
            return False

    def test_ceo_board_access(self):
        """Test CEO board access logic"""
        self.log("\n📋 Testing CEO Board Access...")
        
        if not self.ceo_token:
            self.log("   ❌ No CEO token available")
            return False
        
        # Test GET /api/boards for CEO
        success, response = self.run_test(
            "GET /api/boards for CEO",
            "GET",
            "/boards",
            200,
            user_token=self.ceo_token
        )
        
        if success:
            boards = response
            self.log(f"   📊 CEO Board Access Results:")
            self.log(f"   → Total boards returned: {len(boards)}")
            
            if boards:
                self.log(f"   → Board keys: {[board.get('key', 'N/A') for board in boards]}")
                self.log(f"   → Board names: {[board.get('name', 'N/A') for board in boards]}")
                
                # Expected boards for CEO (should see all 6 boards)
                expected_boards = {'GAM_BUY', 'SWE_BUY', 'GAM_DES', 'SWE_DES', 'TECH', 'EXPENSES'}
                actual_boards = set(board.get('key', '') for board in boards)
                
                self.log(f"   🎯 Expected boards: {expected_boards}")
                self.log(f"   🎯 Actual boards: {actual_boards}")
                
                missing_boards = expected_boards - actual_boards
                extra_boards = actual_boards - expected_boards
                
                if len(actual_boards) == 6 and missing_boards == set():
                    self.log(f"   ✅ CEO can see all expected boards")
                else:
                    self.log(f"   ❌ CEO board access issue detected:")
                    if missing_boards:
                        self.log(f"     → Missing boards: {missing_boards}")
                    if extra_boards:
                        self.log(f"     → Extra boards: {extra_boards}")
                
                # Analyze board visibility settings
                self.log(f"   🔍 Analyzing board visibility settings:")
                for board in boards:
                    board_key = board.get('key', 'N/A')
                    visibility = board.get('visibility', {})
                    allowed_roles = board.get('allowed_roles', [])
                    
                    self.log(f"     Board {board_key}:")
                    self.log(f"       → Visibility mode: {visibility.get('mode', 'N/A')}")
                    self.log(f"       → Allowed user IDs: {len(visibility.get('allowed_user_ids', []))} users")
                    self.log(f"       → Allowed group IDs: {len(visibility.get('allowed_group_ids', []))} groups")
                    self.log(f"       → Legacy allowed roles: {allowed_roles}")
                
            else:
                self.log(f"   ❌ CRITICAL: CEO sees 0 boards (should see all 6)")
                self.log(f"   🔍 This confirms the reported issue")
            
            return len(boards) > 0
        else:
            self.log(f"   ❌ Failed to get boards for CEO")
            return False

    def test_specific_board_access(self):
        """Test CEO access to specific boards"""
        self.log("\n🎯 Testing CEO Access to Specific Boards...")
        
        if not self.ceo_token:
            self.log("   ❌ No CEO token available")
            return False
        
        # Test access to each expected board
        expected_boards = ['GAM_BUY', 'SWE_BUY', 'GAM_DES', 'SWE_DES', 'TECH', 'EXPENSES']
        
        for board_key in expected_boards:
            success, response = self.run_test(
                f"CEO access to board {board_key}",
                "GET",
                f"/boards/by-key/{board_key}",
                200,
                user_token=self.ceo_token
            )
            
            if success:
                self.log(f"   ✅ CEO can access {board_key}")
                # Log board details
                board = response
                self.log(f"     → Board name: {board.get('name', 'N/A')}")
                self.log(f"     → Board type: {board.get('type', 'N/A')}")
                visibility = board.get('visibility', {})
                self.log(f"     → Visibility mode: {visibility.get('mode', 'N/A')}")
            else:
                self.log(f"   ❌ CEO cannot access {board_key}")

    def test_database_inspection(self):
        """Test database inspection through API"""
        self.log("\n🔍 Testing Database Inspection...")
        
        if not self.ceo_token:
            self.log("   ❌ No CEO token available")
            return False
        
        # Test getting all users to see database structure
        success, response = self.run_test(
            "GET /api/users (to inspect database)",
            "GET",
            "/users",
            200,
            user_token=self.ceo_token
        )
        
        if success:
            users = response
            self.log(f"   📊 Database Users Analysis:")
            self.log(f"   → Total users in database: {len(users)}")
            
            # Find CEO user in database
            ceo_user_db = None
            for user in users:
                if user.get('email') == 'ceo@company.com':
                    ceo_user_db = user
                    break
            
            if ceo_user_db:
                self.log(f"   ✅ CEO user found in database:")
                self.log(f"     → ID: {ceo_user_db.get('id', 'N/A')}")
                self.log(f"     → Email: {ceo_user_db.get('email', 'N/A')}")
                self.log(f"     → Roles: {json.dumps(ceo_user_db.get('roles', []), indent=6)}")
                self.log(f"     → Groups: {ceo_user_db.get('groups', [])}")
                self.log(f"     → Primary Dept: {ceo_user_db.get('primary_department_id', 'N/A')}")
            else:
                self.log(f"   ❌ CEO user NOT found in database")
            
            # Count users by role
            role_counts = {}
            for user in users:
                user_roles = user.get('roles', [])
                for role in user_roles:
                    if isinstance(role, dict):
                        role_name = role.get('role', 'unknown')
                    else:
                        role_name = role
                    role_counts[role_name] = role_counts.get(role_name, 0) + 1
            
            self.log(f"   📈 Role distribution in database:")
            for role, count in sorted(role_counts.items()):
                self.log(f"     → {role}: {count} users")
        
        else:
            self.log(f"   ❌ Failed to get users for database inspection")

    def run_all_tests(self):
        """Run all CEO ACL tests"""
        self.log("🚀 Starting CEO ACL System Tests...")
        self.log(f"Testing against: {self.base_url}")
        self.log("🎯 Focus: Identifying why CEO user cannot see boards")
        
        try:
            # Run test suites in order
            if not self.test_ceo_authentication():
                self.log("❌ CEO authentication failed, stopping")
                return False
            
            self.test_ceo_user_structure()
            self.test_ceo_board_access()
            self.test_specific_board_access()
            self.test_database_inspection()
            
            # Print summary
            self.log(f"\n📊 CEO ACL Test Summary:")
            self.log(f"Tests run: {self.tests_run}")
            self.log(f"Tests passed: {self.tests_passed}")
            self.log(f"Tests failed: {self.tests_run - self.tests_passed}")
            self.log(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
            
            # Analysis and recommendations
            self.log(f"\n🔍 ANALYSIS & RECOMMENDATIONS:")
            
            if self.failed_tests:
                self.log(f"\n❌ Failed Tests Details:")
                for failure in self.failed_tests:
                    self.log(f"   - {failure['test']}")
                    if 'error' in failure:
                        self.log(f"     Error: {failure['error']}")
                    else:
                        self.log(f"     Expected: {failure['expected']}, Got: {failure['actual']}")
                        if 'response' in failure:
                            self.log(f"     Response: {failure['response'][:200]}...")
            
            # Specific analysis for CEO board access issue
            if self.ceo_user and self.ceo_token:
                self.log(f"\n🎯 CEO BOARD ACCESS ISSUE ANALYSIS:")
                self.log(f"1. CEO Authentication: {'✅ Working' if self.ceo_token else '❌ Failed'}")
                
                # Check if we got board data
                board_test_passed = any(test['test'].startswith('GET /api/boards for CEO') 
                                      for test in self.failed_tests if 'test' in test) == False
                self.log(f"2. CEO Board API Access: {'✅ API Call Works' if board_test_passed else '❌ API Call Failed'}")
                
                self.log(f"3. Recommended Next Steps:")
                self.log(f"   → Check is_c_level() function implementation")
                self.log(f"   → Verify check_board_access() function for C-level users")
                self.log(f"   → Inspect board visibility settings in database")
                self.log(f"   → Check if CEO role is properly configured in user.roles")
                self.log(f"   → Verify get_boards() function handles new ACL system")
            
            return self.tests_passed == self.tests_run
            
        except Exception as e:
            self.log(f"❌ CEO ACL test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    tester = CEOACLTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())