export const ROLE_CLASS = {
  admin:    'bg-violet-600 text-white',
  buyer:    'bg-emerald-600 text-white',
  designer: 'bg-pink-600 text-white',
  tech:     'bg-sky-600 text-white',
};

export const STATUS_CLASS = {
  active:   'bg-green-600 text-white',
  inactive: 'bg-zinc-600 text-white',
};

export function chip(base = '') {
  return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${base}`;
}