import mongoose, { Schema } from 'mongoose';
import { IColumn } from '../types';
import { v4 as uuidv4 } from 'uuid';

const columnSchema = new Schema<IColumn>(
  {
    id: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true
    },
    boardId: {
      type: String,
      required: true,
      index: true
    },
    key: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    order: {
      type: Number,
      required: true,
      min: 1
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

// Compound indexes
columnSchema.index({ boardId: 1, order: 1 });
columnSchema.index({ boardId: 1, key: 1 }, { unique: true });
columnSchema.index({ id: 1 });

export const Column = mongoose.model<IColumn>('Column', columnSchema);