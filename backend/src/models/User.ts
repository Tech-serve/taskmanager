import mongoose, { Schema } from 'mongoose';
import { IUser, Role, UserStatus, Department } from '../types';
import { v4 as uuidv4 } from 'uuid';

const userSchema = new Schema<IUser>(
  {
    id: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: false 
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    roles: [{
      type: String,
      required: true
    }],
    groups: [{
      type: String,
      default: []
    }],
    department: {
      type: String,
      enum: Object.values(Department),
      required: false
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE
    },
    lastLogin: {
      type: Date
    },
    invitationToken: {
      type: String
    },
    invitationExpires: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete (ret as any).passwordHash;
        return ret;
      }
    }
  }
);

userSchema.index({ email: 1 });
userSchema.index({ id: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ status: 1 });
userSchema.index({ department: 1 });

export const User = mongoose.model<IUser>('User', userSchema);