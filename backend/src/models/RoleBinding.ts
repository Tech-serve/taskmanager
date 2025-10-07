import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type CanonicalRole = 'admin'|'buyer'|'designer'|'tech'|'head_elite';

export interface IRoleBinding extends Document {
  id: string;
  userId: string;                           // User.id
  role: CanonicalRole;                      // canonical в lower_case
  scope?: { type: 'global'|'board'|'department'; value?: string|null } | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleBindingSchema = new Schema<IRoleBinding>({
  id:       { type: String, default: () => uuidv4(), unique: true, required: true },
  userId:   { type: String, required: true, index: true },
  role:     { type: String, required: true, lowercase: true, trim: true, index: true },
  scope:    { type: Object, default: { type: 'global', value: null } },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

RoleBindingSchema.index({ userId: 1, role: 1, 'scope.type': 1, 'scope.value': 1 }, { unique: true });

export const RoleBinding = mongoose.model<IRoleBinding>('RoleBinding', RoleBindingSchema);