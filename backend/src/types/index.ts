import { Request } from 'express';
import { Document, Types } from 'mongoose';

// Enums
export enum Role {
  ADMIN = 'admin',
  BUYER = 'buyer',
  DESIGNER = 'designer',
  TECH = 'tech',
  TEAM_LEAD = 'team_lead',
}

export enum Department {
  SWIP = 'SWIP',
  GAMBLING = 'GAMBLING',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum BoardType {
  TASKS = 'tasks',
  EXPENSES = 'expenses'
}

export enum Template {
  KANBAN_BASIC = 'kanban-basic',
  KANBAN_TJ_TECH = 'kanban-tj-tech',
  EMPTY = 'empty'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

// Interfaces
export interface IUser extends Document {
  _id: Types.ObjectId;
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  /** Храним строки (snake_case), чтобы поддерживать “живые” роли */
  roles: string[];
  department?: Department;
  groups: string[];
  status: UserStatus;
  lastLogin?: Date;
  invitationToken?: string;
  invitationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBoard extends Document {
  _id: Types.ObjectId;
  id: string;
  name: string;
  key: string;
  type: BoardType;
  template: Template;
  isArchived: boolean;
  settings: {
    assigneeEnabled: boolean;
    dueDatesEnabled: boolean;
    priorityEnabled: boolean;
    tagsEnabled: boolean;
    commentsEnabled: boolean;
    timeTrackingEnabled: boolean;
  };
  /** Список строковых ключей ролей (snake_case) */
  allowedRoles: string[];
  allowedGroupIds: string[];
  members: string[];
  owners: string[];
  createdAt: Date;
  updatedAt: Date;
  department?: Department;
}

export interface IColumn extends Document {
  _id: Types.ObjectId;
  id: string;
  boardId: string;
  key: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface ITask extends Document {
  _id: Types.ObjectId;
  id: string;
  boardKey: string;
  columnId: string;
  title: string;
  description?: string;
  priority?: Priority;
  tags: string[];
  dueDate?: Date;
  assigneeId?: string;
  department?: Department;
  creatorId: string;
  amount?: number;
  category?: string;
  receiptUrl?: string;
  routedFrom?: {
    boardKey: string;
    userId: string;
    userName: string;
    routedAt: Date;
  };
  comments?: ITaskComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: IUser;
}

// DTOs
export interface CreateUserDTO {
  email: string;
  password?: string;
  fullName: string;
  roles: string[];
  status?: UserStatus;
}

export interface UpdateUserDTO {
  fullName?: string;
  roles?: string[];
  status?: UserStatus;
  email?: string;
}

export interface CreateBoardDTO {
  name: string;
  key: string;
  type?: BoardType;
  template?: Template;
  allowedRoles?: string[];
  allowedGroupIds?: string[];
  members?: string[];
  owners?: string[];
}

export interface UpdateBoardDTO {
  name?: string;
  type?: BoardType;
  template?: Template;
  isArchived?: boolean;
  settings?: Partial<IBoard['settings']>;
  allowedRoles?: string[];
  allowedGroupIds?: string[];
  members?: string[];
  owners?: string[];
}

export interface CreateColumnDTO {
  key: string;
  name: string;
  order: number;
}

export interface UpdateColumnDTO {
  key?: string;
  name?: string;
  order?: number;
}

export interface CreateTaskDTO {
  boardKey: string;
  columnId: string;
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  dueDate?: Date;
  assigneeId?: string;
  amount?: number;
  category?: string;
  receiptUrl?: string;
}

export interface UpdateTaskDTO {
  columnId?: string;
  title?: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  dueDate?: Date;
  assigneeId?: string;
  amount?: number;
  category?: string;
  receiptUrl?: string;
}