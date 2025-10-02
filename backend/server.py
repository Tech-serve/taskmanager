from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr
from passlib.hash import bcrypt
import jwt
import os
import logging
import uuid
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-here')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

app = FastAPI(title="Simplified Jira API")
api_router = APIRouter(prefix="/api")

# Enums
# New Department-based role system
class SystemRole(str, Enum):
    CEO = "ceo"      # C-level: full access
    COO = "coo"      # C-level: full access  
    CTO = "cto"      # C-level: full access
    HEAD = "head"    # Department head: sees all department buyers
    LEAD = "lead"    # Team lead: sees own team buyers
    BUYER = "buyer"  # Department buyer: sees own tasks
    DESIGNER = "designer"  # Department designer: sees own tasks
    TECH = "tech"    # Department tech: sees own tasks
    OFFICE_MANAGER = "office_manager"  # Office: expenses only

class DepartmentType(str, Enum):
    GAMBLING = "gambling"
    SWEEPS = "sweeps" 
    OFFICE = "office"
    TECH = "tech"
    ADMINS = "admins"

class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class BoardType(str, Enum):
    TASKS = "tasks"
    EXPENSES = "expenses"

class Template(str, Enum):
    KANBAN_BASIC = "kanban-basic"
    KANBAN_TJ_TECH = "kanban-tj-tech"
    EMPTY = "empty"

