import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IRoleDoc {
  _id: mongoose.Types.ObjectId;
  id: string;
  key: string;          // UPPERCASE
  name: string;
  description?: string | null;
  isActive: boolean;
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRoleDoc>(
  {
    id: { type: String, default: () => uuidv4(), unique: true, required: true },
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    builtIn: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

roleSchema.index({ id: 1 }, { unique: true });
roleSchema.index({ key: 1 }, { unique: true });

export const RoleModel = mongoose.model<IRoleDoc>('Role', roleSchema);