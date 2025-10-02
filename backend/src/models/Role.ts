import mongoose, { Schema, Document, Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IRole extends Document {
  id: string;
  key: string;        // UPPERCASE уникальный ключ, напр. BUYER
  name: string;       // Название для UI, напр. Buyer
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    id: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
    },
    key: {
      type: String,
      required: true,
      uppercase: true,  // Модель сама хранит в UPPERCASE
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // Нормализуем поля для ответа
        if (!ret.id && ret._id) ret.id = String(ret._id);
        delete ret._id;
      },
    },
    toObject: { virtuals: true },
  }
);

// Индексы
RoleSchema.index({ key: 1 }, { unique: true });
RoleSchema.index({ id: 1 }, { unique: true });

// Единый экземпляр модели (важно для hot-reload)
const RoleModel: Model<IRole> =
  (mongoose.models.Role as Model<IRole>) ||
  mongoose.model<IRole>('Role', RoleSchema);

// Экспорт без конфликтов:
// - default: RoleModel
// - именованный: Role (для импорта { Role })
// - при желании можно также импортировать { RoleModel }
const Role = RoleModel;

export default RoleModel;
export { RoleModel, Role };