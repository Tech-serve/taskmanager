#!/usr/bin/env python3
"""
Debug Board Access Logic
Check current board visibility settings and user data
"""
import requests
import sys
import json
from datetime import datetime

class BoardAccessDebugger:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tokens = {}
        self.users = {}

    def log(self, message):
        """Log debug messages"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def login_as_ceo(self):
        """Login as CEO to get admin access"""
        self.log("🔐 Logging in as CEO for admin access...")
        
        response = requests.post(f"{self.api_base}/auth/login", json={
            "email": "ceo@company.com",
            "password": "ceo123"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.tokens['ceo'] = data['access_token']
            self.users['ceo'] = data['user']
            self.log("✅ CEO login successful")
            return True
        else:
            self.log(f"❌ CEO login failed: {response.status_code}")
            return False

    def get_board_details(self):
        """Get detailed board information"""
        if 'ceo' not in self.tokens:
            return
            
        self.log("\n📋 Getting board details...")
        
        headers = {'Authorization': f'Bearer {self.tokens["ceo"]}'}
        
        # Get all boards
        response = requests.get(f"{self.api_base}/boards", headers=headers)
        if response.status_code == 200:
            boards = response.json()
            
            for board in boards:
                self.log(f"\n🔍 Board: {board['key']} ({board['name']})")
                self.log(f"   ID: {board['id']}")
                self.log(f"   Type: {board.get('type', 'N/A')}")
                
                # Check visibility settings
                visibility = board.get('visibility', {})
                self.log(f"   Visibility Mode: {visibility.get('mode', 'N/A')}")
                self.log(f"   Allowed Users: {visibility.get('allowed_user_ids', [])}")
                self.log(f"   Allowed Groups: {visibility.get('allowed_group_ids', [])}")
                
                # Check legacy settings
                self.log(f"   Legacy Allowed Roles: {board.get('allowed_roles', [])}")
                self.log(f"   Legacy Members: {board.get('members', [])}")
                self.log(f"   Legacy Owners: {board.get('owners', [])}")
        else:
            self.log(f"❌ Failed to get boards: {response.status_code}")

    def get_user_details(self):
        """Get user details for debugging"""
        if 'ceo' not in self.tokens:
            return
            
        self.log("\n👥 Getting user details...")
        
        headers = {'Authorization': f'Bearer {self.tokens["ceo"]}'}
        
        # Get all users
        response = requests.get(f"{self.api_base}/users", headers=headers)
        if response.status_code == 200:
            users = response.json()
            
            # Filter for relevant users
            relevant_emails = [
                "buyer1.gambling@company.com",
                "buyer1.sweeps@company.com", 
                "lead.gambling@company.com",
                "head.gambling@company.com"
            ]
            
            for user in users:
                if user['email'] in relevant_emails:
                    self.log(f"\n👤 User: {user['email']}")
                    self.log(f"   ID: {user['id']}")
                    self.log(f"   Name: {user['full_name']}")
                    self.log(f"   Primary Department: {user.get('primary_department_id', 'None')}")
                    self.log(f"   Groups: {user.get('groups', [])}")
                    self.log(f"   Roles: {user.get('roles', [])}")
        else:
            self.log(f"❌ Failed to get users: {response.status_code}")

    def test_specific_user_access(self):
        """Test board access for specific users"""
        self.log("\n🔍 Testing specific user board access...")
        
        test_users = [
            {"email": "buyer1.gambling@company.com", "password": "buyer123", "role": "gambling_buyer"},
            {"email": "buyer1.sweeps@company.com", "password": "buyer123", "role": "sweeps_buyer"},
            {"email": "lead.gambling@company.com", "password": "lead123", "role": "gambling_lead"},
            {"email": "head.gambling@company.com", "password": "head123", "role": "gambling_head"}
        ]
        
        for user_data in test_users:
            # Login
            response = requests.post(f"{self.api_base}/auth/login", json={
                "email": user_data["email"],
                "password": user_data["password"]
            })
            
            if response.status_code == 200:
                data = response.json()
                token = data['access_token']
                user = data['user']
                
                self.log(f"\n🔐 {user_data['role']} ({user['email']}):")
                self.log(f"   Department: {user.get('primary_department_id', 'None')}")
                self.log(f"   Roles: {[r.get('role', r) for r in user.get('roles', [])]}")
                
                # Test board access
                headers = {'Authorization': f'Bearer {token}'}
                response = requests.get(f"{self.api_base}/boards", headers=headers)
                
                if response.status_code == 200:
                    boards = response.json()
                    board_keys = [b['key'] for b in boards]
                    self.log(f"   Accessible Boards: {board_keys}")
                    
                    # Test TECH board specifically
                    response = requests.get(f"{self.api_base}/boards/by-key/TECH", headers=headers)
                    if response.status_code == 200:
                        self.log(f"   ✅ Can access TECH board individually")
                    else:
                        self.log(f"   ❌ Cannot access TECH board individually: {response.status_code}")
                else:
                    self.log(f"   ❌ Failed to get boards: {response.status_code}")
            else:
                self.log(f"❌ Failed to login {user_data['role']}: {response.status_code}")

    def run_debug(self):
        """Run all debug checks"""
        self.log("🔍 Starting Board Access Debug...")
        
        if not self.login_as_ceo():
            return False
            
        self.get_board_details()
        self.get_user_details()
        self.test_specific_user_access()
        
        return True

def main():
    """Main function"""
    debugger = BoardAccessDebugger()
    debugger.run_debug()
    return 0

if __name__ == "__main__":
    sys.exit(main())