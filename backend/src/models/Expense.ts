import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Document } from 'mongoose';
import { EXPENSE_CATEGORY_VALUES, ExpenseCategory } from '../constants/expenseCategories';

export interface IExpenseComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface IExpense extends Document {
  _id: any;

  // базовые поля "как у тасков"
  id: string;
  boardKey: string;      // EXP и т.п.
  columnId: string;
  title: string;
  description?: string;
  priority?: 'low'|'medium'|'high';
  tags: string[];
  dueDate?: Date;
  assigneeId?: string;
  creatorId: string;

  // расходы
  amount: number;        // обяз.
  currency: 'USD';       // фикс, всегда USD
  category?: ExpenseCategory;
  walletNumber?: string | null;
  txHashUrl?: string | null;
  receiptUrl?: string | null;

  // системное
  comments: IExpenseComment[];

  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IExpenseComment>({
  id: { type: String, default: () => uuidv4() },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true, trim: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const expenseSchema = new Schema<IExpense>({
  id: { type: String, default: () => uuidv4(), required: true },
  boardKey: { type: String, required: true, uppercase: true },
  columnId: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
  tags: [{ type: String, trim: true }],
  dueDate: { type: Date },
  assigneeId: { type: String },
  creatorId: { type: String, required: true },

  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'USD', enum: ['USD'] },
  category: { type: String, enum: EXPENSE_CATEGORY_VALUES, required: false },
  walletNumber: { type: String, default: null },
  txHashUrl: { type: String, default: null },
  receiptUrl: { type: String },

  comments: { type: [CommentSchema], default: [] },
}, {
  timestamps: true,
  toJSON: {
    transform: (_doc, ret) => {
      // camelCase -> snake_case выдача
      const src: any = ret;
      const out: any = {
        id: src.id,
        board_key: src.boardKey,
        column_id: src.columnId,
        title: src.title,
        description: src.description,
        priority: src.priority,
        tags: src.tags,
        due_date: src.dueDate,
        assignee_id: src.assigneeId,
        creator_id: src.creatorId,
        amount: src.amount,
        currency: src.currency,
        category: src.category,
        wallet_number: src.walletNumber,
        tx_hash_url: src.txHashUrl,
        receipt_url: src.receiptUrl,
        comments: (src.comments || []).map((c: any) => ({
          id: c.id,
          author_id: c.authorId,
          author_name: c.authorName,
          text: c.text,
          created_at: c.createdAt,
        })),
        created_at: src.createdAt,
        updated_at: src.updatedAt,
      };
      delete out._id;
      delete out.__v;
      return out;
    },
  },
});

// индексы
expenseSchema.index({ id: 1 }, { unique: true });
expenseSchema.index({ boardKey: 1, columnId: 1, createdAt: -1 });
expenseSchema.index({ assigneeId: 1, createdAt: -1 });
expenseSchema.index({ category: 1, createdAt: -1 });

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);