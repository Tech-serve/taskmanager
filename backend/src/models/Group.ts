import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IGroup extends Document {
  id: string;
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  memberUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>(
  {
    id: { type: String, default: () => uuidv4(), required: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    memberUserIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

GroupSchema.index({ id: 1 }, { unique: true });
GroupSchema.index({ key: 1 }, { unique: true });
GroupSchema.index({ isActive: 1 });

export const Group = mongoose.model<IGroup>('Group', GroupSchema);