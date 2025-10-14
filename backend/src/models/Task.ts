// src/models/Task.ts
import mongoose, { Schema } from 'mongoose';
import { ITask, Priority, Department } from '../types';
import { v4 as uuidv4 } from 'uuid';

const CommentSchema = new Schema(
  {
    id: { type: String, default: () => uuidv4() },
    authorId: { type: String, required: true },             // ← убран index: true
    authorName: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const taskSchema = new Schema<ITask>(
  {
    id: {
      type: String,
      default: () => uuidv4(),
      required: true,                                       // ← убраны unique/index из поля
    },
    boardKey: {
      type: String,
      required: true,
      uppercase: true,                                       // нормализация ключа борда
    },
    columnId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.MEDIUM,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    dueDate: {
      type: Date,
    },
    assigneeId: {
      type: String,
    },
    creatorId: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      enum: Object.values(Department),
      required: false,
    },

    // — поля для расходов —
    amount: {
      type: Number,
      min: 0,
    },
    category: {
      type: String,
      enum: [
        // Sweep Stakes
        'sweep_accounts',
        'sweep_proxy_domains',
        'sweep_services',
        'sweep_fakes',
        'sweep_other',
        // IGaming
        'igaming_fb_accounts',
        'igaming_uac_accounts',
        'igaming_creatives',
        'igaming_google_play',
        'igaming_services',
        'igaming_proxy_domains',
        'igaming_other',
        // HR Department
        'hr_vacancies',
        'hr_candidates',
        'hr_services',
        'hr_polygraph',
        'hr_books',
        'hr_team_building',
        'hr_other',
        // Office
        'office_household',
        'office_food_water',
        'office_services',
        'office_hookah',
        'office_furniture',
        'office_repair_security',
        'office_charity',
        'office_other',
      ],
    },
    receiptUrl: {
      type: String, // URL чека
    },

    // — кросс-командный роутинг —
    routedFrom: {
      boardKey: String,
      userId: String,
      userName: String,
      routedAt: Date,
    },

    // — комментарии —
    comments: {
      type: [CommentSchema],
      default: [],
    },
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

/** Индексы — объявляем здесь, без index/unique в полях */
taskSchema.index({ id: 1 }, { unique: true });                 // уникальный ID задачи
taskSchema.index({ boardKey: 1, creatorId: 1 });                // выборки “мои задачи по борду”
taskSchema.index({ assigneeId: 1 });                            // задачи по исполнителю
taskSchema.index({ createdAt: -1 });                            // сортировка/лента
taskSchema.index({ dueDate: 1 });                               // дедлайны
taskSchema.index({ boardKey: 1, department: 1 });               // борд + департамент

export const Task = mongoose.model<ITask>('Task', taskSchema);