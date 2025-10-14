// backend/src/models/Board.ts
import mongoose, { Schema } from 'mongoose';
import { IBoard, BoardType, Template } from '../types';
import { v4 as uuidv4 } from 'uuid';

const boardSchema = new Schema<IBoard>(
  {
    id: { type: String, default: () => uuidv4(), unique: true, required: true },
    name: { type: String, required: true, trim: true },
    key:  { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: Object.values(BoardType), default: BoardType.TASKS },
    template: { type: String, enum: Object.values(Template), default: Template.KANBAN_BASIC },
    isArchived: { type: Boolean, default: false },
    settings: {
      assigneeEnabled: { type: Boolean, default: true },
      dueDatesEnabled: { type: Boolean, default: true },
      priorityEnabled: { type: Boolean, default: true },
      tagsEnabled:      { type: Boolean, default: true },
      commentsEnabled:  { type: Boolean, default: false },
      timeTrackingEnabled: { type: Boolean, default: false }
    },
    allowedRoles:     [{ type: String }],
    allowedGroupIds:  [{ type: String }],
    members:          [{ type: String }],
    owners:           [{ type: String }],

    // кого видно по департаментам (пусто = видно всем)
    visibleDepartments: {
      type: [String],
      default: [],
      set: (arr: unknown[]) =>
        Array.from(new Set((Array.isArray(arr) ? arr : [])
          .map(v => String(v ?? '').trim().toUpperCase())
          .filter(Boolean))),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

// оставляем только «недублирующие» индексы
boardSchema.index({ allowedRoles: 1 });
boardSchema.index({ owners: 1 });
boardSchema.index({ members: 1 });
boardSchema.index({ visibleDepartments: 1 });

export const Board = mongoose.model<IBoard>('Board', boardSchema);