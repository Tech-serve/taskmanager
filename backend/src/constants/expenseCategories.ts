// Категории расходов (MAIN → SUB[])
export const EXPENSE_MAIN = ['sweep', 'igaming', 'hr', 'office', 'design'] as const;
export type ExpenseMain = typeof EXPENSE_MAIN[number];

export const EXPENSE_SUB: Record<ExpenseMain, string[]> = {
  sweep:  ['accounts','proxy_domains','services','fakes','other'],
  igaming:['fb_accounts','uac_accounts','creatives','google_play','services','proxy_domains','other'],
  hr:     ['vacancies','candidates','services','polygraph','books','team_building','other'],
  office: ['household','food_water','services','hookah','furniture','repair_security','charity','other'],
  design: ['services'],
};

// Плоский список enum-значений для валидации/модели
export const EXPENSE_CATEGORY_VALUES = [
  // sweep
  'sweep_accounts','sweep_proxy_domains','sweep_services','sweep_fakes','sweep_other',
  // igaming
  'igaming_fb_accounts','igaming_uac_accounts','igaming_creatives','igaming_google_play',
  'igaming_services','igaming_proxy_domains','igaming_other',
  // hr
  'hr_vacancies','hr_candidates','hr_services','hr_polygraph','hr_books','hr_team_building','hr_other',
  // office
  'office_household','office_food_water','office_services','office_hookah',
  'office_furniture','office_repair_security','office_charity','office_other',
  // designers
  'design_services',
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORY_VALUES[number];