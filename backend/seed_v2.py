#!/usr/bin/env python3
"""
Seed script for new Department-based ACL system
Creates departments, roles, groups, and migrates existing data
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
from datetime import datetime, timezone
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def clear_collections():
    """Clear existing data"""
    print("Clearing existing data...")
    await db.users.delete_many({})
    await db.boards.delete_many({})
    await db.columns.delete_many({})
    await db.tasks.delete_many({})
    await db.departments.delete_many({})
    await db.groups.delete_many({})
    print("✓ Cleared all collections")

async def create_departments():
    """Create seed departments"""
    print("Creating departments...")
    
    departments = [
        {
            "id": "dept-gambling",
            "name": "Gambling",
            "type": "gambling",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "dept-sweeps",
            "name": "Sweeps", 
            "type": "sweeps",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "dept-office",
            "name": "Office",
            "type": "office", 
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "dept-tech",
            "name": "Tech",
            "type": "tech",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "dept-admins",
            "name": "Admins", 
            "type": "admins",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.departments.insert_many(departments)
    print(f"✓ Created {len(departments)} departments")

async def create_groups():
    """Create seed groups/teams"""
    print("Creating groups...")
    
    groups = [
        {
            "id": "group-gambling-team1",
            "name": "Gambling Team Alpha",
            "department_id": "dept-gambling",
            "lead_user_id": "lead-gambling-001",
            "member_ids": ["buyer-gambling-001", "buyer-gambling-002"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "group-sweeps-team1", 
            "name": "Sweeps Team Bravo",
            "department_id": "dept-sweeps",
            "lead_user_id": "lead-sweeps-001",
            "member_ids": ["buyer-sweeps-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.groups.insert_many(groups)
    print(f"✓ Created {len(groups)} groups")

async def create_users():
    """Create seed users with new role system"""
    print("Creating users...")
    
    users = [
        # C-Level Users
        {
            "id": "ceo-001",
            "email": "ceo@company.com",
            "password_hash": bcrypt.hash("ceo123"),
            "full_name": "CEO User",
            "roles": [{"role": "ceo", "department_id": None}],
            "groups": [],
            "primary_department_id": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "coo-001", 
            "email": "coo@company.com",
            "password_hash": bcrypt.hash("coo123"),
            "full_name": "COO User",
            "roles": [{"role": "coo", "department_id": None}],
            "groups": [],
            "primary_department_id": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "cto-001",
            "email": "cto@company.com", 
            "password_hash": bcrypt.hash("cto123"),
            "full_name": "CTO User",
            "roles": [{"role": "cto", "department_id": None}],
            "groups": [],
            "primary_department_id": None,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        
        # Department Heads
        {
            "id": "head-gambling-001",
            "email": "head.gambling@company.com",
            "password_hash": bcrypt.hash("head123"),
            "full_name": "Gambling Department Head",
            "roles": [{"role": "head", "department_id": "dept-gambling"}],
            "groups": [],
            "primary_department_id": "dept-gambling",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "head-sweeps-001",
            "email": "head.sweeps@company.com",
            "password_hash": bcrypt.hash("head123"),
            "full_name": "Sweeps Department Head", 
            "roles": [{"role": "head", "department_id": "dept-sweeps"}],
            "groups": [],
            "primary_department_id": "dept-sweeps",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        
        # Team Leads
        {
            "id": "lead-gambling-001",
            "email": "lead.gambling@company.com",
            "password_hash": bcrypt.hash("lead123"),
            "full_name": "Gambling Team Lead",
            "roles": [{"role": "lead", "department_id": "dept-gambling"}],
            "groups": ["group-gambling-team1"],
            "primary_department_id": "dept-gambling",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "lead-sweeps-001",
            "email": "lead.sweeps@company.com",
            "password_hash": bcrypt.hash("lead123"),
            "full_name": "Sweeps Team Lead",
            "roles": [{"role": "lead", "department_id": "dept-sweeps"}],
            "groups": ["group-sweeps-team1"], 
            "primary_department_id": "dept-sweeps",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        
        # Buyers
        {
            "id": "buyer-gambling-001",
            "email": "buyer1.gambling@company.com",
            "password_hash": bcrypt.hash("buyer123"),
            "full_name": "Alice Gambling Buyer",
            "roles": [{"role": "buyer", "department_id": "dept-gambling"}],
            "groups": ["group-gambling-team1"],
            "primary_department_id": "dept-gambling",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "buyer-gambling-002",
            "email": "buyer2.gambling@company.com",
            "password_hash": bcrypt.hash("buyer123"),
            "full_name": "Bob Gambling Buyer",
            "roles": [{"role": "buyer", "department_id": "dept-gambling"}],
            "groups": ["group-gambling-team1"],
            "primary_department_id": "dept-gambling", 
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "buyer-sweeps-001",
            "email": "buyer1.sweeps@company.com",
            "password_hash": bcrypt.hash("buyer123"),
            "full_name": "Charlie Sweeps Buyer",
            "roles": [{"role": "buyer", "department_id": "dept-sweeps"}],
            "groups": ["group-sweeps-team1"],
            "primary_department_id": "dept-sweeps",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        
        # Designers
        {
            "id": "designer-gambling-001",
            "email": "designer.gambling@company.com",
            "password_hash": bcrypt.hash("designer123"),
            "full_name": "David Gambling Designer",
            "roles": [{"role": "designer", "department_id": "dept-gambling"}],
            "groups": [],
            "primary_department_id": "dept-gambling",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "designer-sweeps-001", 
            "email": "designer.sweeps@company.com",
            "password_hash": bcrypt.hash("designer123"),
            "full_name": "Eva Sweeps Designer",
            "roles": [{"role": "designer", "department_id": "dept-sweeps"}],
            "groups": [],
            "primary_department_id": "dept-sweeps",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        
        # Tech  
        {
            "id": "tech-001",
            "email": "tech@company.com",
            "password_hash": bcrypt.hash("tech123"),
            "full_name": "Frank Tech Developer",
            "roles": [{"role": "tech", "department_id": "dept-tech"}],
            "groups": [],
            "primary_department_id": "dept-tech",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        
        # Office Manager
        {
            "id": "office-001",
            "email": "office@company.com",
            "password_hash": bcrypt.hash("office123"),
            "full_name": "Grace Office Manager",
            "roles": [{"role": "office_manager", "department_id": "dept-office"}],
            "groups": [],
            "primary_department_id": "dept-office",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.users.insert_many(users)
    print(f"✓ Created {len(users)} users")

async def create_boards():
    """Create seed boards with new visibility system"""
    print("Creating boards...")
    
    boards = [
        {
            "id": "board-gambling-buyers",
            "name": "Gambling Buyers", 
            "key": "GAM_BUY",
            "type": "tasks",
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": "dept-gambling",
            "visibility": {
                "department_ids": ["dept-gambling"],
                "role_ids": [],
                "mode": "users",
                "allowed_group_ids": [],
                "allowed_user_ids": ["head-gambling-001", "lead-gambling-001", "buyer-gambling-001", "buyer-gambling-002"],
                "permissions": {"read": True, "create": True, "edit": True, "manage": False}
            },
            "content_filter": {"by_department": "viewer"},  # Users see only their dept tasks
            "allowed_roles": [],  # Legacy - will be migrated
            "allowed_group_ids": [],
            "members": [],
            "owners": ["ceo-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-sweeps-buyers",
            "name": "Sweeps Buyers",
            "key": "SWE_BUY", 
            "type": "tasks",
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": "dept-sweeps",
            "visibility": {
                "department_ids": ["dept-sweeps"],
                "role_ids": [],
                "mode": "users", 
                "allowed_group_ids": [],
                "allowed_user_ids": ["head-sweeps-001", "lead-sweeps-001", "buyer-sweeps-001"],
                "permissions": {"read": True, "create": True, "edit": True, "manage": False}
            },
            "content_filter": {"by_department": "viewer"},
            "allowed_roles": [],
            "allowed_group_ids": [],
            "members": [],
            "owners": ["ceo-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-gambling-designers",
            "name": "Gambling Designers", 
            "key": "GAM_DES",
            "type": "tasks",
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": "dept-gambling",
            "visibility": {
                "department_ids": ["dept-gambling"],
                "role_ids": [],
                "mode": "users",
                "allowed_group_ids": [],
                "allowed_user_ids": ["designer-gambling-001"],
                "permissions": {"read": True, "create": True, "edit": True, "manage": False}
            },
            "content_filter": {"by_department": "viewer"},
            "allowed_roles": [],
            "allowed_group_ids": [],
            "members": [],
            "owners": ["ceo-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-sweeps-designers",
            "name": "Sweeps Designers",
            "key": "SWE_DES",
            "type": "tasks", 
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": "dept-sweeps",
            "visibility": {
                "department_ids": ["dept-sweeps"],
                "role_ids": [],
                "mode": "users",
                "allowed_group_ids": [],
                "allowed_user_ids": ["designer-sweeps-001"],
                "permissions": {"read": True, "create": True, "edit": True, "manage": False}
            },
            "content_filter": {"by_department": "viewer"},
            "allowed_roles": [],
            "allowed_group_ids": [],
            "members": [],
            "owners": ["ceo-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-tech",
            "name": "Tech Development",
            "key": "TECH",
            "type": "tasks",
            "template": "kanban-tj-tech",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": "dept-tech",
            "visibility": {
                "department_ids": ["dept-tech"],
                "role_ids": [],
                "mode": "users",
                "allowed_group_ids": [],
                "allowed_user_ids": ["tech-001"],
                "permissions": {"read": True, "create": True, "edit": True, "manage": False}
            },
            "content_filter": {"by_department": "viewer"},
            "allowed_roles": [],
            "allowed_group_ids": [],
            "members": [],
            "owners": ["cto-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-expenses",
            "name": "Expenses",
            "key": "EXPENSES", 
            "type": "expenses",
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": None,  # Cross-department
            "visibility": {
                "department_ids": [],  # All departments
                "role_ids": [],
                "mode": "users",
                "allowed_group_ids": [],
                "allowed_user_ids": [],  # Will be populated by ACL rules
                "permissions": {"read": True, "create": True, "edit": False, "manage": False}
            },
            "content_filter": None,  # Special expenses logic
            "allowed_roles": [],
            "allowed_group_ids": [],
            "members": [],
            "owners": ["ceo-001", "coo-001", "cto-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.boards.insert_many(boards)
    print(f"✓ Created {len(boards)} boards")

async def create_columns():
    """Create seed columns for boards"""
    print("Creating columns...")
    
    columns = [
        # Gambling Buyers board
        {"id": "col-gam-buy-todo", "board_id": "board-gambling-buyers", "key": "TODO", "name": "Todo", "order": 1},
        {"id": "col-gam-buy-progress", "board_id": "board-gambling-buyers", "key": "IN_PROGRESS", "name": "In Progress", "order": 2},
        {"id": "col-gam-buy-done", "board_id": "board-gambling-buyers", "key": "DONE", "name": "Done", "order": 3},
        
        # Sweeps Buyers board
        {"id": "col-swe-buy-todo", "board_id": "board-sweeps-buyers", "key": "TODO", "name": "Todo", "order": 1},
        {"id": "col-swe-buy-progress", "board_id": "board-sweeps-buyers", "key": "IN_PROGRESS", "name": "In Progress", "order": 2},
        {"id": "col-swe-buy-done", "board_id": "board-sweeps-buyers", "key": "DONE", "name": "Done", "order": 3},
        
        # Gambling Designers board
        {"id": "col-gam-des-queue", "board_id": "board-gambling-designers", "key": "QUEUE", "name": "Queue", "order": 1},
        {"id": "col-gam-des-doing", "board_id": "board-gambling-designers", "key": "DOING", "name": "Doing", "order": 2},
        {"id": "col-gam-des-done", "board_id": "board-gambling-designers", "key": "DONE", "name": "Done", "order": 3},
        
        # Sweeps Designers board
        {"id": "col-swe-des-queue", "board_id": "board-sweeps-designers", "key": "QUEUE", "name": "Queue", "order": 1},
        {"id": "col-swe-des-doing", "board_id": "board-sweeps-designers", "key": "DOING", "name": "Doing", "order": 2},
        {"id": "col-swe-des-done", "board_id": "board-sweeps-designers", "key": "DONE", "name": "Done", "order": 3},
        
        # Tech board
        {"id": "col-tech-todo", "board_id": "board-tech", "key": "TODO", "name": "Todo", "order": 1},
        {"id": "col-tech-dev", "board_id": "board-tech", "key": "IN_DEV", "name": "In Dev", "order": 2},
        {"id": "col-tech-review", "board_id": "board-tech", "key": "REVIEW", "name": "Review", "order": 3},
        {"id": "col-tech-done", "board_id": "board-tech", "key": "DONE", "name": "Done", "order": 4},
        
        # Expenses board
        {"id": "col-exp-pending", "board_id": "board-expenses", "key": "PENDING", "name": "Pending", "order": 1},
        {"id": "col-exp-approved", "board_id": "board-expenses", "key": "APPROVED", "name": "Approved", "order": 2},
        {"id": "col-exp-paid", "board_id": "board-expenses", "key": "PAID", "name": "Paid", "order": 3},
    ]
    
    # Add timestamps
    for col in columns:
        col["created_at"] = datetime.now(timezone.utc)
        col["updated_at"] = datetime.now(timezone.utc)
    
    await db.columns.insert_many(columns)
    print(f"✓ Created {len(columns)} columns")

async def create_tasks():
    """Create sample tasks"""
    print("Creating tasks...")
    
    tasks = [
        # Gambling Buyers tasks
        {
            "id": "task-gam-buy-001",
            "board_key": "GAM_BUY",
            "column_id": "col-gam-buy-todo",
            "title": "Research new gambling vendors",
            "description": "Find alternative suppliers for Q1",
            "priority": "high",
            "tags": ["research", "vendors"],
            "due_date": "2025-02-15",
            "assignee_id": "buyer-gambling-001",
            "creator_id": "lead-gambling-001",
            "department_id": "dept-gambling"
        },
        {
            "id": "task-gam-buy-002", 
            "board_key": "GAM_BUY",
            "column_id": "col-gam-buy-progress",
            "title": "Budget approval for new tools",
            "description": "Getting approval for design software licenses",
            "priority": "medium",
            "tags": ["budget", "tools"],
            "due_date": None,
            "assignee_id": "buyer-gambling-002",
            "creator_id": "buyer-gambling-002",
            "department_id": "dept-gambling"
        },
        
        # Sweeps Buyers tasks
        {
            "id": "task-swe-buy-001",
            "board_key": "SWE_BUY",
            "column_id": "col-swe-buy-todo", 
            "title": "Sweeps compliance review",
            "description": "Review new sweepstakes regulations",
            "priority": "high",
            "tags": ["compliance", "legal"],
            "due_date": "2025-01-30",
            "assignee_id": "buyer-sweeps-001",
            "creator_id": "lead-sweeps-001", 
            "department_id": "dept-sweeps"
        },
        
        # Expenses tasks
        {
            "id": "task-exp-001",
            "board_key": "EXPENSES",
            "column_id": "col-exp-pending",
            "title": "Office supplies - Gambling dept",
            "description": "Monthly office supply order",
            "priority": "medium",
            "tags": ["office", "supplies"],
            "due_date": None,
            "assignee_id": "office-001",
            "creator_id": "buyer-gambling-001",
            "department_id": "dept-gambling",
            "amount": 250.75,
            "category": "office_supplies"
        },
        {
            "id": "task-exp-002",
            "board_key": "EXPENSES",
            "column_id": "col-exp-approved",
            "title": "Software licenses - Tech dept", 
            "description": "Annual development tool licenses",
            "priority": "high",
            "tags": ["software", "licenses"],
            "due_date": None,
            "assignee_id": "cto-001",
            "creator_id": "tech-001",
            "department_id": "dept-tech",
            "amount": 4800.00,
            "category": "software"
        }
    ]
    
    # Add timestamps
    for task in tasks:
        task["created_at"] = datetime.now(timezone.utc)
        task["updated_at"] = datetime.now(timezone.utc)
    
    await db.tasks.insert_many(tasks)
    print(f"✓ Created {len(tasks)} tasks")

async def main():
    """Main seeding function"""
    print("🌱 Starting seed process for new ACL system...")
    
    try:
        await clear_collections()
        await create_departments()
        await create_groups()
        await create_users()
        await create_boards()
        await create_columns()
        await create_tasks()
        
        print("\n✅ New ACL system seed completed successfully!")
        print("\nLogin credentials:")
        print("CEO: ceo@company.com / ceo123") 
        print("COO: coo@company.com / coo123")
        print("CTO: cto@company.com / cto123")
        print("Gambling Head: head.gambling@company.com / head123")
        print("Sweeps Head: head.sweeps@company.com / head123")
        print("Gambling Lead: lead.gambling@company.com / lead123")
        print("Sweeps Lead: lead.sweeps@company.com / lead123")
        print("Gambling Buyer 1: buyer1.gambling@company.com / buyer123")
        print("Gambling Buyer 2: buyer2.gambling@company.com / buyer123")
        print("Sweeps Buyer: buyer1.sweeps@company.com / buyer123")
        print("Gambling Designer: designer.gambling@company.com / designer123")
        print("Sweeps Designer: designer.sweeps@company.com / designer123")
        print("Tech Developer: tech@company.com / tech123")
        print("Office Manager: office@company.com / office123")
        
    except Exception as e:
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())