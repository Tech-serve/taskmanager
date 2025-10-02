import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IDepartment extends Document {
  id: string;
  key: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    id: { type: String, default: () => uuidv4(), required: true },
    key: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Индексы — единый источник правды (без unique/index в полях)
DepartmentSchema.index({ id: 1 }, { unique: true });
DepartmentSchema.index({ key: 1 }, { unique: true });
DepartmentSchema.index({ isActive: 1 });

export const Department = mongoose.model<IDepartment>('Department', DepartmentSchema);