#!/usr/bin/env python3
"""
Fix Board Access Issues
Update board visibility settings to match the expected behavior
"""
import requests
import sys
import json
from datetime import datetime

class BoardAccessFixer:
    def __init__(self, base_url="https://projectflow-37.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.ceo_token = None

    def log(self, message):
        """Log messages"""
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
            self.ceo_token = data['access_token']
            self.log("✅ CEO login successful")
            return True
        else:
            self.log(f"❌ CEO login failed: {response.status_code}")
            return False

    def get_groups(self):
        """Get all groups to understand the structure"""
        if not self.ceo_token:
            return []
            
        self.log("\n📋 Getting all groups...")
        
        headers = {'Authorization': f'Bearer {self.ceo_token}'}
        response = requests.get(f"{self.api_base}/admin/groups", headers=headers)
        
        if response.status_code == 200:
            groups = response.json()
            self.log(f"Found {len(groups)} groups:")
            for group in groups:
                self.log(f"   - {group['id']}: {group['name']} (dept: {group.get('department_id', 'None')})")
                self.log(f"     Members: {group.get('member_ids', [])}")
            return groups
        else:
            self.log(f"❌ Failed to get groups: {response.status_code}")
            return []

    def fix_gam_buy_board(self):
        """Fix GAM_BUY board to remove sweeps group access"""
        if not self.ceo_token:
            return False
            
        self.log("\n🔧 Fixing GAM_BUY board visibility...")
        
        headers = {'Authorization': f'Bearer {self.ceo_token}'}
        
        # Update GAM_BUY board to only allow gambling groups
        update_data = {
            "visibility": {
                "mode": "groups",
                "allowed_group_ids": ["group-gambling-team1"],  # Remove sweeps group
                "allowed_user_ids": []
            }
        }
        
        response = requests.patch(f"{self.api_base}/boards/board-gambling-buyers/visibility", 
                                json=update_data, headers=headers)
        
        if response.status_code == 200:
            self.log("✅ GAM_BUY board visibility updated - removed sweeps access")
            return True
        else:
            self.log(f"❌ Failed to update GAM_BUY board: {response.status_code}")
            self.log(f"   Response: {response.text}")
            return False

    def fix_tech_board(self):
        """Fix TECH board to allow LEADs and HEADs access"""
        if not self.ceo_token:
            return False
            
        self.log("\n🔧 Fixing TECH board visibility...")
        
        headers = {'Authorization': f'Bearer {self.ceo_token}'}
        
        # Update TECH board to use correct group names and add LEAD/HEAD users
        update_data = {
            "visibility": {
                "mode": "users",  # Change to users mode for more granular control
                "allowed_user_ids": [
                    # Buyers
                    "buyer-gambling-001",
                    "buyer-sweeps-001", 
                    # LEADs
                    "lead-gambling-001",
                    "lead-sweeps-001",
                    # HEADs  
                    "head-gambling-001",
                    "head-sweeps-001",
                    # Tech users
                    "tech-001"
                ],
                "allowed_group_ids": []
            }
        }
        
        response = requests.patch(f"{self.api_base}/boards/board-tech/visibility", 
                                json=update_data, headers=headers)
        
        if response.status_code == 200:
            self.log("✅ TECH board visibility updated - added LEAD/HEAD access")
            return True
        else:
            self.log(f"❌ Failed to update TECH board: {response.status_code}")
            self.log(f"   Response: {response.text}")
            return False

    def fix_designer_boards(self):
        """Fix designer boards to allow buyers from same department"""
        if not self.ceo_token:
            return False
            
        self.log("\n🔧 Fixing designer board visibility...")
        
        headers = {'Authorization': f'Bearer {self.ceo_token}'}
        
        # Fix GAM_DES board - add gambling buyers
        gam_des_update = {
            "visibility": {
                "mode": "users",
                "allowed_user_ids": [
                    "designer-gambling-001",  # Original designer
                    "buyer-gambling-001",     # Add gambling buyer
                    "lead-gambling-001",      # Add gambling lead
                    "head-gambling-001"       # Add gambling head
                ],
                "allowed_group_ids": []
            }
        }
        
        response = requests.patch(f"{self.api_base}/boards/board-gambling-designers/visibility", 
                                json=gam_des_update, headers=headers)
        
        if response.status_code == 200:
            self.log("✅ GAM_DES board visibility updated - added buyers/leads/heads")
        else:
            self.log(f"❌ Failed to update GAM_DES board: {response.status_code}")
        
        # Fix SWE_DES board - add sweeps buyers
        swe_des_update = {
            "visibility": {
                "mode": "users", 
                "allowed_user_ids": [
                    "designer-sweeps-001",    # Original designer
                    "buyer-sweeps-001",       # Add sweeps buyer
                    "lead-sweeps-001",        # Add sweeps lead
                    "head-sweeps-001"         # Add sweeps head
                ],
                "allowed_group_ids": []
            }
        }
        
        response = requests.patch(f"{self.api_base}/boards/board-sweeps-designers/visibility", 
                                json=swe_des_update, headers=headers)
        
        if response.status_code == 200:
            self.log("✅ SWE_DES board visibility updated - added buyers/leads/heads")
            return True
        else:
            self.log(f"❌ Failed to update SWE_DES board: {response.status_code}")
            return False

    def verify_fixes(self):
        """Verify that the fixes work"""
        self.log("\n✅ Verifying fixes...")
        
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
                
                # Test board access
                headers = {'Authorization': f'Bearer {token}'}
                response = requests.get(f"{self.api_base}/boards", headers=headers)
                
                if response.status_code == 200:
                    boards = response.json()
                    board_keys = [b['key'] for b in boards]
                    self.log(f"   {user_data['role']}: {board_keys}")
                else:
                    self.log(f"   ❌ {user_data['role']}: Failed to get boards")

    def run_fixes(self):
        """Run all fixes"""
        self.log("🔧 Starting Board Access Fixes...")
        
        if not self.login_as_ceo():
            return False
            
        self.get_groups()
        
        success = True
        success &= self.fix_gam_buy_board()
        success &= self.fix_tech_board()
        success &= self.fix_designer_boards()
        
        if success:
            self.verify_fixes()
            self.log("\n✅ All board access fixes completed successfully!")
        else:
            self.log("\n❌ Some fixes failed")
            
        return success

def main():
    """Main function"""
    fixer = BoardAccessFixer()
    success = fixer.run_fixes()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())