#!/usr/bin/env python3
"""
Board Access Fix Testing - Critical NameError Fix Verification
Tests the specific board access logic fix for group-based and user-based visibility
"""
import requests
import sys
import json
from datetime import datetime

class BoardAccessTester:
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

    def authenticate_users(self):
        """Authenticate test users"""
        self.log("\n🔐 Authenticating Test Users...")
        
        # Test users as specified in the review request
        test_users = [
            {"email": "ceo@company.com", "password": "ceo123", "role": "ceo"},
            {"email": "buyer1.gambling@company.com", "password": "buyer123", "role": "gambling_buyer"},
            {"email": "buyer1.sweeps@company.com", "password": "buyer123", "role": "sweeps_buyer"}
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
            else:
                self.log(f"   ❌ Failed to get token for {user_data['role']}")
                return False
        
        return True

    def test_ceo_board_access(self):
        """Test CEO has full access to all boards"""
        self.log("\n👑 Testing CEO Board Access...")
        
        if 'ceo' not in self.tokens:
            self.log("❌ CEO token not available")
            return False
        
        # Test GET /api/boards - CEO should see all boards
        success, response = self.run_test(
            "CEO get all boards",
            "GET",
            "/boards",
            200,
            user_token=self.tokens['ceo']
        )
        
        if success:
            boards = response
            board_keys = [board['key'] for board in boards]
            self.log(f"   ✓ CEO sees {len(boards)} boards: {board_keys}")
            
            # CEO should see GAM_BUY, SWE_BUY, and other boards
            expected_boards = ['GAM_BUY', 'SWE_BUY']
            found_boards = [key for key in expected_boards if key in board_keys]
            
            if len(found_boards) >= 2:
                self.log(f"   ✅ CEO can see critical boards: {found_boards}")
            else:
                self.log(f"   ❌ CEO missing critical boards. Expected: {expected_boards}, Found: {found_boards}")
        
        # Test individual board access
        test_boards = ['GAM_BUY', 'SWE_BUY', 'TECH', 'EXPENSES']
        for board_key in test_boards:
            success, response = self.run_test(
                f"CEO access {board_key} board",
                "GET",
                f"/boards/by-key/{board_key}",
                200,
                user_token=self.tokens['ceo']
            )
            
            if success:
                self.log(f"   ✅ CEO can access {board_key} board")
            else:
                self.log(f"   ❌ CEO cannot access {board_key} board")
        
        return True

    def test_buyer_board_access(self):
        """Test buyer board access with group-based visibility"""
        self.log("\n🛒 Testing Buyer Board Access...")
        
        # Test gambling buyer access
        if 'gambling_buyer' in self.tokens:
            self.log("   Testing Gambling Buyer Access...")
            
            # Get all boards for gambling buyer
            success, response = self.run_test(
                "Gambling buyer get all boards",
                "GET",
                "/boards",
                200,
                user_token=self.tokens['gambling_buyer']
            )
            
            if success:
                boards = response
                board_keys = [board['key'] for board in boards]
                self.log(f"   → Gambling buyer sees boards: {board_keys}")
                
                # Should see GAM_BUY board if group membership works
                if 'GAM_BUY' in board_keys:
                    self.log(f"   ✅ Gambling buyer can see GAM_BUY board (group access working)")
                else:
                    self.log(f"   ❌ Gambling buyer cannot see GAM_BUY board (group access issue)")
            
            # Test direct access to GAM_BUY board
            success, response = self.run_test(
                "Gambling buyer access GAM_BUY board directly",
                "GET",
                "/boards/by-key/GAM_BUY",
                200,
                user_token=self.tokens['gambling_buyer']
            )
            
            if success:
                self.log(f"   ✅ Gambling buyer can directly access GAM_BUY board")
            else:
                self.log(f"   ❌ Gambling buyer cannot directly access GAM_BUY board")
            
            # Test access to SWE_BUY board (should fail)
            success, response = self.run_test(
                "Gambling buyer access SWE_BUY board (should fail)",
                "GET",
                "/boards/by-key/SWE_BUY",
                403,
                user_token=self.tokens['gambling_buyer']
            )
            
            if success:
                self.log(f"   ✅ Gambling buyer correctly denied access to SWE_BUY board")
            else:
                self.log(f"   ❌ Gambling buyer access control issue with SWE_BUY board")
        
        # Test sweeps buyer access
        if 'sweeps_buyer' in self.tokens:
            self.log("   Testing Sweeps Buyer Access...")
            
            # Get all boards for sweeps buyer
            success, response = self.run_test(
                "Sweeps buyer get all boards",
                "GET",
                "/boards",
                200,
                user_token=self.tokens['sweeps_buyer']
            )
            
            if success:
                boards = response
                board_keys = [board['key'] for board in boards]
                self.log(f"   → Sweeps buyer sees boards: {board_keys}")
                
                # Should see SWE_BUY board if group membership works
                if 'SWE_BUY' in board_keys:
                    self.log(f"   ✅ Sweeps buyer can see SWE_BUY board (group access working)")
                else:
                    self.log(f"   ❌ Sweeps buyer cannot see SWE_BUY board (group access issue)")
            
            # Test direct access to SWE_BUY board
            success, response = self.run_test(
                "Sweeps buyer access SWE_BUY board directly",
                "GET",
                "/boards/by-key/SWE_BUY",
                200,
                user_token=self.tokens['sweeps_buyer']
            )
            
            if success:
                self.log(f"   ✅ Sweeps buyer can directly access SWE_BUY board")
            else:
                self.log(f"   ❌ Sweeps buyer cannot directly access SWE_BUY board")
            
            # Test access to GAM_BUY board (should fail)
            success, response = self.run_test(
                "Sweeps buyer access GAM_BUY board (should fail)",
                "GET",
                "/boards/by-key/GAM_BUY",
                403,
                user_token=self.tokens['sweeps_buyer']
            )
            
            if success:
                self.log(f"   ✅ Sweeps buyer correctly denied access to GAM_BUY board")
            else:
                self.log(f"   ❌ Sweeps buyer access control issue with GAM_BUY board")
        
        return True

    def test_board_visibility_modes(self):
        """Test both 'groups' and 'users' visibility modes"""
        self.log("\n🔍 Testing Board Visibility Modes...")
        
        if 'ceo' not in self.tokens:
            self.log("❌ CEO token not available for visibility testing")
            return False
        
        # First, get all boards to find board IDs
        success, response = self.run_test(
            "Get boards for visibility testing",
            "GET",
            "/boards",
            200,
            user_token=self.tokens['ceo']
        )
        
        if not success:
            self.log("❌ Cannot get boards for visibility testing")
            return False
        
        boards = response
        board_map = {board['key']: board for board in boards}
        
        # Test GAM_BUY board visibility (should be in 'groups' mode)
        if 'GAM_BUY' in board_map:
            board = board_map['GAM_BUY']
            visibility = board.get('visibility', {})
            mode = visibility.get('mode', 'unknown')
            
            self.log(f"   GAM_BUY board visibility mode: {mode}")
            
            if mode == 'groups':
                allowed_groups = visibility.get('allowed_group_ids', [])
                self.log(f"   → GAM_BUY allowed groups: {allowed_groups}")
                
                if allowed_groups:
                    self.log(f"   ✅ GAM_BUY board has group-based visibility configured")
                else:
                    self.log(f"   ❌ GAM_BUY board in groups mode but no groups specified")
            elif mode == 'users':
                allowed_users = visibility.get('allowed_user_ids', [])
                self.log(f"   → GAM_BUY allowed users: {len(allowed_users)} users")
                self.log(f"   ✅ GAM_BUY board has user-based visibility configured")
            else:
                self.log(f"   ❌ GAM_BUY board has unknown visibility mode: {mode}")
        
        # Test SWE_BUY board visibility (should be in 'groups' mode)
        if 'SWE_BUY' in board_map:
            board = board_map['SWE_BUY']
            visibility = board.get('visibility', {})
            mode = visibility.get('mode', 'unknown')
            
            self.log(f"   SWE_BUY board visibility mode: {mode}")
            
            if mode == 'groups':
                allowed_groups = visibility.get('allowed_group_ids', [])
                self.log(f"   → SWE_BUY allowed groups: {allowed_groups}")
                
                if allowed_groups:
                    self.log(f"   ✅ SWE_BUY board has group-based visibility configured")
                else:
                    self.log(f"   ❌ SWE_BUY board in groups mode but no groups specified")
            elif mode == 'users':
                allowed_users = visibility.get('allowed_user_ids', [])
                self.log(f"   → SWE_BUY allowed users: {len(allowed_users)} users")
                self.log(f"   ✅ SWE_BUY board has user-based visibility configured")
            else:
                self.log(f"   ❌ SWE_BUY board has unknown visibility mode: {mode}")
        
        return True

    def test_check_board_access_function(self):
        """Test the specific check_board_access function that was fixed"""
        self.log("\n🔧 Testing check_board_access Function Fix...")
        
        # The fix was changing 'current_user' to 'user' parameter in check_board_access function
        # We test this by making requests that would trigger the function
        
        test_scenarios = [
            ("gambling_buyer", "GAM_BUY", 200, "should have access"),
            ("gambling_buyer", "SWE_BUY", 403, "should be denied access"),
            ("sweeps_buyer", "SWE_BUY", 200, "should have access"),
            ("sweeps_buyer", "GAM_BUY", 403, "should be denied access"),
            ("ceo", "GAM_BUY", 200, "should have full access"),
            ("ceo", "SWE_BUY", 200, "should have full access")
        ]
        
        for user_role, board_key, expected_status, description in test_scenarios:
            if user_role in self.tokens:
                success, response = self.run_test(
                    f"{user_role} access {board_key} ({description})",
                    "GET",
                    f"/boards/by-key/{board_key}",
                    expected_status,
                    user_token=self.tokens[user_role]
                )
                
                if success:
                    if expected_status == 200:
                        self.log(f"   ✅ {user_role} successfully accessed {board_key}")
                    else:
                        self.log(f"   ✅ {user_role} correctly denied access to {board_key}")
                else:
                    self.log(f"   ❌ {user_role} access to {board_key} failed - check_board_access function issue")
        
        return True

    def test_group_membership_verification(self):
        """Verify that users are properly assigned to groups"""
        self.log("\n👥 Testing Group Membership...")
        
        # Check user group memberships
        for role, user_data in self.users.items():
            groups = user_data.get('groups', [])
            self.log(f"   {role} belongs to groups: {groups}")
            
            if role == 'gambling_buyer':
                if 'group-gambling-team1' in groups or any('gambling' in str(g).lower() for g in groups):
                    self.log(f"   ✅ Gambling buyer has correct group membership")
                else:
                    self.log(f"   ❌ Gambling buyer missing gambling group membership")
            
            elif role == 'sweeps_buyer':
                if 'group-sweeps-team1' in groups or any('sweeps' in str(g).lower() for g in groups):
                    self.log(f"   ✅ Sweeps buyer has correct group membership")
                else:
                    self.log(f"   ❌ Sweeps buyer missing sweeps group membership")
        
        return True

    def run_board_access_tests(self):
        """Run all board access tests"""
        self.log("🚀 Starting Board Access Fix Tests...")
        self.log(f"Testing against: {self.base_url}")
        self.log("Focus: NameError fix in check_board_access function")
        
        try:
            # Authenticate users
            if not self.authenticate_users():
                self.log("❌ Authentication failed, stopping tests")
                return False
            
            # Run test suites
            self.test_ceo_board_access()
            self.test_buyer_board_access()
            self.test_board_visibility_modes()
            self.test_check_board_access_function()
            self.test_group_membership_verification()
            
            # Print summary
            self.log(f"\n📊 Board Access Test Summary:")
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
            else:
                self.log(f"\n🎉 All board access tests passed! The NameError fix is working correctly.")
            
            return self.tests_passed == self.tests_run
            
        except Exception as e:
            self.log(f"❌ Test suite failed with error: {e}")
            return False

def main():
    """Main function"""
    tester = BoardAccessTester()
    success = tester.run_board_access_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())