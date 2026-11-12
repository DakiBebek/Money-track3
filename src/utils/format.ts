export let CURRENT_CURRENCY = 'IDR';

export const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; decimals: number }> = {
  IDR: { symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  USD: { symbol: '$', locale: 'en-US', decimals: 2 },
  EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
  SGD: { symbol: 'S$', locale: 'en-SG', decimals: 2 },
  JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
};

export function setCurrency(cur: string): void {
  if (CURRENCY_CONFIG[cur]) {
    CURRENT_CURRENCY = cur;
    try {
      localStorage.setItem('duitku_cur', cur);
    } catch {}
  }
}

try {
  const saved = localStorage.getItem('duitku_cur');
  if (saved && CURRENCY_CONFIG[saved]) CURRENT_CURRENCY = saved;
} catch {}

export let HIDE_NUMS = false;
try {
  HIDE_NUMS = localStorage.getItem('hide_nums') === '1';
} catch {}

export function togglePrivacy(): boolean {
  HIDE_NUMS = !HIDE_NUMS;
  try {
    localStorage.setItem('hide_nums', HIDE_NUMS ? '1' : '0');
  } catch {}
  return HIDE_NUMS;
}

export function rp(n: number | string | null | undefined): string {
  if (HIDE_NUMS) return '••••••';
  const val = Number(n) || 0;
  const cfg = CURRENCY_CONFIG[CURRENT_CURRENCY] || CURRENCY_CONFIG.IDR;
  return `${cfg.symbol} ${val.toLocaleString(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  })}`;
}

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(ymStr: string, offset: number): string {
  const [y, m] = ymStr.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return ym(d);
}

export function esc(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function toCurVal(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '';
  return Number(n).toLocaleString('id-ID');
}
