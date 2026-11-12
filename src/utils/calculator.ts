import { rp } from './format';

export function evalMathExpr(expr: string | null | undefined): number | null {
  if (!expr) return null;
  const s = String(expr).trim();
  if (!/[+\-*/]/.test(s)) return null;
  const sanitized = s.replace(/\./g, '').replace(/,/g, '.');
  if (!/^[\d\s.+\-*/]+$/.test(sanitized)) return null;
  try {
    const val = Function(`'use strict'; return (${sanitized})`)();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0) {
      return Math.round(val);
    }
  } catch {}
  return null;
}

export function attachCurrencyCalculator(inputEl: HTMLInputElement): void {
  if (!inputEl) return;

  let badge = inputEl.nextElementSibling as HTMLElement | null;
  if (!badge || !badge.classList.contains('math-calc-badge')) {
    badge = document.createElement('div');
    badge.className = 'math-calc-badge';
    badge.style.cssText =
      'font-size:11.5px;color:var(--main);font-weight:600;margin-top:-6px;margin-bottom:8px;display:none;background:var(--card-subtle);padding:4px 8px;border-radius:6px';
    inputEl.parentNode?.insertBefore(badge, inputEl.nextSibling);
  }

  inputEl.addEventListener('input', function () {
    const raw = this.value;
    const calcResult = evalMathExpr(raw);
    if (calcResult !== null && badge) {
      badge.style.display = 'block';
      badge.innerHTML = `🧮 Hasil hitung: <b>${rp(calcResult)}</b> (Tekan Enter untuk menerapkan)`;
      return;
    } else if (badge) {
      badge.style.display = 'none';
    }

    const val = this.value.replace(/[^0-9]/g, '');
    if (val === '') {
      this.value = '';
      return;
    }
    const num = parseInt(val, 10);
    this.value = isNaN(num) ? '' : num.toLocaleString('id-ID');
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const calcResult = evalMathExpr(this.value);
      if (calcResult !== null) {
        e.preventDefault();
        this.value = calcResult.toLocaleString('id-ID');
        if (badge) badge.style.display = 'none';
      }
    }
  });
}