# New ACL Models
class Department(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: DepartmentType
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoleRef(BaseModel):
    role: SystemRole
    department_id: Optional[str] = None  # None for C-level roles

class Group(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    department_id: str
    lead_user_id: Optional[str] = None  # Lead who manages this group
    member_ids: List[str] = []  # List of buyer user IDs in this group
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BoardVisibility(BaseModel):
    department_ids: List[str] = []  # Narrows pickers only
    role_ids: List[str] = []        # Narrows pickers only  
    mode: str = "users"             # 'groups' | 'users'
    allowed_group_ids: List[str] = []  # Set only if mode='groups'
    allowed_user_ids: List[str] = []   # Set only if mode='users'
    permissions: dict = {
        "read": True, 
        "create": True, 
        "edit": True, 
        "manage": False
    }

class ContentFilter(BaseModel):
    by_department: Optional[str] = None  # 'all' | 'viewer' | department_id

# Pydantic Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    full_name: str
    roles: List[RoleRef] = []  # New role system with department context
    groups: List[str] = []     # Group IDs user belongs to
    primary_department_id: Optional[str] = None  # Required for buyer/designer
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInDB(User):
    password_hash: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    roles: List[SystemRole]
    groups: Optional[List[str]] = []

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

class Board(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    key: str
    type: BoardType = BoardType.TASKS
    template: Template = Template.KANBAN_BASIC
    is_archived: bool = False
    settings: Dict[str, Any] = Field(default_factory=lambda: {"assignee_enabled": True})
    default_department_id: Optional[str] = None
    visibility: BoardVisibility = Field(default_factory=BoardVisibility)
    content_filter: Optional[ContentFilter] = None
    # Legacy fields - will be migrated
    allowed_roles: Optional[List[str]] = []
    allowed_group_ids: Optional[List[str]] = []
    members: Optional[List[str]] = []
    owners: Optional[List[str]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BoardCreate(BaseModel):
    name: str
    key: str
    type: BoardType = BoardType.TASKS
    template: Template = Template.KANBAN_BASIC
    allowed_roles: Optional[List[SystemRole]] = []
    allowed_group_ids: Optional[List[str]] = []
    members: Optional[List[str]] = []
    owners: Optional[List[str]] = []

class Column(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    board_id: str
    key: str
    name: str
    order: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ColumnCreate(BaseModel):
    key: str
    name: str
    order: int

class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    board_key: str
    column_id: str
    title: str
    description: Optional[str] = None
    priority: Optional[Priority] = Priority.MEDIUM
    tags: Optional[List[str]] = []
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    creator_id: str
    department_id: str  # Required - which department this task belongs to
    routed_from: Optional[Dict[str, Any]] = None  # Track cross-team routing
    amount: Optional[float] = None  # For expense tasks
    category: Optional[str] = None  # For expense tasks 
    receipt_url: Optional[str] = None  # For expense tasks
    comments: Optional[List[Dict[str, Any]]] = []  # Comments for tasks
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskCreate(BaseModel):
    board_key: str
    column_id: str
    title: str
    description: Optional[str] = None
    priority: Optional[Priority] = Priority.MEDIUM
    tags: Optional[List[str]] = []
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    amount: Optional[float] = None  # For expense tasks
    category: Optional[str] = None  # For expense tasks 
    receipt_url: Optional[str] = None  # For expense tasks

class TaskUpdate(BaseModel):
    column_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[Priority] = None
    tags: Optional[List[str]] = None
    due_date: Optional[str] = None
    assignee_id: Optional[str] = None
    amount: Optional[float] = None  # For expense tasks
    category: Optional[str] = None  # For expense tasks 
    receipt_url: Optional[str] = None  # For expense tasks

# Utility Functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    return bcrypt.hash(password)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_dict = await db.users.find_one({"id": user_id})
    if user_dict is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_dict)

async def check_board_access(user: User, board_key: str) -> Board:
    """Check if user has access to the board and return board data"""
    board_dict = await db.boards.find_one({"key": board_key})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    board = Board(**board_dict)
    
    # C-level users can access all boards
    if is_c_level(user):
        return board
    
    # Check new visibility system if it exists
    if hasattr(board, 'visibility') and board.visibility:
        # Special logic for buyers - they can access tech and designer boards from their department
        user_roles = [role_ref.role if hasattr(role_ref, 'role') else role_ref for role_ref in user.roles]
        
        if SystemRole.BUYER in user_roles:
            # Buyers can access:
            # 1. Their own department's tech/designer boards
            # 2. Boards where they are explicitly allowed
            user_dept = user.primary_department_id
            
            # Check if this is a tech board (all buyers can access)
            if board.key == 'TECH':
                return board
            
            # Check if this is a designer board from buyer's department
            if user_dept == "dept-gambling" and board.key == 'GAM_DES':
                return board
            elif user_dept == "dept-sweeps" and board.key == 'SWE_DES':
                return board
        
        if board.visibility.mode == "users":
            if user.id in board.visibility.allowed_user_ids:
                return board
        elif board.visibility.mode == "groups":
            user_groups = set(user.groups)
            allowed_groups = set(board.visibility.allowed_group_ids)
            if user_groups.intersection(allowed_groups):
                return board
        
        # If new system exists but user not allowed, deny access
        raise HTTPException(status_code=403, detail="Access denied to this board")
    
    # Fallback to legacy system for backwards compatibility
    # Legacy: Admin can access all boards
    legacy_roles = [role_ref.role.value if hasattr(role_ref, 'role') else role_ref 
                   for role_ref in user.roles]
    if "admin" in legacy_roles:
        return board
    
    # Check role-based access
    if board.allowed_roles and any(role in user.roles for role in board.allowed_roles):
        return board
    
    # Check if user is a member or owner
    if board.members and user.id in board.members:
        return board
    if board.owners and user.id in board.owners:
        return board
    
    raise HTTPException(status_code=403, detail="Access denied to this board")

# Auth Routes
@api_router.post("/auth/register", response_model=User, status_code=201)
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password and create user
    user_dict = user_data.dict()
    user_dict["password_hash"] = hash_password(user_data.password)
    del user_dict["password"]  # Remove plain password
    
    user = UserInDB(**user_dict)
    await db.users.insert_one(user.dict())
    
    # Return user without password
    return User(**{k: v for k, v in user.dict().items() if k != "password_hash"})

@api_router.post("/auth/login", response_model=Token)
async def login(user_login: UserLogin):
    user_dict = await db.users.find_one({"email": user_login.email})
    if not user_dict or not verify_password(user_login.password, user_dict["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = User(**user_dict)
    access_token = create_access_token(data={"sub": user.id})
    return Token(access_token=access_token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

# User Routes
@api_router.post("/tasks/{task_id}/comments")
async def add_comment(task_id: str, comment_data: dict, current_user: User = Depends(get_current_user)):
    # Find existing task
    task_dict = await db.tasks.find_one({"id": task_id})
    if not task_dict:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check board access
    await check_board_access(current_user, task_dict["board_key"])
    
    # Create comment
    comment = {
        "id": str(uuid.uuid4()),
        "text": comment_data.get("text", ""),
        "author_id": current_user.id,
        "author_name": current_user.full_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Add comment to task
    await db.tasks.update_one(
        {"id": task_id},
        {
            "$push": {"comments": comment},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {"message": "Comment added successfully", "comment": comment}

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    # Everyone can see all users for task assignment (default behavior)
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    return [User(**user) for user in users]

# Admin User Management Routes
@api_router.get("/admin/users", response_model=List[User])
async def get_admin_users(current_user: User = Depends(get_current_user)):
    """Get all users. Admin only."""
    check_admin_access(current_user)
    users = await db.users.find({}, {"password_hash": 0}).to_list(length=None)
    return [User(**user) for user in users]

@api_router.post("/admin/users", response_model=User, status_code=201)
async def create_user(user_data: dict, current_user: User = Depends(get_current_user)):
    """Create new user. C-level only."""
    check_admin_access(current_user)
    
    # Check if user with same email exists
    existing = await db.users.find_one({"email": user_data["email"]})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Hash password if provided
    from passlib.hash import bcrypt
    if "password" in user_data:
        user_data["password_hash"] = bcrypt.hash(user_data["password"])
        del user_data["password"]  # Remove plain password
    
    # Create user with default values
    user_data.setdefault("created_at", datetime.now(timezone.utc))
    user_data.setdefault("updated_at", datetime.now(timezone.utc))
    
    user = User(**user_data)
    await db.users.insert_one(user.dict())
    return user

@api_router.put("/admin/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: dict, current_user: User = Depends(get_current_user)):
    """Update user. C-level only."""
    check_admin_access(current_user)
    
    # Find user
    user_dict = await db.users.find_one({"id": user_id})
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check email conflict (if email is being changed)
    if "email" in user_data and user_data["email"] != user_dict["email"]:
        existing = await db.users.find_one({"email": user_data["email"]})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
    
    # Hash password if provided
    from passlib.hash import bcrypt
    if "password" in user_data:
        user_data["password_hash"] = bcrypt.hash(user_data["password"])
        del user_data["password"]  # Remove plain password
    
    # Update timestamp
    user_data["updated_at"] = datetime.now(timezone.utc)
    
    # Update user
    await db.users.update_one({"id": user_id}, {"$set": user_data})
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    return User(**updated_user)

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete user. C-level only."""
    check_admin_access(current_user)
    
    # Prevent admin from deleting themselves
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete user
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@api_router.get("/boards/{board_key}/assignable-users", response_model=List[User])
async def get_assignable_users(board_key: str, current_user: User = Depends(get_current_user)):
    """Get users that can be assigned tasks on a specific board"""
    # Check board access first
    await check_board_access(current_user, board_key)
    
    # All users can be assignees on all boards
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    if user_id != current_user.id and SystemRole.CEO not in [role_ref.role for role_ref in current_user.roles]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user_dict = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_dict)

class UserCreateAdmin(BaseModel):
    email: EmailStr
    password: str
    fullName: str
    roles: List[SystemRole]
    
class UserUpdate(BaseModel):
    fullName: Optional[str] = None
    email: Optional[EmailStr] = None
    roles: Optional[List[SystemRole]] = None
    status: Optional[str] = None

@api_router.post("/users", response_model=Dict[str, Any])
async def create_user(user_data: UserCreateAdmin, current_user: User = Depends(get_current_user)):
    if not is_c_level(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Hash password
    password_hash = bcrypt.hash(user_data.password)
    
    # Create user document
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user_data.email.lower(),
        "full_name": user_data.fullName,
        "password_hash": password_hash,
        "roles": [{"role": role.value, "department_id": None} for role in user_data.roles],
        "groups": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Insert user
    result = await db.users.insert_one(user_doc)
    
    # Return user data without password hash
    user_response = User(**{k: v for k, v in user_doc.items() if k != "password_hash"})
    
    return {
        "user": {
            "id": user_response.id,
            "email": user_response.email,
            "full_name": user_response.full_name,
            "roles": user_response.roles,
            "created_at": user_response.created_at,
            "updated_at": user_response.updated_at
        },
        "message": "User created successfully"
    }

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_data: UserUpdate, current_user: User = Depends(get_current_user)):
    if not is_c_level(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find user
    user_dict = await db.users.find_one({"id": user_id})
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prepare update data
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if user_data.fullName is not None:
        update_data["full_name"] = user_data.fullName
    if user_data.email is not None:
        # Check if email is already taken by another user
        existing_user = await db.users.find_one({"email": user_data.email.lower(), "id": {"$ne": user_id}})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already taken by another user")
        update_data["email"] = user_data.email.lower()
    if user_data.roles is not None:
        update_data["roles"] = [{"role": role.value, "department_id": None} for role in user_data.roles]
    
    # Update user
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    # Return updated user
    updated_user_dict = await db.users.find_one({"id": user_id}, {"password_hash": 0})
    return User(**updated_user_dict)

@api_router.delete("/users/{user_id}", response_model=Dict[str, str])
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if not is_c_level(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Prevent admin from deleting themselves
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Find user
    user_dict = await db.users.find_one({"id": user_id})
    if not user_dict:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "User deleted successfully"}

# Board Routes
@api_router.get("/boards", response_model=List[Board])
async def get_boards(current_user: User = Depends(get_current_user)):
    query = {}
    
    # C-level users (CEO/COO/CTO) see all boards
    if not is_c_level(current_user):
        # Non C-level users see boards based on visibility settings, roles, membership, or ownership
        user_role_strings = [role_ref.role.value if hasattr(role_ref, 'role') else role_ref 
                           for role_ref in current_user.roles]
        
        # Special logic for buyers - they can access tech and designer boards from their department
        buyer_department_boards = []
        if SystemRole.BUYER.value in user_role_strings and current_user.primary_department_id:
            # Buyers can see tech and designer boards from their department
            user_dept = current_user.primary_department_id
            if user_dept == "dept-gambling":
                buyer_department_boards = ["TECH", "GAM_DES"]
            elif user_dept == "dept-sweeps":
                buyer_department_boards = ["TECH", "SWE_DES"]
        
        query_conditions = [
            # New visibility system
            {"visibility.mode": "users", "visibility.allowed_user_ids": current_user.id},
            {"visibility.mode": "groups", "visibility.allowed_group_ids": {"$in": current_user.groups}},
            # Legacy system fallback
            {"allowed_roles": {"$in": user_role_strings}},
            {"members": current_user.id},
            {"owners": current_user.id}
        ]
        
        # Add buyer department boards access
        if buyer_department_boards:
            query_conditions.append({"key": {"$in": buyer_department_boards}})
        
        query = {"$or": query_conditions}
    
    boards = await db.boards.find(query).to_list(1000)
    return [Board(**board) for board in boards]

@api_router.get("/boards/by-key/{board_key}", response_model=Board)
async def get_board_by_key(board_key: str, current_user: User = Depends(get_current_user)):
    return await check_board_access(current_user, board_key)

@api_router.post("/boards", response_model=Board, status_code=201)
async def create_board(board_data: BoardCreate, current_user: User = Depends(get_current_user)):
    if not is_c_level(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if board key already exists
    existing_board = await db.boards.find_one({"key": board_data.key})
    if existing_board:
        raise HTTPException(status_code=400, detail="Board key already exists")
    
    board_dict = board_data.dict()
    board = Board(**board_dict)
    await db.boards.insert_one(board.dict())
    return board

@api_router.patch("/boards/{board_id}", response_model=Board)
async def update_board(board_id: str, board_update: dict, current_user: User = Depends(get_current_user)):
    # Find existing board
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    board = Board(**board_dict)
    
    # Check permissions (admin, owners)
    if (SystemRole.CEO not in current_user.roles and 
        current_user.id not in (board.owners or [])):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Update board
    update_data = {k: v for k, v in board_update.items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.boards.update_one({"id": board_id}, {"$set": update_data})
    
    # Return updated board
    updated_board_dict = await db.boards.find_one({"id": board_id})
    return Board(**updated_board_dict)

@api_router.delete("/boards/{board_id}")
async def delete_board(board_id: str, current_user: User = Depends(get_current_user)):
    # Find existing board
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    board = Board(**board_dict)
    
    # Check permissions (admin, owners)
    if (SystemRole.CEO not in current_user.roles and 
        current_user.id not in (board.owners or [])):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Delete board and associated data
    await db.boards.delete_one({"id": board_id})
    await db.columns.delete_many({"board_id": board_id})
    await db.tasks.delete_many({"board_key": board["key"]})
    
    return {"message": "Board deleted successfully"}

# Column Routes
@api_router.get("/boards/{board_id}/columns", response_model=List[Column])
async def get_board_columns(board_id: str, current_user: User = Depends(get_current_user)):
    # Find board first to get the key for access check
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Check access
    await check_board_access(current_user, board_dict["key"])
    
    columns = await db.columns.find({"board_id": board_id}).sort("order", 1).to_list(1000)
    return [Column(**column) for column in columns]

@api_router.post("/boards/{board_id}/columns", response_model=Column, status_code=201)
async def create_column(board_id: str, column_data: ColumnCreate, current_user: User = Depends(get_current_user)):
    # Find board first to get the key for access check
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Check access (only admin, owners can create columns)
    board = await check_board_access(current_user, board_dict["key"])
    if SystemRole.CEO not in current_user.roles and current_user.id not in (board.owners or []):
        raise HTTPException(status_code=403, detail="Only board owners can create columns")
    
    column_dict = column_data.dict()
    column_dict["board_id"] = board_id
    column = Column(**column_dict)
    await db.columns.insert_one(column.dict())
    return column

@api_router.patch("/columns/{column_id}", response_model=Column)
async def update_column(column_id: str, column_update: dict, current_user: User = Depends(get_current_user)):
    # Find existing column
    column_dict = await db.columns.find_one({"id": column_id})
    if not column_dict:
        raise HTTPException(status_code=404, detail="Column not found")
    
    # Find board to check permissions
    board_dict = await db.boards.find_one({"id": column_dict["board_id"]})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    board = Board(**board_dict)
    
    # Check permissions (admin, owners)
    if (SystemRole.CEO not in current_user.roles and 
        current_user.id not in (board.owners or [])):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Update column
    update_data = {k: v for k, v in column_update.items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.columns.update_one({"id": column_id}, {"$set": update_data})
    
    # Return updated column
    updated_column_dict = await db.columns.find_one({"id": column_id})
    return Column(**updated_column_dict)

@api_router.delete("/columns/{column_id}")
async def delete_column(column_id: str, current_user: User = Depends(get_current_user)):
    # Find existing column
    column_dict = await db.columns.find_one({"id": column_id})
    if not column_dict:
        raise HTTPException(status_code=404, detail="Column not found")
    
    # Find board to check permissions
    board_dict = await db.boards.find_one({"id": column_dict["board_id"]})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    board = Board(**board_dict)
    
    # Check permissions (admin, owners)
    if (SystemRole.CEO not in current_user.roles and 
        current_user.id not in (board.owners or [])):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check if column has tasks
    tasks_count = await db.tasks.count_documents({"column_id": column_id})
    if tasks_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete column with tasks")
    
    # Delete column
    await db.columns.delete_one({"id": column_id})
    
    return {"message": "Column deleted successfully"}

# Admin Routes - Departments, Roles, Groups
def check_admin_access(user: User):
    """Check if user has admin access (CEO/COO/CTO)"""
    admin_roles = {SystemRole.CEO, SystemRole.COO, SystemRole.CTO}
    user_system_roles = {role_ref.role for role_ref in user.roles}
    if not admin_roles.intersection(user_system_roles):
        raise HTTPException(status_code=403, detail="Admin access required")

def has_system_role(user: User, role: SystemRole) -> bool:
    """Check if user has specific system role"""
    return any(role_ref.role == role for role_ref in user.roles)

def is_c_level(user: User) -> bool:
    """Check if user is C-level (CEO/COO/CTO)"""
    return any(has_system_role(user, role) for role in [SystemRole.CEO, SystemRole.COO, SystemRole.CTO])

def get_user_departments(user: User) -> List[str]:
    """Get list of department IDs user belongs to"""
    department_ids = []
    if user.primary_department_id:
        department_ids.append(user.primary_department_id)
    # Add departments from roles
    for role_ref in user.roles:
        if role_ref.department_id and role_ref.department_id not in department_ids:
            department_ids.append(role_ref.department_id)
    return department_ids

def get_user_groups(user: User) -> List[str]:
    """Get list of group IDs user belongs to or leads"""
    return user.groups

@api_router.get("/admin/departments", response_model=List[Department])
async def get_departments(current_user: User = Depends(get_current_user)):
    check_admin_access(current_user)
    departments = await db.departments.find({}).to_list(1000)
    return [Department(**dept) for dept in departments]

@api_router.post("/admin/departments", response_model=Department, status_code=201)
async def create_department(dept_data: dict, current_user: User = Depends(get_current_user)):
    check_admin_access(current_user)
    
    # Check if department with same name exists
    existing = await db.departments.find_one({"name": dept_data["name"]})
    if existing:
        raise HTTPException(status_code=400, detail="Department name already exists")
    
    department = Department(**dept_data)
    await db.departments.insert_one(department.dict())
    return department

@api_router.get("/admin/groups", response_model=List[Group])
async def get_groups(current_user: User = Depends(get_current_user)):
    check_admin_access(current_user)
    groups = await db.groups.find({}).to_list(1000)
    return [Group(**group) for group in groups]

@api_router.post("/admin/groups", response_model=Group, status_code=201)
async def create_group(group_data: dict, current_user: User = Depends(get_current_user)):
    check_admin_access(current_user)
    group = Group(**group_data)
    await db.groups.insert_one(group.dict())
    return group

@api_router.put("/admin/groups/{group_id}", response_model=Group)
async def update_group(group_id: str, group_data: dict, current_user: User = Depends(get_current_user)):
    """Update group. Admin only."""
    check_admin_access(current_user)
    
    # Find group
    group_dict = await db.groups.find_one({"id": group_id})
    if not group_dict:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Update group data
    group_data["id"] = group_id  # Preserve ID
    group_data["updated_at"] = datetime.now(timezone.utc)
    if "created_at" not in group_data:
        group_data["created_at"] = group_dict.get("created_at", datetime.now(timezone.utc))
    
    group = Group(**group_data)
    await db.groups.replace_one({"id": group_id}, group.dict())
    return group

@api_router.delete("/admin/groups/{group_id}")
async def delete_group(group_id: str, current_user: User = Depends(get_current_user)):
    """Delete group. Admin only."""
    check_admin_access(current_user)
    
    # Find group
    group_dict = await db.groups.find_one({"id": group_id})
    if not group_dict:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Delete group
    await db.groups.delete_one({"id": group_id})
    
    return {"message": "Group deleted successfully"}

@api_router.patch("/groups/{group_id}/members", response_model=Group)
async def update_group_members(
    group_id: str, 
    member_update: dict, 
    current_user: User = Depends(get_current_user)
):
    """Add/remove members from a group. Accessible by group lead or admin."""
    # Find group
    group_dict = await db.groups.find_one({"id": group_id})
    if not group_dict:
        raise HTTPException(status_code=404, detail="Group not found")
    
    group = Group(**group_dict)
    
    # Check access: either admin or group lead
    is_admin = any(role_ref.role in {SystemRole.CEO, SystemRole.COO, SystemRole.CTO} 
                   for role_ref in current_user.roles)
    is_group_lead = group.lead_user_id == current_user.id
    
    if not (is_admin or is_group_lead):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update members
    if "add_members" in member_update:
        for member_id in member_update["add_members"]:
            if member_id not in group.member_ids:
                group.member_ids.append(member_id)
    
    if "remove_members" in member_update:
        for member_id in member_update["remove_members"]:
            if member_id in group.member_ids:
                group.member_ids.remove(member_id)
    
    group.updated_at = datetime.now(timezone.utc)
    
    # Update in database
    await db.groups.replace_one({"id": group_id}, group.dict())
    return group

@api_router.patch("/boards/{board_id}/visibility", response_model=Board)
async def update_board_visibility(
    board_id: str,
    visibility_update: dict,
    current_user: User = Depends(get_current_user)
):
    """Update board visibility settings. C-level only."""
    check_admin_access(current_user)
    
    # Find board
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Validate visibility mode
    visibility_data = visibility_update.get("visibility", {})
    mode = visibility_data.get("mode", "users")
    
    # Server invariants validation
    if mode == "groups" and visibility_data.get("allowed_user_ids"):
        raise HTTPException(status_code=400, detail="Groups mode cannot have allowed_user_ids")
    if mode == "users" and visibility_data.get("allowed_group_ids"):
        raise HTTPException(status_code=400, detail="Users mode cannot have allowed_group_ids")
    
    # Update visibility
    update_data = {
        "visibility": visibility_data,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.boards.update_one({"id": board_id}, {"$set": update_data})
    
    # Return updated board
    updated_board = await db.boards.find_one({"id": board_id})
    return Board(**updated_board)

@api_router.patch("/boards/{board_id}/content-filter", response_model=Board)
async def update_board_content_filter(
    board_id: str,
    filter_update: dict,
    current_user: User = Depends(get_current_user)
):
    """Update board content filter settings. C-level only."""
    check_admin_access(current_user)
    
    # Find board
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Update content filter
    update_data = {
        "content_filter": filter_update.get("content_filter"),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.boards.update_one({"id": board_id}, {"$set": update_data})
    
    # Return updated board
    updated_board = await db.boards.find_one({"id": board_id})
    return Board(**updated_board)

@api_router.patch("/boards/{board_id}", response_model=Board)
async def update_board_settings(
    board_id: str,
    board_update: dict,
    current_user: User = Depends(get_current_user)
):
    """Update board settings including defaultDepartmentId. C-level only."""
    check_admin_access(current_user)
    
    # Find board
    board_dict = await db.boards.find_one({"id": board_id})
    if not board_dict:
        raise HTTPException(status_code=404, detail="Board not found")
    
    # Update board
    update_data = {
        **board_update,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.boards.update_one({"id": board_id}, {"$set": update_data})
    
    # Return updated board
    updated_board = await db.boards.find_one({"id": board_id})
    return Board(**updated_board)

# Expenses Dashboard Routes
@api_router.get("/expenses/dashboard")
async def get_expenses_dashboard(
    department_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get expenses dashboard data with department-scoped access control"""
    
    # Check role-based access
    user_roles = [role_ref.role if hasattr(role_ref, 'role') else SystemRole(role_ref) 
                 for role_ref in current_user.roles]
    
    # Office managers can only see their own department
    if SystemRole.OFFICE_MANAGER in user_roles:
        if not current_user.primary_department_id:
            raise HTTPException(status_code=403, detail="Office manager must have assigned department")
        department_id = current_user.primary_department_id
    
    # Build query for expense tasks
    query = {"board_key": "EXPENSES"}
    
    # Apply department filter if specified
    if department_id:
        query["department_id"] = department_id
    
    # Apply date filter if specified
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        query["created_at"] = date_filter
    
    # Get expense tasks
    expense_tasks = await db.tasks.find(query).to_list(1000)
    
    # Calculate aggregations
    total_amount = 0
    category_totals = {}
    department_totals = {}
    monthly_totals = {}
    board_totals = {"EXPENSES": 0}  # For future multiple expense boards
    
    for task in expense_tasks:
        amount = task.get("amount", 0) or 0
        category = task.get("category", "uncategorized")
        task_dept_id = task.get("department_id")
        created_at = task.get("created_at")
        
        # Total amount
        total_amount += amount
        
        # Category totals
        category_totals[category] = category_totals.get(category, 0) + amount
        
        # Department totals
        if task_dept_id:
            department_totals[task_dept_id] = department_totals.get(task_dept_id, 0) + amount
        
        # Monthly totals (if created_at exists)
        if created_at:
            month_key = created_at[:7] if isinstance(created_at, str) else created_at.strftime("%Y-%m")
            monthly_totals[month_key] = monthly_totals.get(month_key, 0) + amount
        
        # Board totals
        board_totals["EXPENSES"] += amount
    
    # Get department names for totals
    departments = await db.departments.find({}).to_list(100)
    dept_name_map = {dept["id"]: dept["name"] for dept in departments}
    
    # Format department totals with names
    department_totals_formatted = [
        {
            "department_id": dept_id,
            "department_name": dept_name_map.get(dept_id, "Unknown"),
            "total": total
        }
        for dept_id, total in department_totals.items()
    ]
    
    # Format category totals as list
    category_totals_formatted = [
        {"category": category, "total": total}
        for category, total in category_totals.items()
    ]
    
    # Format monthly totals as list
    monthly_totals_formatted = [
        {"month": month, "total": total}
        for month, total in sorted(monthly_totals.items())
    ]
    
    return {
        "summary": {
            "total_amount": total_amount,
            "total_tasks": len(expense_tasks),
            "department_filter": department_id,
            "date_range": {"from": from_date, "to": to_date}
        },
        "aggregations": {
            "by_category": category_totals_formatted,
            "by_department": department_totals_formatted,
            "by_month": monthly_totals_formatted,
            "by_board": [{"board": "EXPENSES", "total": board_totals["EXPENSES"]}]
        },
        "chart_data": {
            "categories": category_totals,
            "departments": {dept["department_name"]: dept["total"] 
                          for dept in department_totals_formatted},
            "boards": board_totals
        },
        "access_info": {
            "user_role": user_roles[0].value if user_roles else "unknown",
            "restricted_department": department_id if SystemRole.OFFICE_MANAGER in user_roles else None
        }
    }

# Task Routes
@api_router.get("/boards/{board_key}/tasks", response_model=List[Task])
async def get_board_tasks(
    board_key: str,
    columns: Optional[str] = None,
    assignees: Optional[str] = None,
    q: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    # Check board access
    await check_board_access(current_user, board_key)
    
    # Build base query
    query = {"board_key": board_key}
    
    # Apply role-based task filtering
    if not is_c_level(current_user):
        # Check user roles
        user_roles = [role_ref.role if hasattr(role_ref, 'role') else SystemRole(role_ref) 
                     for role_ref in current_user.roles]
        
        if board_key == "EXPENSES":
            # On expenses board, everyone sees only their own tasks (creator or assignee)
            query["$or"] = [
                {"creator_id": current_user.id},
                {"assignee_id": current_user.id}
            ]
        elif SystemRole.HEAD in user_roles:
            # HEAD sees all tasks from their department on all boards (except expenses)
            if board_key != "EXPENSES":
                # Get all users from same department
                department_user_ids = []
                async for user_dict in db.users.find({"primary_department_id": current_user.primary_department_id}):
                    department_user_ids.append(user_dict["id"])
                
                query["$or"] = [
                    {"creator_id": {"$in": department_user_ids}},  # All tasks from department users
                    {"assignee_id": {"$in": department_user_ids}}, # All tasks assigned to department users
                ]
            else:
                # On expenses board, HEAD sees only their own tasks
                query["$or"] = [
                    {"creator_id": current_user.id},
                    {"assignee_id": current_user.id}
                ]
        elif SystemRole.LEAD in user_roles:
            # LEAD sees all buyer tasks on all boards (except expenses) + their own tasks
            if board_key != "EXPENSES":
                buyer_user_ids = []
                async for user_dict in db.users.find({"roles.role": "buyer"}):
                    buyer_user_ids.append(user_dict["id"])
                
                query["$or"] = [
                    {"creator_id": current_user.id},  # Own tasks
                    {"assignee_id": current_user.id}, # Assigned to them
                    {"creator_id": {"$in": buyer_user_ids}}  # All buyer tasks
                ]
            else:
                # On expenses board, LEAD sees only their own tasks
                query["$or"] = [
                    {"creator_id": current_user.id},
                    {"assignee_id": current_user.id}
                ]
        elif SystemRole.BUYER in user_roles:
            # Buyers see only their own tasks and tasks assigned to them on all boards
            query["$or"] = [
                {"creator_id": current_user.id},
                {"assignee_id": current_user.id}
            ]
        elif SystemRole.TECH in user_roles and board_key == "TECH":
            # Tech users see ALL tasks on TECH board 
            pass  # No filtering - they see everything on TECH board
        elif SystemRole.DESIGNER in user_roles and board_key == "DES":
            # Designer users see ALL tasks on DES board
            pass  # No filtering - they see everything on DES board
        else:
            # Default: see tasks where user is creator or assignee
            query["$or"] = [
                {"creator_id": current_user.id},
                {"assignee_id": current_user.id}
            ]
    
    # Apply additional filters
    if columns:
        column_ids = columns.split(",")
        query["column_id"] = {"$in": column_ids}
    
    if assignees:
        assignee_ids = assignees.split(",")
        query["assignee_id"] = {"$in": assignee_ids}
    
    if q:
        query["$and"] = query.get("$and", []) + [{
            "$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}}
            ]
        }]
    
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(1000)
    return [Task(**task) for task in tasks]

@api_router.post("/tasks", response_model=Task, status_code=201)
async def create_task(task_data: TaskCreate, current_user: User = Depends(get_current_user)):
    # Check board access
    await check_board_access(current_user, task_data.board_key)
    
    # For expenses board, automatically set column to "WAITING" if not specified
    if task_data.board_key == "EXPENSES" and not task_data.column_id:
        # Find the waiting column
        board_dict = await db.boards.find_one({"key": "EXPENSES"})
        if board_dict:
            waiting_column = await db.columns.find_one({"board_id": board_dict["id"], "key": "WAITING"})
            if waiting_column:
                task_data.column_id = waiting_column["id"]
    
    # Verify column exists if column_id is specified
    if task_data.column_id:
        column_dict = await db.columns.find_one({"id": task_data.column_id})
        if not column_dict:
            raise HTTPException(status_code=404, detail="Column not found")
    else:
        # If no column specified, find first column of the board
        board_dict = await db.boards.find_one({"key": task_data.board_key})
        if board_dict:
            first_column = await db.columns.find_one({"board_id": board_dict["id"]}, sort=[("order", 1)])
            if first_column:
                task_data.column_id = first_column["id"]
            else:
                raise HTTPException(status_code=400, detail="No columns found in board")
    
    task_dict = task_data.dict()
    task_dict["creator_id"] = current_user.id
    
    # Auto-populate department_id based on user's primary department or board's default department
    department_id = None
    
    # First, try to use user's primary department
    if current_user.primary_department_id:
        department_id = current_user.primary_department_id
    # If user has no primary department, try to get from their roles
    elif current_user.roles:
        for role_ref in current_user.roles:
            if hasattr(role_ref, 'department_id') and role_ref.department_id:
                department_id = role_ref.department_id
                break
    
    # If still no department_id, try to get board's default department
    if not department_id:
        board_dict = await db.boards.find_one({"key": task_data.board_key})
        if board_dict and board_dict.get("default_department_id"):
            department_id = board_dict["default_department_id"]
    
    # If still no department_id, use a fallback based on board type
    if not department_id:
        # Get first available department as fallback
        dept_doc = await db.departments.find_one({})
        if dept_doc:
            department_id = dept_doc["id"]
    
    # If we still don't have a department_id, raise an error
    if not department_id:
        raise HTTPException(status_code=400, detail="Unable to determine department for task. Please ensure user has a department assigned.")
    
    task_dict["department_id"] = department_id
    task = Task(**task_dict)
    await db.tasks.insert_one(task.dict())
    return task

@api_router.patch("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate, current_user: User = Depends(get_current_user)):
    # Find existing task
    task_dict = await db.tasks.find_one({"id": task_id})
    if not task_dict:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check board access
    await check_board_access(current_user, task_dict["board_key"])
    
    # Special restriction for expenses board - only C-level can move tasks
    if task_dict["board_key"] == "EXPENSES" and task_update.column_id is not None:
        if not is_c_level(current_user):
            raise HTTPException(status_code=403, detail="Only C-level executives can move tasks on the expenses board")
    
    # Check permissions for assignee changes on expenses board
    if task_update.assignee_id is not None and task_dict["board_key"] == "EXPENSES":
        # Only C-level can assign expenses
        if not is_c_level(current_user):
            raise HTTPException(status_code=403, detail="Only C-level executives can assign expenses")
        
        # Can assign to anyone (simplified for new ACL system)
        pass
    
    # Check permissions for assignee changes on other boards
    elif task_update.assignee_id is not None:
        # Only admin, board owners, and task creator can change assignee
        board_dict = await db.boards.find_one({"key": task_dict["board_key"]})
        board = Board(**board_dict)
        
        if (not is_c_level(current_user) and 
            current_user.id not in (board.owners or []) and 
            current_user.id != task_dict["creator_id"]):
            raise HTTPException(status_code=403, detail="Permission denied to change assignee")
    
    # Handle cross-team routing when moving to specific columns
    if task_update.column_id:
        new_column = await db.columns.find_one({"id": task_update.column_id})
        if new_column:
            column_key = new_column["key"]
            current_board_key = task_dict["board_key"]
            
            # Cross-team routing logic
            new_board_key = None
            target_column_key = None
            
            if column_key == "TO_TECH" and current_board_key != "TECH":
                new_board_key = "TECH"
                target_column_key = "TODO"  # Move to Tech board's Todo column
            elif column_key == "TO_DESIGNERS" and current_board_key != "DES":
                new_board_key = "DES"  
                target_column_key = "QUEUE"  # Move to Designers board's Queue column
            
            # If cross-team routing is needed
            if new_board_key and target_column_key:
                # Find target board and column
                target_board = await db.boards.find_one({"key": new_board_key})
                target_column = await db.columns.find_one({
                    "board_id": target_board["id"], 
                    "key": target_column_key
                })
                
                if target_board and target_column:
                    # Update task to move to target board and column
                    task_update_dict = {
                        "board_key": new_board_key,
                        "column_id": target_column["id"],
                        "updated_at": datetime.now(timezone.utc),
                        # Add routing metadata to track origin
                        "routed_from": {
                            "board_key": current_board_key,
                            "user_id": current_user.id,
                            "user_name": current_user.full_name,
                            "routed_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                    
                    # Add other updates if provided
                    update_data = {k: v for k, v in task_update.dict().items() if v is not None}
                    task_update_dict.update(update_data)
                    
                    await db.tasks.update_one({"id": task_id}, {"$set": task_update_dict})
                    
                    # Return updated task
                    updated_task_dict = await db.tasks.find_one({"id": task_id})
                    return Task(**updated_task_dict)
    
    # Normal task update (no cross-team routing)
    update_data = {}
    for k, v in task_update.dict().items():
        # Include all fields that are explicitly set, including None values for assignee_id
        if v is not None or k == "assignee_id":
            update_data[k] = v
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # Return updated task
    updated_task_dict = await db.tasks.find_one({"id": task_id})
    return Task(**updated_task_dict)

@api_router.get("/me/tasks", response_model=List[Task])
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    """Get all tasks assigned to the current user across accessible boards"""
    
    # Get accessible boards
    boards_query = {}
    if not is_c_level(current_user):
        user_role_strings = [role_ref.role.value if hasattr(role_ref, 'role') else role_ref 
                           for role_ref in current_user.roles]
        boards_query = {
            "$or": [
                {"allowed_roles": {"$in": user_role_strings}},
                {"members": current_user.id},
                {"owners": current_user.id}
            ]
        }
    
    accessible_boards = await db.boards.find(boards_query, {"key": 1}).to_list(1000)
    accessible_board_keys = [board["key"] for board in accessible_boards]
    
    # Get tasks assigned to user from accessible boards
    tasks = await db.tasks.find({
        "assignee_id": current_user.id,
        "board_key": {"$in": accessible_board_keys}
    }).sort("created_at", -1).to_list(1000)
    
    return [Task(**task) for task in tasks]

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()