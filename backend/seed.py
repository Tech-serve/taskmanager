#!/usr/bin/env python3
"""
Seed script for Simplified Jira application
Creates initial users, boards, columns, and tasks
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
    print("✓ Cleared all collections")

async def create_users():
    """Create seed users"""
    print("Creating users...")
    
    users = [
        {
            "id": "admin-001",
            "email": "admin@company.com",
            "password_hash": bcrypt.hash("admin123"),
            "full_name": "Admin User",
            "roles": ["admin"],
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "buyer-001",
            "email": "buyer@company.com",
            "password_hash": bcrypt.hash("buyer123"),
            "full_name": "Alice Buyer",
            "roles": ["buyer"],
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "buyer-002",
            "email": "buyer2@company.com",
            "password_hash": bcrypt.hash("buyer123"),
            "full_name": "Bob Buyer",
            "roles": ["buyer"],
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "designer-001",
            "email": "designer@company.com",
            "password_hash": bcrypt.hash("designer123"),
            "full_name": "Charlie Designer", 
            "roles": ["designer"],
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "tech-001",
            "email": "tech@company.com",
            "password_hash": bcrypt.hash("tech123"),
            "full_name": "David Tech",
            "roles": ["tech"],
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "vladislav-001",
            "email": "vladislav@company.com",
            "password_hash": bcrypt.hash("vladislav123"),
            "full_name": "Vladislav",
            "roles": ["main_admin"],  # Main admin for expenses
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "olya-coo",
            "email": "olya@company.com",
            "password_hash": bcrypt.hash("olya123"),
            "full_name": "Olya COO",
            "roles": ["main_admin"],  # Main admin for expenses
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "lead-001",
            "email": "lead@company.com",
            "password_hash": bcrypt.hash("lead123"),
            "full_name": "Team Lead",
            "roles": ["lead"],  # Lead sees all buyer tasks
            "groups": [],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.users.insert_many(users)
    print(f"✓ Created {len(users)} users")

async def create_boards():
    """Create seed boards"""
    print("Creating boards...")
    
    boards = [
        {
            "id": "board-buyers",
            "name": "Buyers",
            "key": "BUY",
            "type": "tasks",
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "allowed_roles": ["buyer", "admin", "lead"],  # Include lead
            "allowed_group_ids": [],
            "members": [],
            "owners": ["buyer-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-designers",
            "name": "Designers",
            "key": "DES",
            "type": "tasks", 
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "allowed_roles": ["designer", "admin", "lead"],  # Include lead
            "allowed_group_ids": [],
            "members": [],
            "owners": ["designer-001"],
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "board-tech",
            "name": "Tech",
            "key": "TECH",
            "type": "tasks",
            "template": "kanban-tj-tech", 
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "allowed_roles": ["tech", "admin", "lead"],  # Include lead
            "allowed_group_ids": [],
            "members": [],
            "owners": ["tech-001"],
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
            "allowed_roles": ["admin", "main_admin", "lead", "buyer", "designer", "tech"],  # Include all roles
            "allowed_group_ids": [],
            "members": [],
            "owners": ["admin-001"],  # Only admin can own
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.boards.insert_many(boards)
    print(f"✓ Created {len(boards)} boards")

async def create_columns():
    """Create seed columns"""
    print("Creating columns...")
    
    columns = [
        # Buyers board columns
        {"id": "col-buy-backlog", "board_id": "board-buyers", "key": "BACKLOG", "name": "Backlog", "order": 1},
        {"id": "col-buy-progress", "board_id": "board-buyers", "key": "IN_PROGRESS", "name": "In Progress", "order": 2},
        {"id": "col-buy-done", "board_id": "board-buyers", "key": "DONE", "name": "Done", "order": 3},
        
        # Designers board columns  
        {"id": "col-des-queue", "board_id": "board-designers", "key": "QUEUE", "name": "Queue", "order": 1},
        {"id": "col-des-doing", "board_id": "board-designers", "key": "DOING", "name": "Doing", "order": 2},
        {"id": "col-des-review", "board_id": "board-designers", "key": "REVIEW", "name": "Review", "order": 3},
        {"id": "col-des-done", "board_id": "board-designers", "key": "DONE", "name": "Done", "order": 4},
        
        # Tech board columns
        {"id": "col-tech-todo", "board_id": "board-tech", "key": "TODO", "name": "Todo", "order": 1},
        {"id": "col-tech-dev", "board_id": "board-tech", "key": "IN_DEV", "name": "In Dev", "order": 2},
        {"id": "col-tech-review", "board_id": "board-tech", "key": "CODE_REVIEW", "name": "Code Review", "order": 3},
        {"id": "col-tech-done", "board_id": "board-tech", "key": "DONE", "name": "Done", "order": 4},
        
        # Expenses board columns
        {"id": "col-exp-waiting", "board_id": "board-expenses", "key": "WAITING", "name": "Ожидание", "order": 1},
        {"id": "col-exp-progress", "board_id": "board-expenses", "key": "IN_PROGRESS", "name": "In Progress", "order": 2},
        {"id": "col-exp-paid", "board_id": "board-expenses", "key": "PAID", "name": "Paid", "order": 3},
    ]
    
    # Add timestamps
    for col in columns:
        col["created_at"] = datetime.now(timezone.utc)
        col["updated_at"] = datetime.now(timezone.utc)
    
    await db.columns.insert_many(columns)
    print(f"✓ Created {len(columns)} columns")

async def create_tasks():
    """Create seed tasks"""
    print("Creating tasks...")
    
    tasks = [
        # Buyers board tasks - Alice's tasks
        {
            "id": "task-buy-001",
            "board_key": "BUY",
            "column_id": "col-buy-backlog",
            "title": "Research new vendor options (Alice)",
            "description": "Alice needs to find alternative suppliers for Q2",
            "priority": "high",
            "tags": ["research", "vendors", "alice"],
            "due_date": "2025-02-15",
            "assignee_id": "buyer-001",
            "creator_id": "buyer-001"
        },
        {
            "id": "task-buy-002", 
            "board_key": "BUY",
            "column_id": "col-buy-progress",
            "title": "Budget approval for new tools (Alice)",
            "description": "Alice is getting approval for design software licenses",
            "priority": "medium",
            "tags": ["budget", "tools", "alice"],
            "due_date": None,
            "assignee_id": "buyer-001",
            "creator_id": "buyer-001"
        },
        # Bob's tasks
        {
            "id": "task-buy-005",
            "board_key": "BUY",
            "column_id": "col-buy-backlog",
            "title": "Office supplies procurement (Bob)",
            "description": "Bob needs to order office supplies for next quarter",
            "priority": "medium",
            "tags": ["office", "supplies", "bob"],
            "due_date": "2025-02-20",
            "assignee_id": "buyer-002",
            "creator_id": "buyer-002"
        },
        {
            "id": "task-buy-006", 
            "board_key": "BUY",
            "column_id": "col-buy-progress",
            "title": "Equipment lease negotiations (Bob)",
            "description": "Bob is negotiating lease terms for new equipment",
            "priority": "high",
            "tags": ["equipment", "lease", "bob"],
            "due_date": "2025-02-18",
            "assignee_id": "buyer-002",
            "creator_id": "buyer-002"
        },
        {
            "id": "task-buy-003",
            "board_key": "BUY",
            "column_id": "col-buy-to-tech", 
            "title": "Technical requirements for API integration",
            "description": "Need tech team to define API specs for new vendor system",
            "priority": "high",
            "tags": ["api", "integration", "cross-team"],
            "due_date": "2025-02-10",
            "assignee_id": "tech-001",
            "creator_id": "buyer-001"
        },
        {
            "id": "task-buy-004",
            "board_key": "BUY",
            "column_id": "col-buy-to-designers",
            "title": "UI mockups for vendor dashboard", 
            "description": "Need designs for the new vendor management interface",
            "priority": "medium",
            "tags": ["ui", "dashboard", "cross-team"],
            "due_date": "2025-02-20",
            "assignee_id": "designer-001",
            "creator_id": "buyer-001"
        },
        
        # Designers board tasks
        {
            "id": "task-des-001",
            "board_key": "DES", 
            "column_id": "col-des-queue",
            "title": "Landing page redesign",
            "description": "Redesign the main landing page with new branding",
            "priority": "high",
            "tags": ["landing", "branding"],
            "due_date": "2025-02-25",
            "assignee_id": "designer-001",
            "creator_id": "designer-001"
        },
        {
            "id": "task-des-002",
            "board_key": "DES",
            "column_id": "col-des-doing", 
            "title": "Mobile app icon set",
            "description": "Create consistent icon set for mobile application",
            "priority": "medium",
            "tags": ["mobile", "icons"],
            "due_date": None,
            "assignee_id": "designer-001",
            "creator_id": "designer-001"
        },
        
        # Tech board tasks
        {
            "id": "task-tech-001",
            "board_key": "TECH",
            "column_id": "col-tech-todo",
            "title": "Database migration script",
            "description": "Create migration for new user permissions table", 
            "priority": "high",
            "tags": ["database", "migration"],
            "due_date": "2025-02-12",
            "assignee_id": "tech-001",
            "creator_id": "tech-001"
        },
        {
            "id": "task-tech-002",
            "board_key": "TECH",
            "column_id": "col-tech-dev",
            "title": "Authentication service refactor",
            "description": "Improve JWT token handling and add refresh tokens",
            "priority": "medium", 
            "tags": ["auth", "refactor"],
            "due_date": None,
            "assignee_id": "tech-001",
            "creator_id": "tech-001"
        },
        {
            "id": "task-tech-003",
            "board_key": "TECH",
            "column_id": "col-tech-review",
            "title": "API rate limiting implementation",
            "description": "Add rate limiting middleware to prevent abuse",
            "priority": "low",
            "tags": ["api", "security"],
            "due_date": "2025-03-01",
            "assignee_id": "tech-001", 
            "creator_id": "tech-001"
        },
        
        # Expenses board tasks - Olya and Vladislav
        {
            "id": "task-exp-001",
            "board_key": "EXPENSES",
            "column_id": "col-exp-waiting",
            "title": "Офисная мебель (Olya)",
            "description": "Покупка новых стульев для офиса",
            "priority": "medium",
            "tags": ["офис", "мебель", "olya"],
            "due_date": "2025-03-01",
            "assignee_id": "olya-coo",
            "creator_id": "olya-coo",
            "amount": 15000,
            "category": "office_supplies"
        },
        {
            "id": "task-exp-002",
            "board_key": "EXPENSES",
            "column_id": "col-exp-waiting", 
            "title": "Программное обеспечение (Vladislav)",
            "description": "Лицензия на Adobe Creative Suite",
            "priority": "high",
            "tags": ["ПО", "лицензия", "vladislav"],
            "due_date": "2025-02-28",
            "assignee_id": "vladislav-001",
            "creator_id": "vladislav-001",
            "amount": 25000,
            "category": "software"
        },
        {
            "id": "task-exp-003",
            "board_key": "EXPENSES",
            "column_id": "col-exp-processing",
            "title": "Командировка в Москву (Olya)",
            "description": "Деловая поездка для переговоров с клиентом",
            "priority": "high",
            "tags": ["командировка", "москва", "olya"],
            "due_date": "2025-02-25",
            "assignee_id": "olya-coo",
            "creator_id": "olya-coo", 
            "amount": 45000,
            "category": "travel"
        },
        {
            "id": "task-exp-004",
            "board_key": "EXPENSES",
            "column_id": "col-exp-approved",
            "title": "Канцтовары (Vladislav)",
            "description": "Заказ канцелярских принадлежностей на квартал",
            "priority": "low",
            "tags": ["канцтовары", "квартал", "vladislav"],
            "due_date": None,
            "assignee_id": "vladislav-001",
            "creator_id": "vladislav-001",
            "amount": 8500,
            "category": "office_supplies"
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
    print("🌱 Starting seed process...")
    
    try:
        await clear_collections()
        await create_users()
        await create_boards()
        await create_columns()
        await create_tasks()
        
        print("\n✅ Seed completed successfully!")
        print("\nLogin credentials:")
        print("Admin: admin@company.com / admin123")
        print("Alice (Buyer): buyer@company.com / buyer123") 
        print("Bob (Buyer): buyer2@company.com / buyer123")
        print("Team Lead: lead@company.com / lead123")
        print("Olya COO: olya@company.com / olya123") 
        print("Vladislav: vladislav@company.com / vladislav123")
        print("Charlie (Designer): designer@company.com / designer123")
        print("David (Tech): tech@company.com / tech123")
        
    except Exception as e:
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())