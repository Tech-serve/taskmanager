// backend/src/models/User.ts
import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IUser, UserStatus } from '../types';

const UserSchema = new Schema<IUser>(
  {
    id: { type: String, required: true, default: () => uuidv4() }, // без unique здесь — см. индексы ниже
    email: { type: String, required: true, lowercase: true, trim: true }, // без unique здесь — см. индексы ниже
    passwordHash: { type: String, required: false },
    fullName: { type: String, required: true, trim: true },

    // Роли храним как строки (ключи), нормализуем к lower_snake
    roles: {
      type: [String],
      required: true,
      default: [],
      set: (arr: unknown[]) =>
        Array.from(
          new Set(
            (Array.isArray(arr) ? arr : [])
              .map(v => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_'))
              .filter(Boolean)
          )
        ),
    },

    // Группы (если используешь)
    groups: {
      type: [String],
      default: [],
      set: (arr: unknown[]) =>
        Array.from(
          new Set(
            (Array.isArray(arr) ? arr : [])
              .map(v => String(v ?? '').trim())
              .filter(Boolean)
          )
        ),
    },

    /**
     * Департаменты — массив UPPERCASE ключей Department.key
     * Всегда минимум один. По умолчанию: ['GENERAL'].
     */
    departments: {
      type: [String],
      required: true,
      default: ['GENERAL'],
      set: (arr: unknown[]) =>
        Array.from(
          new Set(
            (Array.isArray(arr) ? arr : [])
              .map(v => String(v ?? '').trim().toUpperCase())
              .filter(Boolean)
          )
        ),
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one department is required',
      },
    },

    status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE },

    lastLogin: { type: Date },
    invitationToken: { type: String },
    invitationExpires: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as any)._id;
        delete (ret as any).__v;
        delete (ret as any).passwordHash;
        return ret;
      },
    },
  }
);

// Приводим поля перед сохранением (на случай прямых присвоений без сеттера)
UserSchema.pre('save', function (next) {
  // roles → lower_snake
  if (Array.isArray(this.roles)) {
    const set = new Set(
      this.roles
        .map((v: any) => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_'))
        .filter(Boolean)
    );
    this.roles = Array.from(set);
  } else {
    this.roles = [];
  }

  // groups → trimmed unique
  if (Array.isArray(this.groups)) {
    const set = new Set(this.groups.map((v: any) => String(v ?? '').trim()).filter(Boolean));
    this.groups = Array.from(set);
  } else {
    this.groups = [];
  }

  // departments → UPPERCASE, минимум один
  if (Array.isArray(this.departments) && this.departments.length > 0) {
    const set = new Set(this.departments.map((v: any) => String(v ?? '').trim().toUpperCase()).filter(Boolean));
    this.departments = Array.from(set);
  } else {
    this.departments = ['GENERAL'];
  }

  next();
});

/**
 * Индексы.
 * ВАЖНО: чтобы не было предупреждений "Duplicate schema index",
 * не ставим unique прямо в определении полей; задаём через schema.index().
 */
UserSchema.index({ id: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ roles: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ departments: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);