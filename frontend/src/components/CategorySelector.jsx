import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';

/**
 * Категории расходов
 * - сохраняем объект с display-именами подкатегорий (subcategories)
 * - для удобства даём и список ключей (sub)
 */
export const EXPENSE_CATEGORIES = {
  sweep:  { name: 'Sweep Stakes', subcategories: {
    accounts: 'Аккаунты',
    proxy_domains: 'Прокси/домены/трекер',
    services: 'Сервисы',
    fakes: 'Фейки',
    other: 'Прочее',
  }},
  igaming:{ name: 'IGaming', subcategories: {
    fb_accounts: 'Аккаунты FB',
    uac_accounts: 'Аккаунты UAC',
    creatives: 'Креативы',
    google_play: 'Google Play Console',
    services: 'Сервисы',
    proxy_domains: 'Прокси/домены/трекер',
    other: 'Прочее',
  }},
  hr:     { name: 'Отдел HR', subcategories: {
    vacancies: 'Вакансии/реклама',
    candidates: 'Покупка кандидатов',
    services: 'Сервисы',
    polygraph: 'Полиграф',
    books: 'Книги/учебные материалы',
    team_building: 'Тимбилдинг/корпоратив',
    other: 'Прочее',
  }},
  office: { name: 'Офис', subcategories: {
    household: 'Хоз.товары',
    food_water: 'Продукты/вода',
    services: 'Сервисы',
    hookah: 'Кальян',
    furniture: 'Мебель/электроника',
    repair_security: 'Ремонт/безопасность',
    charity: 'Благотворительность',
    other: 'Прочее',
  }},
  design: { name: 'Отдел дизайнеров', subcategories: {
    services: 'Сервисы',
  }},
};

export const MAIN_KEYS = Object.keys(EXPENSE_CATEGORIES);
export const getSubcategories = (main) =>
  Object.keys(EXPENSE_CATEGORIES[main]?.subcategories || {});

export const getMainDisplayName = (main) =>
  EXPENSE_CATEGORIES[main]?.name || main;

export const getSubDisplayName = (main, sub) =>
  EXPENSE_CATEGORIES[main]?.subcategories?.[sub] || sub;

// MAIN.SUB → snake ("main_sub")
export const buildCategoryValue = (main, sub) => {
  if (!main || !sub) return null;
  return `${String(main).trim().toLowerCase()}_${String(sub).trim().toLowerCase()}`;
};

// snake / MAIN.SUB -> {main, sub}
export const parseCategoryValue = (value) => {
  if (!value || typeof value !== 'string') return { main: null, sub: null };
  const v = value.trim().toLowerCase();
  if (v.includes('_')) {
    const [m, ...rest] = v.split('_');
    return { main: m, sub: rest.join('_') || null };
  }
  if (v.includes('.')) {
    const [m, s] = v.split('.');
    return { main: m || null, sub: s || null };
  }
  return { main: v || null, sub: null };
};

export const getCategoryDisplayName = (snakeOrNull) => {
  if (!snakeOrNull) return '';
  const { main, sub } = parseCategoryValue(snakeOrNull);
  if (!main) return '';
  const mainName = getMainDisplayName(main);
  if (!sub) return mainName;
  return `${mainName} / ${getSubDisplayName(main, sub)}`;
};

/**
 * Компонент модалки выбора категории (два селектора: MAIN + SUB)
 * Именованный экспорт: { CategorySelector }
 */
export const CategorySelector = ({
  open,
  onClose,
  onSelect,              // (categoryId, prettyName)
  defaultMain = null,
  defaultSub = null,
}) => {
  const [main, setMain] = useState(defaultMain);
  const [sub, setSub]   = useState(defaultSub);

  const subList = useMemo(() => (main ? getSubcategories(main) : []), [main]);
  const valueSnake = useMemo(() => buildCategoryValue(main, sub), [main, sub]);
  const valuePretty = useMemo(() => getCategoryDisplayName(valueSnake), [valueSnake]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white dark:bg-gray-700 border dark:border-gray-500">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Select category</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-700 dark:text-white">Main</Label>
            <Select
              value={main ?? ''}
              onValueChange={(v) => { setMain(v || null); setSub(null); }}
            >
              <SelectTrigger className="mt-1 dark:bg-gray-500 dark:border-gray-400 dark:text-white">
                <SelectValue placeholder="Choose main..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-600 dark:border-gray-500">
                {MAIN_KEYS.map((m) => (
                  <SelectItem key={m} value={m} className="dark:text-white dark:hover:bg-gray-500">
                    {getMainDisplayName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-700 dark:text-white">Sub</Label>
            <Select
              value={sub ?? ''}
              onValueChange={(v) => setSub(v || null)}
              disabled={!main}
            >
              <SelectTrigger className="mt-1 dark:bg-gray-500 dark:border-gray-400 dark:text-white disabled:opacity-50">
                <SelectValue placeholder={main ? 'Choose sub...' : 'Select main first'} />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-600 dark:border-gray-500">
                {subList.map((s) => (
                  <SelectItem key={s} value={s} className="dark:text-white dark:hover:bg-gray-500">
                    {getSubDisplayName(main, s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {valueSnake ? valuePretty : '—'}
          </div>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}
              className="dark:bg-gray-500 dark:border-gray-400 dark:text-white dark:hover:bg-gray-400">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (valueSnake) onSelect?.(valueSnake, valuePretty);
                onClose?.();
              }}
              disabled={!valueSnake}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Select
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};