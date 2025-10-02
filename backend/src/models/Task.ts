import mongoose, { Schema } from 'mongoose';
import { ITask, Priority, Department } from '../types';
import { v4 as uuidv4 } from 'uuid';

const taskSchema = new Schema<ITask>(
  {
    id: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true
    },
    boardKey: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    columnId: {
      type: String,
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.MEDIUM
    },
    tags: [{
      type: String,
      trim: true
    }],
    dueDate: {
      type: Date
    },
    assigneeId: {
      type: String,
      index: true
    },
    creatorId: {
      type: String,
      required: true,
      index: true
    },
    department: {
      type: String,
      enum: Object.values(Department),
      required: false
    },
    amount: {
      type: Number,
      min: 0
    },
    category: {
      type: String,
      enum: [
        // Sweep Stakes
        'sweep_accounts', 'sweep_proxy_domains', 'sweep_services', 'sweep_fakes', 'sweep_other',
        // IGaming
        'igaming_fb_accounts', 'igaming_uac_accounts', 'igaming_creatives', 'igaming_google_play', 
        'igaming_services', 'igaming_proxy_domains', 'igaming_other',
        // HR Department
        'hr_vacancies', 'hr_candidates', 'hr_services', 'hr_polygraph', 'hr_books', 'hr_team_building', 'hr_other',
        // Office
        'office_household', 'office_food_water', 'office_services', 'office_hookah', 
        'office_furniture', 'office_repair_security', 'office_charity', 'office_other'
      ]
    },
    receiptUrl: {
      type: String // URL to uploaded receipt/check
    },
    routedFrom: {
      boardKey: String,
      userId: String,
      userName: String,
      routedAt: Date
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

taskSchema.index({ boardKey: 1, creatorId: 1 });
taskSchema.index({ assigneeId: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ boardKey: 1, department: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);