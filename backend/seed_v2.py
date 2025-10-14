#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed v2 for Department-based ACL system (FIXED to match current Mongoose schema)
Создаёт департаменты, группы, юзеров (с указанными логинами/паролями), борды, колонки, задачи.
— Без passlib, только pyca/bcrypt (пароль режем до 72 байт).
— Перед заливкой сбрасываем индексы и создаём правильные (чтобы не ловить E11000 key:null).
— Исправления: fullName, passwordHash, roles:[string], флаги активации, createdAt/updatedAt.
"""

import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse  # оставляю как в твоём оригинале

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt as pybcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------- Mongo ----------
MONGO_URL = os.environ["MONGO_URL"]
# Если DB_NAME не задан, возьмём 'simplified_jira'
DB_NAME = os.getenv("DB_NAME") or "simplified_jira"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------- helpers ----------
def now_utc():
    return datetime.now(timezone.utc)

def hash_pw(p: str) -> str:
    """bcrypt с безопасным тримом до 72 байт (ограничение алгоритма)."""
    if not isinstance(p, str):
        p = str(p)
    data = p.encode("utf-8")[:72]
    return pybcrypt.hashpw(data, pybcrypt.gensalt()).decode("utf-8")

# ---------- housekeeping: clear + indexes ----------
async def clear_collections():
    print("Clearing existing data...")
    await db.users.delete_many({})
    await db.departments.delete_many({})
    await db.groups.delete_many({})
    await db.boards.delete_many({})
    await db.columns.delete_many({})
    await db.tasks.delete_many({})
    print("✓ Cleared all collections")

async def reset_indexes():
    """Сносим старые индексы и создаём корректные уникальные по нужным полям."""
    print("Resetting indexes...")

    # Departments
    try: await db.departments.drop_indexes()
    except Exception: pass
    await db.departments.create_index("id", unique=True)
    await db.departments.create_index("key", unique=True)

    # Groups
    try: await db.groups.drop_indexes()
    except Exception: pass
    await db.groups.create_index("id", unique=True)
    await db.groups.create_index("key", unique=True)

    # Boards
    try: await db.boards.drop_indexes()
    except Exception: pass
    await db.boards.create_index("id", unique=True)
    await db.boards.create_index("key", unique=True)

    # Columns
    try: await db.columns.drop_indexes()
    except Exception: pass
    await db.columns.create_index("id", unique=True)
    await db.columns.create_index([("board_id", 1), ("key", 1)], unique=True)

    # Users
    try: await db.users.drop_indexes()
    except Exception: pass
    await db.users.create_index("id", unique=True)
    await db.users.create_index("email", unique=True)

    # Tasks
    try: await db.tasks.drop_indexes()
    except Exception: pass
    await db.tasks.create_index("id", unique=True)
    await db.tasks.create_index("board_key")
    await db.tasks.create_index("department_id")

    print("✓ Indexes reset")

# ---------- data creators ----------
async def create_departments():
    print("Creating departments...")
    ts = now_utc()
    departments = [
        {
            "id": "dept-gambling",
            "key": "GAMBLING",
            "name": "Gambling",
            "type": "GAMBLING",
            "createdAt": ts,
            "updatedAt": ts,
        },
        {
            "id": "dept-swip",
            "key": "SWIP",
            "name": "SWIP",
            "type": "SWIP",
            "createdAt": ts,
            "updatedAt": ts,
        },
        {
            "id": "dept-admins",
            "key": "ADMINS",
            "name": "Admins",
            "type": "ADMINS",
            "createdAt": ts,
            "updatedAt": ts,
        },
    ]
    await db.departments.insert_many(departments)
    print(f"✓ Created {len(departments)} departments")

async def create_groups():
    print("Creating groups...")
    ts = now_utc()
    groups = [
        {
            "id": "group-gambling-core",
            "key": "GAM_CORE",
            "name": "Gambling Core",
            "department_id": "dept-gambling",
            "lead_user_id": "user-tl1-gambling",
            "member_ids": [
                "user-tech1-gambling",
                "user-tech2-gambling",
                "user-buyertech1-gambling",
                "user-buyertech2-gambling",
                "user-designer1-gambling",
                "user-designer2-gambling",
            ],
            "createdAt": ts,
            "updatedAt": ts,
        },
        {
            "id": "group-swip-core",
            "key": "SWIP_CORE",
            "name": "SWIP Core",
            "department_id": "dept-swip",
            "lead_user_id": "user-tl1-swip",
            "member_ids": [
                "user-buyer1-swip",
                "user-buyer2-swip",
                "user-tech1-swip",
                "user-tech2-swip",
                "user-designer1-swip",
                "user-designer2-swip",
            ],
            "createdAt": ts,
            "updatedAt": ts,
        },
    ]
    await db.groups.insert_many(groups)
    print(f"✓ Created {len(groups)} groups")

async def create_users():
    print("Creating users...")
    ts = now_utc()
    users = [
        # Главный админ
        {
            "id": "admin-001",
            "email": "admin@company.com",
            "passwordHash": hash_pw("admin123"),
            "fullName": "Super Admin",
            "roles": ["admin"],  # <— массив строк
            "groups": [],
            "primary_department_id": "dept-admins",
            "isActivated": True,
            "isActive": True,
            "active": True,
            "status": "active",
            "emailVerified": True,
            "isDisabled": False,
            "createdAt": ts,
            "updatedAt": ts,
        },

        # ====== GAMBLING ======
        {
            "id": "user-tech1-gambling",
            "email": "tech1@gambling.local",
            "passwordHash": hash_pw("f@DOr&hVMLfk"),
            "fullName": "Tech1 Gambling",
            "roles": ["tech"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tech2-gambling",
            "email": "tech2@gambling.local",
            "passwordHash": hash_pw("tW&hdG4g$yDy"),
            "fullName": "Tech2 Gambling",
            "roles": ["tech"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-buyertech1-gambling",
            "email": "buyertech1@gambling.local",
            "passwordHash": hash_pw("NkHSF&sdwPKq"),
            "fullName": "BuyerTech1 Gambling",
            "roles": ["buyer", "tech"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-buyertech2-gambling",
            "email": "buyertech2@gambling.local",
            "passwordHash": hash_pw("lHq52bN&QHV5"),
            "fullName": "BuyerTech2 Gambling",
            "roles": ["buyer", "tech"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-designer1-gambling",
            "email": "designer1@gambling.local",
            "passwordHash": hash_pw("sC#0ss0WYccc"),
            "fullName": "Designer1 Gambling",
            "roles": ["designer"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-designer2-gambling",
            "email": "designer2@gambling.local",
            "passwordHash": hash_pw("RbxTdBZeqwAB"),
            "fullName": "Designer2 Gambling",
            "roles": ["designer"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tl1-gambling",
            "email": "tl1@gambling.local",
            "passwordHash": hash_pw("@gNB#X4wYJ8#"),
            "fullName": "TeamLead1 Gambling",
            "roles": ["team_lead"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tl2-gambling",
            "email": "tl2@gambling.local",
            "passwordHash": hash_pw("LE3qVN1aFkL2"),
            "fullName": "TeamLead2 Gambling",
            "roles": ["team_lead"],
            "groups": ["group-gambling-core"],
            "primary_department_id": "dept-gambling",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },

        # ====== SWIP ======
        {
            "id": "user-buyer1-swip",
            "email": "buyer1@swip.local",
            "passwordHash": hash_pw("N8of*c1fVtXJ"),
            "fullName": "Buyer1 SWIP",
            "roles": ["buyer"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-buyer2-swip",
            "email": "buyer2@swip.local",
            "passwordHash": hash_pw("a4ytL%20SSHe"),
            "fullName": "Buyer2 SWIP",
            "roles": ["buyer"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tech1-swip",
            "email": "tech1@swip.local",
            "passwordHash": hash_pw("tech1@swip.local"),
            "fullName": "Tech1 SWIP",
            "roles": ["tech"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tech2-swip",
            "email": "tech2@swip.local",
            "passwordHash": hash_pw("$h%VNGYbo2sF"),
            "fullName": "Tech2 SWIP",
            "roles": ["tech"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-designer1-swip",
            "email": "designer1@swip.local",
            "passwordHash": hash_pw("$X!vu6B4PrLb"),
            "fullName": "Designer1 SWIP",
            "roles": ["designer"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-designer2-swip",
            "email": "designer2@swip.local",
            "passwordHash": hash_pw("0AuKjlC0f7a6"),
            "fullName": "Designer2 SWIP",
            "roles": ["designer"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tl1-swip",
            "email": "tl1@swip.local",
            "passwordHash": hash_pw("l8Tm9eQRfp$b"),
            "fullName": "TeamLead1 SWIP",
            "roles": ["team_lead"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
        {
            "id": "user-tl2-swip",
            "email": "tl2@swip.local",
            "passwordHash": hash_pw("6gStI9Oj#RqO"),
            "fullName": "TeamLead2 SWIP",
            "roles": ["team_lead"],
            "groups": ["group-swip-core"],
            "primary_department_id": "dept-swip",
            "isActivated": True, "isActive": True, "active": True,
            "status": "active", "emailVerified": True, "isDisabled": False,
            "createdAt": ts, "updatedAt": ts,
        },
    ]
    await db.users.insert_many(users)
    print(f"✓ Created {len(users)} users")

async def create_boards_and_columns():
    print("Creating boards & columns...")

    ts = now_utc()
    boards = [
        # Gambling
        {
            "id": "board-gambling",
            "key": "GAM",
            "name": "Gambling Board",
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
                "allowed_user_ids": [
                    "user-tl1-gambling",
                    "user-tl2-gambling",
                    "user-tech1-gambling",
                    "user-tech2-gambling",
                    "user-buyertech1-gambling",
                    "user-buyertech2-gambling",
                    "user-designer1-gambling",
                    "user-designer2-gambling",
                    "admin-001",
                ],
                "permissions": {"read": True, "create": True, "edit": True, "manage": True},
            },
            "content_filter": {"by_department": "viewer"},
            "members": [],
            "owners": ["admin-001"],
            "createdAt": ts,
            "updatedAt": ts,
        },
        # SWIP
        {
            "id": "board-swip",
            "key": "SWP",
            "name": "SWIP Board",
            "type": "tasks",
            "template": "kanban-basic",
            "is_archived": False,
            "settings": {"assignee_enabled": True},
            "default_department_id": "dept-swip",
            "visibility": {
                "department_ids": ["dept-swip"],
                "role_ids": [],
                "mode": "users",
                "allowed_group_ids": [],
                "allowed_user_ids": [
                    "user-tl1-swip",
                    "user-tl2-swip",
                    "user-buyer1-swip",
                    "user-buyer2-swip",
                    "user-tech1-swip",
                    "user-tech2-swip",
                    "user-designer1-swip",
                    "user-designer2-swip",
                    "admin-001",
                ],
                "permissions": {"read": True, "create": True, "edit": True, "manage": True},
            },
            "content_filter": {"by_department": "viewer"},
            "members": [],
            "owners": ["admin-001"],
            "createdAt": ts,
            "updatedAt": ts,
        },
    ]

    columns = [
        # Gambling columns
        {"id": "col-gam-todo", "board_id": "board-gambling", "key": "TODO", "name": "Todo", "order": 1, "createdAt": ts, "updatedAt": ts},
        {"id": "col-gam-doing", "board_id": "board-gambling", "key": "IN_PROGRESS", "name": "In Progress", "order": 2, "createdAt": ts, "updatedAt": ts},
        {"id": "col-gam-done", "board_id": "board-gambling", "key": "DONE", "name": "Done", "order": 3, "createdAt": ts, "updatedAt": ts},
        # SWIP columns
        {"id": "col-swp-todo", "board_id": "board-swip", "key": "TODO", "name": "Todo", "order": 1, "createdAt": ts, "updatedAt": ts},
        {"id": "col-swp-doing", "board_id": "board-swip", "key": "IN_PROGRESS", "name": "In Progress", "order": 2, "createdAt": ts, "updatedAt": ts},
        {"id": "col-swp-done", "board_id": "board-swip", "key": "DONE", "name": "Done", "order": 3, "createdAt": ts, "updatedAt": ts},
    ]

    await db.boards.insert_many(boards)
    await db.columns.insert_many(columns)
    print(f"✓ Created {len(boards)} boards, {len(columns)} columns")

async def create_tasks():
    print("Creating tasks...")
    ts = now_utc()
    tasks = [
        # Gambling sample tasks
        {
            "id": "task-gam-001",
            "board_key": "GAM",
            "column_id": "col-gam-todo",
            "title": "Kickoff Gambling Campaign",
            "description": "Подготовить initial setup",
            "priority": "high",
            "tags": ["kickoff", "setup"],
            "due_date": None,
            "assignee_id": "user-tl1-gambling",
            "creator_id": "admin-001",
            "department_id": "dept-gambling",
            "createdAt": ts,
            "updatedAt": ts,
        },
        {
            "id": "task-gam-002",
            "board_key": "GAM",
            "column_id": "col-gam-doing",
            "title": "Integrate trackers",
            "description": "Поставить пиксели и события",
            "priority": "medium",
            "tags": ["tracking"],
            "due_date": None,
            "assignee_id": "user-tech1-gambling",
            "creator_id": "user-tl1-gambling",
            "department_id": "dept-gambling",
            "createdAt": ts,
            "updatedAt": ts,
        },
        # SWIP sample tasks
        {
            "id": "task-swp-001",
            "board_key": "SWP",
            "column_id": "col-swp-todo",
            "title": "Creative brief SWIP",
            "description": "Собрать исходники",
            "priority": "high",
            "tags": ["brief", "design"],
            "due_date": None,
            "assignee_id": "user-designer1-swip",
            "creator_id": "user-tl1-swip",
            "department_id": "dept-swip",
            "createdAt": ts,
            "updatedAt": ts,
        },
        {
            "id": "task-swp-002",
            "board_key": "SWP",
            "column_id": "col-swp-doing",
            "title": "Proxy domains SWIP",
            "description": "Поднять прокси домены для прогонов",
            "priority": "medium",
            "tags": ["infra"],
            "due_date": None,
            "assignee_id": "user-tech2-swip",
            "creator_id": "user-tl2-swip",
            "department_id": "dept-swip",
            "createdAt": ts,
            "updatedAt": ts,
        },
    ]
    await db.tasks.insert_many(tasks)
    print(f"✓ Created {len(tasks)} tasks")

# ---------- main ----------
async def main():
    print("🌱 Seeding started...")
    try:
        # проверка соединения заранее (чтобы не ждать в середине)
        await db.command("ping")
        await clear_collections()
        await reset_indexes()
        await create_departments()
        await create_groups()
        await create_users()
        await create_boards_and_columns()
        await create_tasks()
        print("\n✅ Seed completed!")
        print("\nLogin credentials (plain):")
        print("Super Admin: admin@company.com / admin123")
        print("— GAMBLING —")
        print("tech1@gambling.local / f@DOr&hVMLfk")
        print("tech2@gambling.local / tW&hdG4g$yDy")
        print("buyertech1@gambling.local / NkHSF&sdwPKq")
        print("buyertech2@gambling.local / lHq52bN&QHV5")
        print("designer1@gambling.local / sC#0ss0WYccc")
        print("designer2@gambling.local / RbxTdBZeqwAB")
        print("tl1@gambling.local / @gNB#X4wYJ8#")
        print("tl2@gambling.local / LE3qVN1aFkL2")
        print("— SWIP —")
        print("buyer1@swip.local / N8of*c1fVtXJ")
        print("buyer2@swip.local / a4ytL%20SSHe")
        print("tech1@swip.local / tech1@swip.local")
        print("tech2@swip.local / $h%VNGYbo2sF")
        print("designer1@swip.local / $X!vu6B4PrLb")
        print("designer2@swip.local / 0AuKjlC0f7a6")
        print("tl1@swip.local / l8Tm9eQRfp$b")
        print("tl2@swip.local / 6gStI9Oj#RqO")
    except Exception as e:
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())