// ==============================================================================
// DUITKU - SMART PERSONAL FINANCE (TYPESCRIPT EDITION)
// Full TypeScript Migration with Vite, Supabase, and Offline Cache
// ==============================================================================

import './styles/main.css';
import { sb, SUPABASE_URL } from './lib/supabase';
import type { 
  AccountRow, 
  TransactionRow, 
  InstallmentRow, 
  SavingsRow, 
  SavingMoveRow, 
  BudgetRow, 
  RecurringRow, 
  ProfileRow 
} from './types/database';
import type { 
  AppState, 
  TxFilter, 
  EditingState, 
  UserSession, 
  ThemeConfig 
} from './types/state';
import { 
  rp, 
  today, 
  ym, 
  shiftMonth, 
  esc, 
  toCurVal, 
  togglePrivacy, 
  CURRENT_CURRENCY, 
  setCurrency,
  HIDE_NUMS
} from './utils/format';
import { attachCurrencyCalculator, evalMathExpr } from './utils/calculator';
import { compressImageToAvatar } from './utils/image';
import { scanReceiptWithGemini, GEMINI_API_KEY, setGeminiApiKey } from './utils/ocr';
import { saveToLocalCache, loadFromLocalCache, CACHE_KEY } from './lib/storage';
import { initSplashScreen, safeDismissSplash } from './components/splash';

// Initialize Splash Screen safe timer
initSplashScreen();


// ====== DATA SUPABASE ======
const SUPABASE_URL = 'https://pdwehqekftzjcbtgupdn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkd2VocWVrZnR6amNidGd1cGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNzA2MzQsImV4cCI6MjEwNTc0NjYzNH0.nQKP0xtpKa3WKMomfzLnJCNi-QnhWW1UeMamFFYfjQs';

// ====== IKON SVG REFINED ======
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
  inst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>',
  sav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path></svg>',
  accs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="16" width="20" height="4" rx="1"></rect><path d="M12 4 4 10h16Z"></path><path d="M6 10v6"></path><path d="M10 10v6"></path><path d="M14 10v6"></path><path d="M18 10v6"></path></svg>'
};

// ====== STALE-WHILE-REVALIDATE OFFLINE CACHE ======
const CACHE_KEY = 'duitku_cache_v2';

function loadFromLocalCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (cached && Array.isArray(cached.acc) && cached.acc.length) {
      S.acc = cached.acc || [];
      S.tx = cached.tx || [];
      S.inst = cached.inst || [];
      S.sav = cached.sav || [];
      S.mv = cached.mv || [];
      S.bud = cached.bud || [];
      S.rec = cached.rec || [];
      computeBalances();
      return true;
    }
  } catch(e) {
    console.warn('Cache load error:', e);
  }
  return false;
}

function saveToLocalCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      acc: S.acc,
      tx: S.tx,
      inst: S.inst,
      sav: S.sav,
      mv: S.mv,
      bud: S.bud,
      rec: S.rec,
      savedAt: Date.now()
    }));
  } catch(e) {
    console.warn('Cache save error:', e);
  }
}

let sb;
function initSupabase() {
  if (typeof supabase !== 'undefined') {
    try {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      sb.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') { CURRENT_USER = session.user; showRecovery = true; authView(); }
      });
      boot();
    } catch(err) {
      console.error(err);
      authView();
    }
  } else {
    setTimeout(initSupabase, 80);
  }
}


// ====== SPLASH SCREEN CONTROLLER ======
let splashAlreadyShown = false;
try {
  splashAlreadyShown = !!sessionStorage.getItem('duitku_splash_shown');
} catch(e) {}

const splashStartTime = Date.now();
// Hanya terapkan delay animasi saat aplikasi pertama kali dibuka (bukan saat refresh)
const MIN_SPLASH_TIME = splashAlreadyShown ? 0 : 1300;
let splashDismissed = false;

// Tandai sesi bahwa splash sudah pernah ditampilkan
try {
  sessionStorage.setItem('duitku_splash_shown', '1');
} catch(e) {}

// Jika sudah pernah tampil di sesi ini (misal saat refresh halaman), singkirkan splash seketika
if (splashAlreadyShown) {
  const earlySplash = document.getElementById('splash-screen');
  if (earlySplash) earlySplash.remove();
}

function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  
  if (splashAlreadyShown) {
    splash.remove();
    return;
  }
  
  const bar = splash.querySelector('.splash-loader-fill');
  if (bar) {
    bar.style.animation = 'none';
    bar.style.width = '100%';
    bar.style.transition = 'width 0.25s ease-out';
  }
  
  setTimeout(() => {
    splash.classList.add('splash-exit');
    setTimeout(() => {
      try { splash.remove(); } catch(e) {}
    }, 450);
  }, 180);
}

function safeDismissSplash() {
  if (splashAlreadyShown) {
    dismissSplash();
    return;
  }
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, MIN_SPLASH_TIME - elapsed);
  setTimeout(dismissSplash, remaining);
}

// Fallback keamanan jika koneksi sangat lambat
if (!splashAlreadyShown) {
  setTimeout(dismissSplash, 3500);
}

// Fungsi untuk menguji ulang animasi splash kapan saja dari menu pengaturan
function replaySplashScreen() {
  try { sessionStorage.removeItem('duitku_splash_shown'); } catch(e) {}
  location.reload();
}

// ====== TOAST ======
function toast(msg, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.backgroundColor = type === 'error' ? 'var(--out)' : type === 'success' ? 'var(--in)' : 'var(--ink)';
  const icon = type === 'error' ? '⚠️ ' : type === 'success' ? '✓ ' : 'ℹ️ ';
  t.innerText = icon + msg;
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translate(-50%, -15px)';
    t.style.transition = 'all 0.2s';
    setTimeout(() => t.remove(), 200);
  }, 2800);
}
window.alert = function(msg) {
  toast(msg, msg.toLowerCase().includes('gagal') || msg.toLowerCase().includes('belum') || msg.toLowerCase().includes('isi') ? 'error' : 'info');
};

// ====== DYNAMIC SCRIPT ======
async function loadScript(url, globalVar) {
  if (window[globalVar]) return;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

const $ = id => document.getElementById(id);
const v = id => $(id) ? $(id).value : '';
const CURS = ['IDR', 'USD', 'EUR', 'SGD', 'MYR', 'JPY', 'AUD', 'GBP', 'SAR', 'TWD'];
let CUR = 'IDR', RATES = { IDR: 1 }, RATE_T = null;

// ====== GOOGLE GEMINI AI OCR INTEGRATION ======
let GEMINI_API_KEY = '';
try { GEMINI_API_KEY = localStorage.getItem('gemini_api_key') || ''; } catch(e) {}
function saveGeminiKey(key) {
  GEMINI_API_KEY = (key || '').trim();
  try { localStorage.setItem('gemini_api_key', GEMINI_API_KEY); } catch(e) {}
  toast(GEMINI_API_KEY ? 'API Key AI Gemini berhasil disimpan!' : 'API Key Gemini dihapus.', 'success');
  render();
}
function promptGeminiKey() {
  const current = GEMINI_API_KEY || '';
  const key = prompt('Masukkan Google Gemini API Key Anda (Dapatkan GRATIS di https://aistudio.google.com):', current);
  if (key !== null) {
    saveGeminiKey(key);
  }
}
try { CUR = localStorage.getItem('cur') || 'IDR'; const c = JSON.parse(localStorage.getItem('rates') || 'null'); if (c) { RATES = c.rates; RATE_T = c.t; } } catch (e) {}

// ====== PRIVACY MODE (HIDE SENSITIVE BALANCES) ======
let HIDE_NUMS = false;
try { HIDE_NUMS = localStorage.getItem('hide_nums') === '1'; } catch(e) {}
function togglePrivacy() {
  HIDE_NUMS = !HIDE_NUMS;
  try { localStorage.setItem('hide_nums', HIDE_NUMS ? '1' : '0'); } catch(e) {}
  render();
}

const rp = n => {
  if (HIDE_NUMS) return '••••••';
  const cur = RATES[CUR] ? CUR : 'IDR', d = ['IDR', 'JPY'].includes(cur) ? 0 : 2;
  return new Intl.NumberFormat(cur === 'IDR' ? 'id-ID' : 'en-US', { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n * RATES[cur]);
};

async function fetchRates() {
  if (RATE_T && Date.now() - RATE_T < 12 * 3600 * 1000) return; // cache 12 jam
  try {
    const j = await (await fetch('https://open.er-api.com/v6/latest/IDR')).json();
    if (j.result !== 'success') throw 0;
    RATES = j.rates; RATE_T = Date.now();
    try { localStorage.setItem('rates', JSON.stringify({ rates: RATES, t: RATE_T })); } catch (e) {}
  } catch (e) {}
  if (document.querySelector('nav')) render();
}

function parseAmt(raw) {
  let s = String(raw || '').trim();
  if (CUR === 'IDR' || CUR === 'JPY') s = s.replace(/\./g, ''); else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function inIDR(id) {
  const x = parseAmt(v(id));
  if (!x) return 0;
  if (CUR === 'IDR') return x;
  const r = RATES[CUR];
  if (!r) { alert('Kurs ' + CUR + ' belum tersedia. Pilih IDR dulu.'); return null; }
  return Math.round(x / r);
}

function setCur(c) { CUR = c; try { localStorage.setItem('cur', c); } catch (e) {} render(); }
function toCurVal(idr) {
  if (CUR === 'IDR' || !RATES[CUR]) return Math.round(idr);
  const x = idr * RATES[CUR];
  return ['IDR', 'JPY'].includes(CUR) ? Math.round(x) : +x.toFixed(2);
}

function curBar() {
  const r = RATES[CUR], t = RATE_T ? new Date(RATE_T).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const info = CUR === 'IDR' ? 'Mata uang: Rupiah (IDR)' : r ? `1 ${CUR} = Rp${(1 / r).toLocaleString('id-ID', { maximumFractionDigits: 2 })} · kurs ${t}` : 'Kurs belum tersedia';
  return `<div class="cur-bar">
    <div style="display:flex;align-items:center;gap:8px">
      <span class="mute">${info}</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px">
      <button class="ghost" style="padding:4px 8px;font-size:12px" onclick="togglePrivacy()" title="Sembunyikan/Tampilkan Saldo">${HIDE_NUMS ? '👁️ Tampil' : '🙈 Privasi'}</button>
      <select id="cur" onchange="setCur(this.value)">${CURS.map(c => `<option ${c === CUR ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
  </div>`;
}

const today = () => new Date().toLocaleDateString('en-CA');
const ym = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
const sum = (a, t) => a.filter(x => x.type === t).reduce((s, x) => s + +x.amount, 0);
function shiftMonth(m, n) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + n, 1); return ym(d); }

let S = { acc: [], tx: [], inst: [], sav: [], mv: [], bud: [], rec: [], tab: 'home', month: ym(new Date()) };

// ====== O(1) BALANCES CACHE ======
let BAL_CACHE = {};
function computeBalances() {
  BAL_CACHE = {};
  S.acc.forEach(a => { BAL_CACHE[a.id] = +a.balance; });
  S.tx.forEach(t => {
    if (BAL_CACHE[t.account_id] !== undefined) {
      if (t.type === 'income') BAL_CACHE[t.account_id] += +t.amount;
      else if (t.type === 'expense') BAL_CACHE[t.account_id] -= +t.amount;
    }
  });
  S.mv.forEach(m => {
    if (m.account_id && BAL_CACHE[m.account_id] !== undefined) {
      if (m.type === 'deposit') BAL_CACHE[m.account_id] -= +m.amount;
      else if (m.type === 'withdraw') BAL_CACHE[m.account_id] += +m.amount;
    }
  });
}

const THEMES = {
  modern: { label: 'Modern (Indigo)', swatch: '#2563eb', vars: { '--bg': '#f8fafc', '--card': '#ffffff', '--card-subtle': '#f1f5f9', '--ink': '#0f172a', '--mute': '#64748b', '--line': '#e2e8f0', '--main': '#2563eb', '--main2': '#1d4ed8', '--main-light': '#eff6ff', '--in': '#059669', '--out': '#e11d48', '--hero1': '#1e3a8a', '--hero2': '#0f172a', '--hero-ink': '#fff', '--hero-mute': '#94a3b8', '--hero-chip': 'rgba(255,255,255,.12)' } },
  klasik: { label: 'Klasik (Emerald)', swatch: '#059669', vars: { '--bg': '#f4f6f4', '--card': '#ffffff', '--card-subtle': '#e9eee9', '--ink': '#14241a', '--mute': '#536b5c', '--line': '#d8e2da', '--main': '#059669', '--main2': '#047857', '--main-light': '#ecfdf5', '--in': '#059669', '--out': '#dc2626', '--hero1': '#065f46', '--hero2': '#022c22', '--hero-ink': '#fff', '--hero-mute': '#a7f3d0', '--hero-chip': 'rgba(255,255,255,.12)' } },
  gelap: { label: 'Gelap (Obsidian)', swatch: '#6366f1', vars: { '--bg': '#090d16', '--card': '#131b2e', '--card-subtle': '#1a243d', '--ink': '#f1f5f9', '--mute': '#8192a9', '--line': '#1e293b', '--main': '#6366f1', '--main2': '#4f46e5', '--main-light': 'rgba(99,102,241,.18)', '--in': '#10b981', '--out': '#f43f5e', '--hero1': '#312e81', '--hero2': '#090d16', '--hero-ink': '#fff', '--hero-mute': '#94a3b8', '--hero-chip': 'rgba(255,255,255,.08)' } },
};

let CURRENT_THEME = 'modern';
function applyTheme(name) {
  const t = THEMES[name]; if (!t) return;
  CURRENT_THEME = name;
  Object.entries(t.vars).forEach(([k, val]) => document.documentElement.style.setProperty(k, val));
  try { localStorage.setItem('theme', name); } catch (e) {}
}
try { applyTheme(localStorage.getItem('theme') || 'modern'); } catch (e) { applyTheme('modern'); }

let showThemeSheet = false, CURRENT_USER = null;
let showAddSheet = false, addMode = null, editing = null;

// ====== INLINE MATH CALCULATOR ======
function evalMathExpr(expr) {
  if (!expr) return null;
  const s = String(expr).trim();
  if (!/[\+\-\*\/]/.test(s)) return null;
  const sanitized = s.replace(/\./g, '').replace(/,/g, '.');
  if (!/^[\d\s\.\+\-\*\/]+$/.test(sanitized)) return null;
  try {
    const val = Function(`'use strict'; return (${sanitized})`)();
    if (typeof val === 'number' && !isNaN(val) && isFinite(val) && val >= 0) {
      return Math.round(val);
    }
  } catch(e) {}
  return null;
}

function formatInputCurrency(inputEl) {
  if (!inputEl) return;
  
  let badge = inputEl.nextElementSibling;
  if (!badge || !badge.classList.contains('math-calc-badge')) {
    badge = document.createElement('div');
    badge.className = 'math-calc-badge';
    badge.style.cssText = 'font-size:11.5px;color:var(--main);font-weight:600;margin-top:-6px;margin-bottom:8px;display:none;background:var(--card-subtle);padding:4px 8px;border-radius:6px';
    inputEl.parentNode.insertBefore(badge, inputEl.nextSibling);
  }

  inputEl.addEventListener('input', function() {
    const raw = this.value;
    const calcResult = evalMathExpr(raw);
    if (calcResult !== null) {
      badge.style.display = 'block';
      badge.innerHTML = `🧮 Hasil hitung: <b>${rp(calcResult)}</b> (Tekan Enter/Selesai untuk menerapkan)`;
      return;
    } else {
      badge.style.display = 'none';
    }

    let cursorPosition = this.selectionStart;
    let val = this.value.replace(/[^0-9]/g, '');
    if (val === '') { this.value = ''; return; }
    let formatted = parseInt(val, 10).toLocaleString('id-ID');
    let diff = formatted.length - this.value.length;
    this.value = formatted;
    this.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
  });

  inputEl.addEventListener('blur', function() {
    const calcResult = evalMathExpr(this.value);
    if (calcResult !== null) {
      this.value = calcResult.toLocaleString('id-ID');
      badge.style.display = 'none';
      this.dispatchEvent(new Event('input'));
    }
  });

  inputEl.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const calcResult = evalMathExpr(this.value);
      if (calcResult !== null) {
        e.preventDefault();
        this.value = calcResult.toLocaleString('id-ID');
        badge.style.display = 'none';
        this.dispatchEvent(new Event('input'));
      }
    }
  });
}

function toggleAddSheet(v) { 
  showAddSheet = v; 
  if (!v) { addMode = null; editing = null; } 
  render(); 
  if (v) {
    setTimeout(() => {
      ['qa_bal', 'qt_amt', 'qf_amt', 'qi_amt', 'qi_tot', 'qs_tgt', 'qb_limit', 'qr_amt', 'm_amt_'].forEach(id => {
        const el = document.querySelector(`input[id^="${id}"]`);
        if (el) formatInputCurrency(el);
      });
    }, 50);
  }
}

function goAdd(mode) { 
  editing = null; 
  addMode = mode; 
  if (mode !== null) {
    showAddSheet = true;
  }
  render(); 
  setTimeout(() => {
    ['qa_bal', 'qt_amt', 'qf_amt', 'qi_amt', 'qi_tot', 'qs_tgt', 'qb_limit', 'qr_amt', 'm_amt_'].forEach(id => {
      const el = document.querySelector(`input[id^="${id}"]`);
      if (el) formatInputCurrency(el);
    });
  }, 50); 
}

function openTransfer() {
  editing = null;
  if (!S.acc || S.acc.length === 0) {
    toast('Anda belum memiliki rekening. Tambah rekening dulu ya.', 'warn');
    goAdd('accs');
    return;
  }
  if (S.acc.length < 2) {
    toast('Transfer butuh minimal 2 rekening. Yuk tambah 1 rekening lagi!', 'warn');
    goAdd('accs');
    return;
  }
  goAdd('transfer');
}

// ====== DUPLIKASI TRANSAKSI ======
function duplicateTx(id) {
  const t = S.tx.find(x => x.id === id);
  if (!t) return;
  editing = null;
  addMode = 'trx';
  showAddSheet = true;
  render();
  setTimeout(() => {
    if ($('qt_amt')) {
      $('qt_amt').value = toCurVal(t.amount);
      formatInputCurrency($('qt_amt'));
    }
    if ($('qt_type')) $('qt_type').value = t.type || 'expense';
    if ($('qt_acc')) $('qt_acc').value = t.account_id;
    if ($('qt_cat')) $('qt_cat').value = t.category || '';
    if ($('qt_note')) $('qt_note').value = t.note || '';
    if ($('qt_date')) $('qt_date').value = today();
    toast('Data transaksi disalin. Silakan periksa & simpan.', 'info');
  }, 60);
}

function editRow(table, id) {
  editing = { table, id };
  addMode = { transactions: 'trx', installments: 'inst', savings: 'sav', accounts: 'accs', budgets: 'budget', recurring: 'recurring' }[table];
  showAddSheet = true; render();
  setTimeout(() => {
    ['qa_bal', 'qt_amt', 'qf_amt', 'qi_amt', 'qi_tot', 'qs_tgt', 'qb_limit', 'qr_amt', 'm_amt_'].forEach(id => {
      const el = document.querySelector(`input[id^="${id}"]`);
      if (el) formatInputCurrency(el);
    });
  }, 50);
}

// ====== QUICK CATEGORY SELECTOR ======
const QUICK_CATS = ['Makan', 'Transport', 'Belanja', 'Gaji', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan'];
function selectTxType(type, btn) {
  const hidden = document.getElementById('qt_type');
  if (hidden) hidden.value = type;
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

function pickCat(c, targetId, chipEl) {
  const el = $(targetId);
  if (el) { el.value = c; el.focus(); }
  if (chipEl && chipEl.parentElement) {
    chipEl.parentElement.querySelectorAll('.cat-chip').forEach(ch => ch.classList.remove('active'));
    chipEl.classList.add('active');
  }
}

function addSheetHtml() {
  if (!showAddSheet) return '';
  if (!addMode) {
    const opts = [
      ['trx', '💸', 'Transaksi', 'Catat pemasukan atau pengeluaran'],
      ['transfer', '🔁', 'Transfer Saldo', 'Pindah dana antar rekening'],
      ['inst', '🏦', 'Cicilan Pinjaman', 'Catat kredit / cicilan bulanan'],
      ['sav', '💰', 'Tabungan Impian', 'Buat pos target atau alokasi tabungan'],
      ['accs', '🏛️', 'Rekening & Dompet', 'Tambah dompet tunai atau rekening bank'],
      ['budget', '🎯', 'Anggaran (Budget)', 'Batas belanja per kategori bulanan'],
      ['recurring', '📆', 'Transaksi Rutin', 'Otomatis tiap tanggal tertentu']
    ];
    return `<div class="sheet-bg" onclick="if(event.target===this)toggleAddSheet(false)">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h3>Catat Keuangan Baru</h3>
        ${opts.map(([k, ic, l, d]) => `<button type="button" class="theme-opt" onclick="${k === 'transfer' ? 'openTransfer()' : `goAdd('${k}')`}">
          <div class="icon">${ic}</div>
          <div style="flex:1"><b>${l}</b><div class="mute">${d}</div></div>
        </button>`).join('')}
        <button style="width:100%;margin-top:14px;background:var(--card-subtle);color:var(--ink)" onclick="toggleAddSheet(false)">Batal</button>
      </div>
    </div>`;
  }

  const titles = { trx: editing ? 'Edit Transaksi' : 'Catat Transaksi', transfer: 'Transfer Antar Rekening', inst: editing ? 'Edit Cicilan' : 'Tambah Cicilan', sav: editing ? 'Edit Tabungan' : 'Target Tabungan Baru', accs: editing ? 'Edit Rekening' : 'Tambah Rekening', budget: editing ? 'Edit Budget' : 'Atur Batas Budget', recurring: editing ? 'Edit Transaksi Rutin' : 'Transaksi Rutin Baru' };
  const needsAcc = (addMode === 'trx' || addMode === 'inst' || addMode === 'recurring') && !S.acc.length;
  const needs2Acc = addMode === 'transfer' && S.acc.length < 2;
  let body;
  const accSel = (id, selId) => `<select id="${id}">${S.acc.map(a => `<option value="${a.id}" ${selId === a.id ? 'selected' : ''}>${esc(a.name)} (Saldo: ${rp(accBal(a))})</option>`).join('')}</select>`;
  
  if (needsAcc) {
    body = `<div class="mute" style="margin-bottom:12px">Anda belum memiliki rekening. Buat rekening pertama terlebih dahulu:</div>
      <input id="qa_name" placeholder="Nama rekening (BCA, Tunai, GoPay...)">
      <input id="qa_bal" type="text" inputmode="numeric" placeholder="Saldo awal (${CUR})">
      <button style="width:100%;margin-top:8px" onclick="addAcc('qa_')">Simpan Rekening</button>`;
  } else if (addMode === 'trx') {
    const ed = editing && editing.table === 'transactions' ? S.tx.find(x => x.id === editing.id) : null;
    body = `${ed ? '' : `
      <div class="scan-banner" onclick="document.getElementById('scanFile').click()">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--card);display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:var(--shadow-sm)">
            ${GEMINI_API_KEY ? '✨' : '📷'}
          </div>
          <div>
            <b style="font-size:13px;color:var(--ink);display:block">${GEMINI_API_KEY ? 'Scan Struk AI (Gemini Vision)' : 'Pindai Struk Belanja (OCR)'}</b>
            <span class="mute" style="font-size:11px">${GEMINI_API_KEY ? 'Otomatis baca total, tanggal & kategori' : 'Ketuk untuk foto atau pilih struk'}</span>
          </div>
        </div>
        <button type="button" class="outline" style="font-size:11px;padding:6px 10px;white-space:nowrap;background:var(--card)" onclick="event.stopPropagation();promptGeminiKey()" title="Atur Google Gemini API Key">
          ${GEMINI_API_KEY ? '🤖 AI Aktif' : '⚡ Pakai AI'}
        </button>
      </div>
      <input id="scanFile" type="file" accept="image/*" style="display:none" onchange="scanReceipt(this.files[0],'qt_')">
      <div id="scanStatus"></div>`}
      <div class="type-toggle-group">
        <input type="hidden" id="qt_type" value="${ed ? ed.type : 'expense'}">
        <button type="button" class="type-btn exp-btn ${!ed || ed.type === 'expense' ? 'active' : ''}" onclick="selectTxType('expense', this)">
          <span class="type-dot"></span> Pengeluaran
        </button>
        <button type="button" class="type-btn inc-btn ${ed && ed.type === 'income' ? 'active' : ''}" onclick="selectTxType('income', this)">
          <span class="type-dot"></span> Pemasukan
        </button>
      </div>
      ${accSel('qt_acc', ed ? ed.account_id : null)}
      <input id="qt_amt" type="text" inputmode="numeric" placeholder="Jumlah (${CUR}), cth: 50.000" value="${ed ? toCurVal(ed.amount) : ''}">
      <input id="qt_cat" placeholder="Kategori (makan, gaji, transport, tagihan...)" value="${ed ? esc(ed.category || '') : ''}">
      <div class="chips-scroll">
        ${QUICK_CATS.map(c => `<span class="cat-chip ${ed && ed.category === c ? 'active' : ''}" onclick="pickCat('${c}','qt_cat',this)">${catIcon(c)} ${c}</span>`).join('')}
      </div>
      <input id="qt_note" placeholder="Catatan tambahan (opsional)" value="${ed ? esc(ed.note || '') : ''}">
      <input id="qt_date" type="date" value="${ed ? ed.date : today()}">
      <button style="width:100%;margin-top:8px" onclick="addTx('qt_')">${ed ? 'Simpan Perubahan' : 'Simpan Transaksi'}</button>
      ${ed ? `
        <button type="button" class="outline" style="width:100%;margin-top:6px" onclick="duplicateTx('${ed.id}')">📋 Duplikat Jadi Transaksi Baru</button>
        <button class="ghost danger" style="width:100%;margin-top:6px" onclick="del('transactions','${ed.id}');toggleAddSheet(false)">Hapus Transaksi Ini</button>
      ` : ''}`;
  } else if (addMode === 'transfer') {
    if (needs2Acc) {
      body = `<div class="mute" style="margin-bottom:10px">Minimal diperlukan 2 rekening untuk melakukan transfer.</div><button style="width:100%" onclick="goAdd('accs')">Tambah Rekening Baru</button>`;
    } else {
      body = `<div class="mute" style="margin-bottom:4px">Dari rekening asal</div>${accSel('qf_from')}
      <div class="mute" style="margin:8px 0 4px">Ke rekening tujuan</div>${accSel('qf_to', S.acc[1] ? S.acc[1].id : null)}
      <input id="qf_amt" type="text" inputmode="numeric" placeholder="Nominal transfer (${CUR})">
      <input id="qf_note" placeholder="Catatan transfer (opsional)">
      <input id="qf_date" type="date" value="${today()}">
      <button style="width:100%;margin-top:8px" onclick="addTransfer()">Konfirmasi Transfer</button>`;
    }
  } else if (addMode === 'inst') {
    const ed = editing && editing.table === 'installments' ? S.inst.find(x => x.id === editing.id) : null;
    body = `<input id="qi_name" placeholder="Nama cicilan (KPR, Motor, Laptop...)" value="${ed ? esc(ed.name) : ''}">
      <input id="qi_amt" type="text" inputmode="numeric" placeholder="Cicilan per bulan (${CUR})" value="${ed ? toCurVal(ed.monthly_amount) : ''}">
      <input id="qi_tot" type="text" inputmode="numeric" placeholder="Total durasi (bulan)" value="${ed ? ed.total_months : ''}">
      <input id="qi_paid" type="text" inputmode="numeric" placeholder="Sudah terbayar berapa bulan" value="${ed ? ed.paid_months : ''}">
      ${accSel('qi_acc', ed ? ed.account_id : null)}
      <button style="width:100%;margin-top:8px" onclick="addInst('qi_')">${ed ? 'Simpan Perubahan' : 'Simpan Cicilan'}</button>
      ${ed ? `<button class="ghost danger" style="width:100%;margin-top:6px" onclick="del('installments','${ed.id}');toggleAddSheet(false)">Hapus Cicilan</button>` : ''}`;
  } else if (addMode === 'sav') {
    const ed = editing && editing.table === 'savings' ? S.sav.find(x => x.id === editing.id) : null;
    body = `<input id="qs_name" placeholder="Nama target (Dana Darurat, Liburan...)" value="${ed ? esc(ed.name) : ''}">
      <input id="qs_tgt" type="text" inputmode="numeric" placeholder="Target nominal (${CUR}, opsional)" value="${ed && ed.target ? toCurVal(ed.target) : ''}">
      <button style="width:100%;margin-top:8px" onclick="addSav('qs_')">${ed ? 'Simpan Perubahan' : 'Buat Tabungan'}</button>
      ${ed ? `<button class="ghost danger" style="width:100%;margin-top:6px" onclick="del('savings','${ed.id}');toggleAddSheet(false)">Hapus Tabungan</button>` : '<div class="mute" style="margin-top:8px;text-align:center">Setor atau tarik dana bisa dilakukan langsung di tab Tabungan.</div>'}`;
  } else if (addMode === 'budget') {
    const ed = editing && editing.table === 'budgets' ? S.bud.find(x => x.id === editing.id) : null;
    body = `<input id="qb_cat" placeholder="Nama kategori pengeluaran (Makan, Transport...)" value="${ed ? esc(ed.category) : ''}">
      <div class="chips-scroll">
        ${QUICK_CATS.map(c => `<span class="cat-chip" onclick="pickCat('${c}','qb_cat')">${catIcon(c)} ${c}</span>`).join('')}
      </div>
      <input id="qb_limit" type="text" inputmode="numeric" placeholder="Batas limit per bulan (${CUR})" value="${ed ? toCurVal(ed.monthly_limit) : ''}">
      <button style="width:100%;margin-top:8px" onclick="addBudget('qb_')">${ed ? 'Simpan Perubahan' : 'Simpan Budget'}</button>
      ${ed ? `<button class="ghost danger" style="width:100%;margin-top:6px" onclick="del('budgets','${ed.id}');toggleAddSheet(false)">Hapus Budget</button>` : ''}`;
  } else if (addMode === 'recurring') {
    if (needsAcc) {
      body = `<div class="mute">Tambah rekening dulu ya.</div><button style="width:100%" onclick="goAdd('accs')">Tambah Rekening</button>`;
    } else {
      const ed = editing && editing.table === 'recurring' ? S.rec.find(x => x.id === editing.id) : null;
      body = `<input id="qr_name" placeholder="Nama (Gaji Bulanan, Tagihan Wifi...)" value="${ed ? esc(ed.name) : ''}">
        <select id="qr_type"><option value="expense" ${!ed || ed.type === 'expense' ? 'selected' : ''}>Pengeluaran</option><option value="income" ${ed && ed.type === 'income' ? 'selected' : ''}>Pemasukan</option></select>
        ${accSel('qr_acc', ed ? ed.account_id : null)}
        <input id="qr_amt" type="text" inputmode="numeric" placeholder="Jumlah (${CUR})" value="${ed ? toCurVal(ed.amount) : ''}">
        <input id="qr_cat" placeholder="Kategori (opsional)" value="${ed ? esc(ed.category || '') : ''}">
        <input id="qr_day" type="text" inputmode="numeric" placeholder="Jatuh tempo setiap tanggal (1-28)" value="${ed ? ed.day_of_month : ''}">
        <button style="width:100%;margin-top:8px" onclick="addRecurring('qr_')">${ed ? 'Simpan Perubahan' : 'Simpan Transaksi Rutin'}</button>
        ${ed ? `<button class="ghost danger" style="width:100%;margin-top:6px" onclick="del('recurring','${ed.id}');toggleAddSheet(false)">Hapus</button>` : ''}`;
    }
  } else {
    const ed = editing && editing.table === 'accounts' ? S.acc.find(x => x.id === editing.id) : null;
    body = `<input id="qa_name" placeholder="Nama rekening / dompet (BCA, Mandiri, Dompet...)" value="${ed ? esc(ed.name) : ''}">
      <input id="qa_bal" type="text" inputmode="numeric" placeholder="Saldo awal (${CUR})" value="${ed ? toCurVal(ed.balance) : ''}">
      <button style="width:100%;margin-top:8px" onclick="addAcc('qa_')">${ed ? 'Simpan Perubahan' : 'Tambah Rekening'}</button>
      ${ed ? `<button class="ghost danger" style="width:100%;margin-top:6px" onclick="del('accounts','${ed.id}');toggleAddSheet(false)">Hapus Rekening</button>` : ''}`;
  }

  return `<div class="sheet-bg" onclick="if(event.target===this)toggleAddSheet(false)">
    <div class="sheet">
      <div class="sheet-handle"></div>
      <div class="row" style="margin-bottom:14px">
        <button class="ghost" style="color:var(--ink);padding-left:0" onclick="goAdd(null)">‹ Pilihan</button>
        <h3 style="margin:0">${titles[addMode]}</h3>
        <span style="width:40px"></span>
      </div>
      ${body}
    </div>
  </div>`;
}

function toggleThemeSheet(v) { showThemeSheet = v; render(); }
function changeMonth(n) { S.month = shiftMonth(S.month, n); render(); }
function pickMonth(el) { S.month = el.value; render(); }
function pickTheme(name) { applyTheme(name); render(); toast('Tema berhasil diubah', 'success'); }

let settingsTab = 'tema';
function setSettingsTab(t) { settingsTab = t; render(); }

function themeListHtml() {
  return Object.entries(THEMES).map(([k, t]) => `
    <div class="theme-opt ${k === CURRENT_THEME ? 'on' : ''}" onclick="pickTheme('${k}')">
      <div class="swatch" style="background:${t.swatch}"></div>
      <b>${t.label}</b>
      ${k === CURRENT_THEME ? '<span class="check">✓</span>' : ''}
    </div>`).join('');
}


// ====== FOTO PROFIL & AVATAR PENGGUNA ======
const PRESET_AVATARS = ['💼', '🦊', '🐼', '🦁', '🚀', '💎', '🐱', '☕'];

function avatarImgHtml(u, size = 32) {
  const av = u && u.user_metadata && u.user_metadata.avatar_url;
  const uname = (u && u.user_metadata && u.user_metadata.username) || '';
  const email = (u && u.email) || 'User';
  const name = uname || email;
  const initial = (name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1) || 'U').toUpperCase();
  
  if (av) {
    if (av.length <= 4 && !av.startsWith('http') && !av.startsWith('data:')) {
      return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--card-subtle);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.52)}px;border:1px solid var(--line);box-shadow:var(--shadow-sm);flex-shrink:0">${av}</div>`;
    }
    return `<img src="${esc(av)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid var(--main);box-shadow:var(--shadow-sm);flex-shrink:0" alt="Avatar">`;
  }
  
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,var(--main),var(--main2));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size*0.42)}px;box-shadow:var(--shadow-sm);flex-shrink:0;text-transform:uppercase">${esc(initial)}</div>`;
}

function userAvatarBtn(size = 32) {
  return `<div class="user-avatar-btn" onclick="toggleThemeSheet(true);setSettingsTab('akun')" title="Profil & Foto Akun">
    ${avatarImgHtml(CURRENT_USER, size)}
  </div>`;
}

function compressImageToAvatar(file, targetSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
        try {
          resolve(canvas.toDataURL('image/webp', 0.85));
        } catch(err) {
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadProfilePhoto(file) {
  if (!file) return;
  if (!CURRENT_USER) return toast('Harap login terlebih dahulu', 'warn');
  
  const statusEl = document.getElementById('pf_avatar_status');
  if (statusEl) statusEl.innerHTML = '<span class="mute">⏳ Mengompres & mengunggah foto...</span>';
  
  try {
    const compressedDataUrl = await compressImageToAvatar(file, 200);
    let finalAvatarUrl = compressedDataUrl;

    try {
      const blob = await (await fetch(compressedDataUrl)).blob();
      const ext = 'webp';
      const filePath = `${CURRENT_USER.id}/avatar-${Date.now()}.${ext}`;
      const { data: stData, error: stErr } = await sb.storage.from('avatars').upload(filePath, blob, {
        upsert: true,
        contentType: 'image/webp'
      });
      if (!stErr) {
        const { data: pubData } = sb.storage.from('avatars').getPublicUrl(filePath);
        if (pubData && pubData.publicUrl) finalAvatarUrl = pubData.publicUrl;
      }
    } catch(stCatch) {
      console.warn('Storage bucket fallback:', stCatch);
    }

    const { data: authData, error: authErr } = await sb.auth.updateUser({
      data: { avatar_url: finalAvatarUrl }
    });
    if (authErr) throw authErr;

    try {
      await sb.from('profiles').upsert({
        id: CURRENT_USER.id,
        avatar_url: finalAvatarUrl,
        username: (CURRENT_USER.user_metadata && CURRENT_USER.user_metadata.username) || '',
        updated_at: new Date().toISOString()
      });
    } catch(e) {}

    CURRENT_USER = authData.user;
    saveToLocalCache();
    toast('Foto profil berhasil diperbarui!', 'success');
    render();
  } catch(err) {
    console.error('Upload avatar error:', err);
    toast('Gagal mengunggah foto: ' + err.message, 'error');
  } finally {
    if (statusEl) statusEl.innerHTML = '';
  }
}

async function setPresetAvatar(av) {
  if (!CURRENT_USER) return;
  try {
    const { data: authData, error: authErr } = await sb.auth.updateUser({
      data: { avatar_url: av }
    });
    if (authErr) throw authErr;

    try {
      await sb.from('profiles').upsert({
        id: CURRENT_USER.id,
        avatar_url: av,
        username: (CURRENT_USER.user_metadata && CURRENT_USER.user_metadata.username) || '',
        updated_at: new Date().toISOString()
      });
    } catch(e) {}

    CURRENT_USER = authData.user;
    saveToLocalCache();
    toast('Avatar profil berhasil diubah!', 'success');
    render();
  } catch(err) {
    toast('Gagal mengubah avatar: ' + err.message, 'error');
  }
}

async function removeAvatar() {
  if (!CURRENT_USER) return;
  try {
    const { data: authData, error: authErr } = await sb.auth.updateUser({
      data: { avatar_url: null }
    });
    if (authErr) throw authErr;

    try {
      await sb.from('profiles').upsert({
        id: CURRENT_USER.id,
        avatar_url: null,
        updated_at: new Date().toISOString()
      });
    } catch(e) {}

    CURRENT_USER = authData.user;
    saveToLocalCache();
    toast('Foto profil dihapus', 'info');
    render();
  } catch(err) {
    toast('Gagal menghapus foto: ' + err.message, 'error');
  }
}

function accountHtml() {
  const u = CURRENT_USER, uname = (u && u.user_metadata && u.user_metadata.username) || '';
  return `
    <!-- Foto Profil Pengguna -->
    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--line)">
      <div style="position:relative;width:86px;height:86px;cursor:pointer" onclick="document.getElementById('avatarFileInput').click()" title="Ketuk untuk ganti foto profil">
        ${avatarImgHtml(u, 86)}
        <div style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:50%;background:var(--main);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:var(--shadow-sm);border:2px solid var(--card)">📷</div>
      </div>
      <input id="avatarFileInput" type="file" accept="image/*" style="display:none" onchange="uploadProfilePhoto(this.files[0])">
      <div id="pf_avatar_status" style="font-size:12px;margin-top:4px"></div>
      
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="outline" style="font-size:12px;padding:6px 14px" onclick="document.getElementById('avatarFileInput').click()">Unggah Foto</button>
        ${u && u.user_metadata && u.user_metadata.avatar_url ? `<button class="ghost danger" style="font-size:12px;padding:6px 10px" onclick="removeAvatar()">Hapus</button>` : ''}
      </div>

      <div class="mute" style="font-size:11px;margin:12px 0 6px;text-align:center">Atau pilih avatar karakter siap pakai:</div>
      <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap">
        ${PRESET_AVATARS.map(av => `<button type="button" class="avatar-preset-btn" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:var(--card-subtle);font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="setPresetAvatar('${av}')" title="Gunakan avatar ${av}">${av}</button>`).join('')}
      </div>
    </div>

    <div class="mute" style="margin-bottom:8px">Login sebagai: <b>${esc(u ? u.email : '')}</b></div>
    <input id="pf_uname" placeholder="Nama pengguna / Username" value="${esc(uname)}">
    <button style="width:100%;margin-top:6px" onclick="saveUsername()">Perbarui Username</button>
    <div class="mute" style="margin:18px 0 6px">Integrasi AI Scanner Struk (Google Gemini)</div>
    <div class="mute" style="font-size:11.5px;margin-bottom:6px">Dapatkan API Key <b>Gratis</b> di <a href="https://aistudio.google.com" target="_blank" style="color:var(--main)">aistudio.google.com</a> untuk hasil scan struk 100% akurat:</div>
    <input id="pf_gemini" placeholder="Masukkan Gemini API Key (AIzaSy...)" value="${esc(GEMINI_API_KEY)}">
    <button style="width:100%;margin-top:4px;background:var(--card-subtle);color:var(--ink)" onclick="saveGeminiKey(v('pf_gemini'))">Simpan API Key Gemini</button>
    <div class="mute" style="margin:18px 0 6px">Keamanan Password</div>
    <input id="pf_pw1" type="password" placeholder="Password baru (min. 6 karakter)" autocomplete="new-password">
    <input id="pf_pw2" type="password" placeholder="Ulangi password baru" autocomplete="new-password">
    <button style="width:100%;margin-top:6px" onclick="changePassword()">Ganti Password</button>
    <button class="ghost danger" style="width:100%;margin-top:16px" onclick="logout()">Keluar dari Akun</button>`;
}

function themeSheetHtml() {
  if (!showThemeSheet) return '';
  return `<div class="sheet-bg" onclick="if(event.target===this)toggleThemeSheet(false)">
    <div class="sheet">
      <div class="sheet-handle"></div>
      <h3>Pengaturan Duitku</h3>
      <div class="segTabs">
        <button class="${settingsTab === 'tema' ? 'on' : ''}" onclick="setSettingsTab('tema')">Tampilan & Tema</button>
        <button class="${settingsTab === 'akun' ? 'on' : ''}" onclick="setSettingsTab('akun')">Profil & Akun</button>
      </div>
      ${settingsTab === 'tema' ? themeListHtml() : accountHtml()}
      <button style="width:100%;margin-top:14px;background:var(--card-subtle);color:var(--ink)" onclick="toggleThemeSheet(false)">Tutup</button>
    </div>
  </div>`;
}

function gearBtn() { return '<button class="gear" onclick="toggleThemeSheet(true)" title="Pengaturan">⚙️</button>'; }

async function run(p) {
  const { error } = await p;
  if (error) { toast(error.message, 'error'); return false; }
  return true;
}

async function boot() {
  const hasCache = loadFromLocalCache();
  if (hasCache) {
    render();
    safeDismissSplash();
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { 
      CURRENT_USER = session.user; 
      load(); 
    } else { 
      if (!hasCache) authView(); 
    }
  } catch(e) {
    if (!hasCache) authView();
  }
}

async function load(skipRecurring) {
  try {
    const [a, t, i, sv, mv, bu, rc] = await Promise.all([
      sb.from('accounts').select('*').order('created_at'),
      sb.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
      sb.from('installments').select('*').order('created_at'),
      sb.from('savings').select('*').order('created_at'),
      sb.from('saving_moves').select('*').order('created_at'),
      sb.from('budgets').select('*').order('created_at'),
      sb.from('recurring').select('*').order('created_at')
    ]);
    S.acc = a.data || []; S.tx = t.data || []; S.inst = i.data || []; S.sav = sv.data || []; S.mv = mv.data || [];
    S.bud = bu.data || []; S.rec = rc.data || [];
    computeBalances();
    saveToLocalCache();
    if (!skipRecurring && await runRecurring()) return load(true);
    render();
    safeDismissSplash();
  } catch(err) {
    console.error(err);
    render();
    safeDismissSplash();
  }
}

async function runRecurring() {
  if (!S.rec.length) return false;
  const nowYm = ym(new Date()), todayDate = new Date().getDate();
  const toInsert = [];
  const toUpdate = [];

  for (const r of S.rec) {
    if (r.last_run === nowYm || todayDate < r.day_of_month) continue;
    const date = nowYm + '-' + String(r.day_of_month).padStart(2, '0');
    toInsert.push({ account_id: r.account_id, type: r.type, amount: r.amount, category: r.category, note: (r.note ? r.note + ' · ' : '') + 'Otomatis: ' + r.name, date });
    toUpdate.push(r.id);
  }

  if (toInsert.length) {
    await sb.from('transactions').insert(toInsert);
    for (const rid of toUpdate) {
      await sb.from('recurring').update({ last_run: nowYm }).eq('id', rid);
    }
    return true;
  }
  return false;
}

let showForgot = false, showRecovery = false;
function toggleForgot(v) { showForgot = v; render(); }

function authView() {
  safeDismissSplash();
  if (showRecovery) { $('app').innerHTML = recoveryHtml(); return; }
  $('app').innerHTML = `
  <div style="position:absolute;top:16px;right:16px">${userAvatarBtn(28)} ${gearBtn()}</div>
  ${themeSheetHtml()}
  <div class="wrap" style="padding-top:40px">
    <div style="text-align:center;margin-bottom:28px">
      <img src="icon-192.png" alt="Duitku Logo" style="width:64px;height:64px;border-radius:16px;box-shadow:0 8px 24px rgba(57,86,245,0.25);margin-bottom:12px;display:inline-block">
      <h1 style="padding:0;margin:0 0 6px">Duitku</h1>
      <div class="mute">Kelola uang, cicilan, dan tabungan secara cerdas</div>
    </div>
    <div class="card">
      ${showForgot ? `
        <div class="mute" style="margin-bottom:12px">Ketik alamat email Anda untuk menerima link reset kata sandi:</div>
        <input id="fp_email" type="email" placeholder="Email Anda" autocomplete="email">
        <button style="width:100%;margin-top:10px" onclick="sendReset()">Kirim Link Reset</button>
        <button class="ghost" style="width:100%;margin-top:8px" onclick="toggleForgot(false)">‹ Kembali ke Halaman Masuk</button>
      ` : `
        <input id="em" type="email" placeholder="Email terdaftar" autocomplete="email">
        <input id="pw" type="password" placeholder="Kata sandi (min. 6 karakter)" autocomplete="current-password">
        <div class="row" style="margin-top:12px">
          <button style="flex:1" onclick="login()">Masuk</button>
          <button class="ghost" style="color:var(--main)" onclick="signup()">Daftar Baru</button>
        </div>
        <button class="ghost" style="width:100%;margin-top:10px" onclick="toggleForgot(true)">Lupa password?</button>
      `}
    </div>
  </div>`;
}

function recoveryHtml() {
  return `<div class="wrap" style="padding-top:40px">
    <h1>Atur Kata Sandi Baru</h1>
    <div class="card">
      <div class="mute" style="margin-bottom:12px">Link reset terverifikasi. Masukkan kata sandi baru Anda:</div>
      <input id="rc_pw1" type="password" placeholder="Password baru (min. 6 karakter)" autocomplete="new-password">
      <input id="rc_pw2" type="password" placeholder="Ulangi password baru" autocomplete="new-password">
      <button style="width:100%;margin-top:10px" onclick="finishRecovery()">Simpan Password Baru</button>
    </div>
  </div>`;
}

async function sendReset() {
  const email = v('fp_email').trim();
  if (!email) return alert('Isi email kamu.');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  if (error) return alert(error.message);
  toast('Link reset sudah dikirim. Cek inbox (atau folder spam).', 'success');
  showForgot = false; render();
}

async function finishRecovery() {
  const p1 = v('rc_pw1'), p2 = v('rc_pw2');
  if (p1.length < 6) return alert('Password minimal 6 karakter.');
  if (p1 !== p2) return alert('Konfirmasi password tidak cocok.');
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) return alert(error.message);
  showRecovery = false; toast('Password berhasil diganti. Anda sudah masuk.', 'success'); load();
}

function needCred() { if (!v('em').trim() || v('pw').length < 6) { alert('Isi email dan kata sandi (min. 6 karakter).'); return true; } }

async function login() {
  if (needCred()) return;
  const email = v('em').trim();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: v('pw') });
  if (error) return alert('Login gagal: ' + error.message);
  CURRENT_USER = data.user; toast('Berhasil masuk', 'success'); load();
}

async function signup() {
  if (needCred()) return;
  const { data, error } = await sb.auth.signUp({ email: v('em').trim(), password: v('pw') });
  if (error) return alert(error.message);
  if (data.session) { CURRENT_USER = data.user; toast('Akun berhasil dibuat', 'success'); load(); } 
  else alert('Cek email kamu untuk konfirmasi pendaftaran, lalu login.');
}

async function logout() { await sb.auth.signOut(); CURRENT_USER = null; showThemeSheet = false; authView(); }

const accOpts = () => S.acc.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
const accBal = a => (BAL_CACHE[a.id] !== undefined ? BAL_CACHE[a.id] : +a.balance);
const savBal = x => sum(S.mv.filter(m => m.saving_id === x.id), 'deposit') - sum(S.mv.filter(m => m.saving_id === x.id), 'withdraw');
const savTotal = () => S.sav.reduce((t, x) => t + savBal(x), 0);
const accName = id => (S.acc.find(a => a.id === id) || {}).name || '-';

const CAT_ICON = {
  makan: '🍜', makanan: '🍜', minuman: '🥤', transport: '🚗', bensin: '⛽', belanja: '🛍️',
  gaji: '💰', tagihan: '🧾', listrik: '💡', pulsa: '📱', kesehatan: '💊', cicilan: '🏦',
  hiburan: '🎬', pendidikan: '📚', hadiah: '🎁', transfer: '🔁', lainnya: '💳'
};
const catIcon = k => CAT_ICON[(k || '').toLowerCase()] || (k ? '💳' : '💳');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ====== RENDER UI UTAMA ======
function render() {
  const views = { home, trx, accs, inst, sav };
  const tabs = [
    ['home', 'Beranda', ICONS.home], 
    ['inst', 'Cicilan', ICONS.inst], 
    ['fab', 'Tambah', '+'], 
    ['sav', 'Tabungan', ICONS.sav], 
    ['accs', 'Rekening', ICONS.accs]
  ];
  
  const navHtml = `<nav>${tabs.map(([k, l, ic]) => k === 'fab'
    ? `<button class="fab" onclick="toggleAddSheet(true)" title="${l}">${ic}</button>`
    : `<button class="${S.tab === k ? 'on' : ''}" onclick="S.tab='${k}';render()" title="${l}">
        ${ic}<span>${l}</span>
       </button>`).join('')}</nav>`;
  
  $('app').innerHTML = (S.tab === 'home' ? views.home() : `<div class="wrap">${curBar()}${views[S.tab]()}</div>`) + navHtml + themeSheetHtml() + addSheetHtml();
}

function onboardCard() {
  let dismissed = false;
  try { dismissed = localStorage.getItem('onboarded') === '1'; } catch (e) {}
  if (dismissed || S.acc.length) return '';
  return `<div class="card" style="border-left: 4px solid var(--main)">
    <b>Selamat datang di Duitku 👋</b>
    <div class="mute" style="margin:6px 0 10px">Mulai kelola keuangan dengan menekan tombol <b>+</b> di bawah untuk menambahkan rekening atau dompet pertama Anda.</div>
    <button class="ghost" style="padding-left:0;color:var(--main)" onclick="dismissOnboard()">Saya mengerti, sembunyikan</button>
  </div>`;
}
function dismissOnboard() { try { localStorage.setItem('onboarded', '1'); } catch (e) {} render(); }

// ====== VIEW: BERANDA ======
function home() {
  const m = S.month, thisMonth = ym(new Date());
  const cur = S.tx.filter(t => t.date.startsWith(m));
  const inc = sum(cur, 'income'), exp = sum(cur, 'expense');
  const total = S.acc.reduce((s, a) => s + accBal(a), 0);
  const cat = {};
  cur.filter(t => t.type === 'expense').forEach(t => { const k = t.category || 'Lainnya'; cat[k] = (cat[k] || 0) + +t.amount; });
  const cats = Object.entries(cat).sort((a, b) => b[1] - a[1]);
  const months = [...Array(6)].map((_, i) => shiftMonth(m, i - 5));
  const data = months.map(k => { const x = S.tx.filter(t => t.date.startsWith(k)); return [k, sum(x, 'income'), sum(x, 'expense')]; });

    const prevMonth = shiftMonth(m, -1);
    const prevExp = sum(S.tx.filter(t => t.date.startsWith(prevMonth)), 'expense');
    const dayNum = m === thisMonth ? new Date().getDate() : new Date(m.split('-')[0], m.split('-')[1], 0).getDate();
    const dailyAvg = Math.round(exp / Math.max(1, dayNum));
    let diffBadge = '';
    if (prevExp > 0) {
      const diffExp = exp - prevExp;
      const diffPct = Math.round(Math.abs(diffExp) / prevExp * 100);
      if (diffExp < 0) {
        diffBadge = `<span class="in" style="font-weight:600">🎉 ${diffPct}% lebih hemat dibanding bulan lalu (${rp(Math.abs(diffExp))})</span>`;
      } else if (diffExp > 0) {
        diffBadge = `<span class="out" style="font-weight:600">⚠️ Pengeluaran naik ${diffPct}% dibanding bulan lalu (+${rp(diffExp)})</span>`;
      } else {
        diffBadge = `<span class="mute">Pengeluaran stabil sama dengan bulan lalu</span>`;
      }
    }

  const max = Math.max(1, ...data.flatMap(d => [d[1], d[2]]));
  const label = new Date(m + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Sisa Hari & Rekomendasi Anggaran Harian
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate());

  return `<div class="hero">
    <div class="row">
      <div style="display:flex;align-items:center;gap:10px">
        ${userAvatarBtn(38)}
        <div>
          <span class="greet" style="font-size:13px;display:block">Halo, <b>${esc((CURRENT_USER && CURRENT_USER.user_metadata && CURRENT_USER.user_metadata.username) || 'Kawan')}</b> 👋</span>
          <span class="mute" style="font-size:10.5px;color:var(--hero-mute)">Duitku Financial</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="gear" onclick="togglePrivacy()" title="Privasi Saldo">${HIDE_NUMS ? '👁️' : '🙈'}</button>
        <button class="gear" onclick="toggleThemeSheet(true)" title="Pengaturan">⚙️</button>
      </div>
    </div>
    
    <div class="month-selector">
      <button class="monthNav" onclick="changeMonth(-1)">‹</button>
      <label class="pill">${label}
        <input type="month" value="${m}" onchange="pickMonth(this)" style="position:absolute;inset:0;opacity:0;border:0;padding:0;cursor:pointer">
      </label>
      <button class="monthNav" onclick="changeMonth(1)" ${m >= thisMonth ? 'disabled' : ''}>›</button>
    </div>

    ${m !== thisMonth ? `<div class="mute" style="margin-top:6px;font-size:12px;color:var(--hero-mute)">Periode lampau · <a href="#" onclick="S.month=thisMonth;render();return false" style="color:#fff;text-decoration:underline">Kembali ke bulan ini</a></div>` : ''}

    <div class="bal-label">Total Saldo Likuid</div>
    <div class="bal">${rp(total)}</div>
    <div class="sav-pill"><span>💰</span> Tabungan terpisah: <b>${rp(savTotal())}</b></div>

    <div class="chips">
      <div class="chip in-chip">
        <div class="lbl">↓ Masuk</div>
        <div class="n">${rp(inc)}</div>
      </div>
      <div class="chip out-chip">
        <div class="lbl">↑ Keluar</div>
        <div class="n">${rp(exp)}</div>
      </div>
    </div>
  </div>

  <div class="wrap" style="padding-top: 44px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <button class="quick-action-tile primary" onclick="goAdd('trx')">
        <span class="qa-icon">💸</span>
        <div style="text-align:left">
          <b>Catat Transaksi</b>
          <span class="qa-sub">Masuk atau keluar</span>
        </div>
      </button>
      <button class="quick-action-tile secondary" onclick="openTransfer()">
        <span class="qa-icon">🔁</span>
        <div style="text-align:left">
          <b>Transfer Saldo</b>
          <span class="qa-sub">Antar rekening</span>
        </div>
      </button>
    </div>
    ${onboardCard()}
    <!-- Smart Financial Insights -->
    <div class="card insights-card">
      <div class="row" style="align-items:center">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="insights-icon">💡</div>
          <div>
            <b style="font-size:13.5px;color:var(--ink)">Analisis Keuangan</b>
            <div class="mute" style="font-size:11px">Periode ${label}</div>
          </div>
        </div>
        <span class="pill-badge">Rata-rata: <b>${rp(dailyAvg)}/hari</b></span>
      </div>
      <div style="font-size:12.5px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);line-height:1.5">
        ${diffBadge ? `<div style="margin-bottom:6px">${diffBadge}</div>` : ''}
        <div class="mute" style="display:flex;align-items:center;gap:6px">
          <span>🎯</span>
          <span>Sisa likuid aman: <b>${rp(Math.round(total / Math.max(1, daysLeft)))}/hari</b> (untuk <b>${daysLeft} hari</b> ke depan)</span>
        </div>
      </div>
    </div>

    
    <h2>
      <span>Arus Kas 6 Bulan</span>
      <span class="mute" style="font-weight:500;cursor:pointer" onclick="S.tab='trx';render()">Detail ›</span>
    </h2>
    <div class="card" style="cursor:pointer" onclick="S.tab='trx';render()">
      <div class="cols">
        ${data.map(d => `
          <div>
            <div class="bar-group">
              <span style="height:${Math.max(4, d[1] / max * 75)}px;background:var(--in)" title="Masuk: ${rp(d[1])}"></span>
              <span style="height:${Math.max(4, d[2] / max * 75)}px;background:var(--out)" title="Keluar: ${rp(d[2])}"></span>
            </div>
            ${d[0].slice(5)}
          </div>
        `).join('')}
      </div>
      <div class="row mute" style="font-size:11px;margin-top:10px;justify-content:center;gap:16px">
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--in);margin-right:4px"></span>Pemasukan</span>
        <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--out);margin-right:4px"></span>Pengeluaran</span>
      </div>
    </div>

    <h2>Alokasi Belanja (${label})</h2>
    <div class="card">
      ${cats.length ? (() => {
        const colors = ['#2563eb', '#8b5cf6', '#059669', '#f43f5e', '#f59e0b', '#06b6d4', '#d946ef', '#64748b'];
        let acc0 = 0; const stops = cats.map(([, n], i) => { const p0 = acc0, p1 = acc0 + n / exp * 100; acc0 = p1; return `${colors[i % colors.length]} ${p0}% ${p1}%`; }).join(', ');
        return `
        <div class="cat-donut-wrap">
          <div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(${stops});display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-sm)">
            <div style="width:82px;height:82px;border-radius:50%;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
              <span class="mute" style="font-size:10px;font-weight:600;text-transform:uppercase">Total</span>
              <b style="font-size:12.5px">${rp(exp)}</b>
            </div>
          </div>
        </div>
        ${cats.map(([k, n], i) => `
          <div style="margin-bottom:10px">
            <div class="row" style="font-size:13.5px">
              <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[i % colors.length]};margin-right:8px"></span><b>${esc(k)}</b></span>
              <span class="num">${rp(n)} <span class="mute" style="font-size:11.5px">(${Math.round(n / exp * 100)}%)</span></span>
            </div>
            <div class="bar"><i style="width:${n / exp * 100}%;background:${colors[i % colors.length]}"></i></div>
          </div>
        `).join('')}`;
      })() : '<div class="mute" style="text-align:center;padding:16px 0">Belum ada pengeluaran pada bulan ini.</div>'}
    </div>

    ${S.bud.length ? `
    <h2>
      <span>Anggaran & Budget (${label})</span>
      <span class="mute" style="font-size:11.5px">Sisa ${daysLeft} hari</span>
    </h2>
    <div class="card">
      ${S.bud.map(b => {
        const spent = cat[b.category] || 0, pct = Math.min(100, spent / b.monthly_limit * 100), over = spent > b.monthly_limit;
        const remaining = Math.max(0, b.monthly_limit - spent);
        const dailySafe = Math.round(remaining / daysLeft);
        return `<div style="margin-bottom:14px;cursor:pointer" onclick="editRow('budgets','${b.id}')">
          <div class="row">
            <b>${esc(b.category)}</b>
            <span class="${over ? 'out' : ''}" style="font-weight:600;font-size:13px">
              ${rp(spent)} / <span class="mute">${rp(b.monthly_limit)}</span>
            </span>
          </div>
          <div class="bar"><i style="width:${pct}%;background:${over ? 'var(--out)' : pct > 80 ? 'var(--warn)' : 'var(--main)'}"></i></div>
          <div class="row mute" style="font-size:11.5px">
            <span>${over ? '<b class="out">⚠️ Overbudget ' + rp(spent - b.monthly_limit) + '</b>' : 'Sisa budget ' + rp(remaining)}</span>
            <span>${!over && m === thisMonth ? 'Batas aman: <b>' + rp(dailySafe) + '/hari</b>' : ''}</span>
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <h2>Pencadangan & Ekspor Data</h2>
    <div class="card">
      <div class="mute" style="margin-bottom:8px">Pilih periode untuk unduhan laporan:</div>
      <input id="x_m" type="month" value="${m}">
      <div style="display:flex;gap:8px;margin:6px 0">
        <button onclick="exportXlsx()" style="flex:1">📊 Unduh Excel (.xlsx)</button>
        <button class="outline" onclick="printMonthlyReport(v('x_m'))" style="flex:1">📄 Cetak Laporan PDF</button>
      </div>
      <div class="row" style="margin-top:6px">
        <button class="scanBtn" onclick="document.getElementById('impFile').click()" style="flex:1">📂 Impor File CSV</button>
        <button class="outline" onclick="downloadSampleCsv()" style="font-size:12px;padding:12px">📥 Template</button>
      </div>
      <input id="impFile" type="file" accept=".csv,text/csv" style="display:none" onchange="importCsv(this.files[0])">
      <div id="impStatus"></div>
    </div>
  </div>`;
}

// ====== VIEW: TRANSAKSI DENGAN GROUPING TANGGAL & SUB-TOTAL ======
let txFilter = { q: '', cat: '', from: '', to: '' }, searchTimeout;
function setTxFilter(k, val) { txFilter[k] = val; render(); }
function handleSearch(val) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { setTxFilter('q', val); }, 250); }
function clearTxFilter() { txFilter = { q: '', cat: '', from: '', to: '' }; render(); }

function trx() {
  if (!S.acc.length) return `<h1>Transaksi</h1><div class="card" style="text-align:center;padding:30px">Belum ada rekening terdaftar. Tambahkan rekening terlebih dahulu lewat tombol <b>+</b> di bawah.</div>`;
  const cats = [...new Set(S.tx.map(t => t.category || 'Lainnya'))].sort();
  let list = S.tx;
  const f = txFilter;
  if (f.q) { const q = f.q.toLowerCase(); list = list.filter(t => (t.category || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q) || accName(t.account_id).toLowerCase().includes(q)); }
  if (f.cat) list = list.filter(t => (t.category || 'Lainnya') === f.cat);
  if (f.from) list = list.filter(t => t.date >= f.from);
  if (f.to) list = list.filter(t => t.date <= f.to);
  const active = f.q || f.cat || f.from || f.to;
  
  const filInc = sum(list, 'income'), filExp = sum(list, 'expense');

  // Group by date
  const groups = {};
  list.slice(0, active ? 300 : 80).forEach(t => {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  });

  return `<h1>Riwayat Transaksi</h1>
  <div class="card">
    <input id="txq" placeholder="🔍 Cari transaksi, merchant, catatan..." value="${esc(f.q)}" oninput="handleSearch(this.value)">
    <div class="row">
      <select onchange="setTxFilter('cat', this.value)" style="margin:0">
        <option value="">Semua Kategori</option>
        ${cats.map(c => `<option value="${esc(c)}" ${f.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
    </div>
    <div class="row" style="margin-top:6px">
      <input type="date" value="${f.from}" onchange="setTxFilter('from', this.value)" style="margin:0" title="Dari tanggal">
      <input type="date" value="${f.to}" onchange="setTxFilter('to', this.value)" style="margin:0" title="Sampai tanggal">
    </div>
    ${active ? `
      <div class="row mute" style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line);font-size:12px">
        <span>Masuk: <b class="in">${rp(filInc)}</b></span>
        <span>Keluar: <b class="out">${rp(filExp)}</b></span>
        <button class="ghost" style="padding:2px 6px;font-size:11px" onclick="clearTxFilter()">Reset</button>
      </div>
    ` : ''}
  </div>

  ${Object.keys(groups).length ? Object.entries(groups).map(([date, items]) => {
    const dayInc = sum(items, 'income'), dayExp = sum(items, 'expense');
    const dObj = new Date(date + 'T00:00:00');
    const dayLabel = date === today() ? 'Hari Ini' : dObj.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    return `
      <div class="tx-group-card">
        <div class="tx-group-header">
          <span>${dayLabel} <span class="mute" style="font-size:10.5px;font-weight:500">· ${date}</span></span>
          <span style="display:flex;gap:8px">
            ${dayInc ? `<span class="in" style="font-weight:700">+${rp(dayInc)}</span>` : ''}
            ${dayExp ? `<span class="out" style="font-weight:700">-${rp(dayExp)}</span>` : ''}
          </span>
        </div>
        ${items.map(t => `
          <div class="tx-row">
            <div class="txitem" style="cursor:pointer;flex:1" onclick="editRow('transactions','${t.id}')">
              <div class="icon">${catIcon(t.category)}</div>
              <div>
                <b style="font-size:14px;color:var(--ink)">${esc(t.category || 'Lainnya')}</b>
                ${t.note ? `<span class="mute" style="font-weight:500"> · ${esc(t.note)}</span>` : ''}
                <div class="mute" style="font-size:11.5px;margin-top:2px">
                  <span style="font-weight:600;color:var(--ink-secondary)">${esc(accName(t.account_id))}</span>
                </div>
              </div>
            </div>
            <div style="text-align:right">
              <b class="${t.type === 'income' ? 'in' : 'out'}" style="font-size:15px;letter-spacing:-0.01em;cursor:pointer" onclick="editRow('transactions','${t.id}')">${t.type === 'income' ? '+' : '-'}${rp(t.amount)}</b>
              <div style="margin-top:2px">
                <button class="ghost danger" style="padding:2px 6px;font-size:10.5px" onclick="event.stopPropagation();del('transactions','${t.id}')">Hapus</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('') : '<div class="card mute" style="text-align:center;padding:32px">Tidak ada transaksi ditemukan.</div>'}

  ${S.rec.length ? `
    <h2>
      <span>Transaksi Rutin Terjadwal</span>
      <span class="mute" style="font-weight:500;cursor:pointer" onclick="goAdd('recurring')">+ Tambah</span>
    </h2>
    ${S.rec.map(r => `
      <div class="card row" style="cursor:pointer" onclick="editRow('recurring','${r.id}')">
        <div>
          <b>${esc(r.name)}</b> <span class="mute">· Jatuh tempo tgl ${r.day_of_month}</span>
          <div class="mute">${esc(accName(r.account_id))}${r.category ? ' · ' + esc(r.category) : ''}</div>
        </div>
        <div style="text-align:right">
          <b class="${r.type === 'income' ? 'in' : 'out'}">${r.type === 'income' ? '+' : '-'}${rp(r.amount)}</b>
        </div>
      </div>
    `).join('')}
  ` : ''}`;
}

// ====== VIEW: REKENING & DOMPET DIGITAL ======
function accs() {
  return `<h1>Rekening & Dompet</h1>
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <button style="flex:1" onclick="goAdd('accs')">+ Tambah Rekening</button>
    <button class="outline" style="flex:1" onclick="openTransfer()">🔁 Transfer Saldo</button>
  </div>

  ${S.acc.map(a => `
    <div class="acc-card">
      <div class="row">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:12px;background:var(--main-light);color:var(--main);display:flex;align-items:center;justify-content:center;font-size:20px">
            ${a.name.toLowerCase().includes('tunai') || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('dompet') ? '💵' : '🏦'}
          </div>
          <div>
            <b style="font-size:16px;color:var(--ink);display:block">${esc(a.name)}</b>
            <span class="mute" style="font-size:11.5px">Rekening Aktif</span>
          </div>
        </div>
        <div class="acc-card-chip" title="Rekening Utama"></div>
      </div>
      
      <div style="margin-top:16px">
        <div class="mute" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Saldo Tersedia</div>
        <div class="big" style="font-size:26px;margin-top:2px;letter-spacing:-0.02em">${rp(accBal(a))}</div>
      </div>

      <div class="row" style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line)">
        <button class="outline" style="font-size:12px;padding:6px 14px;border-radius:999px" onclick="filterByAcc('${a.id}')">
          📜 Lihat Mutasi
        </button>
        <div style="display:flex;gap:4px">
          <button class="ghost" style="padding:6px 10px;font-size:12px" onclick="editRow('accounts','${a.id}')">Edit</button>
          <button class="ghost danger" style="padding:6px 10px;font-size:12px" onclick="del('accounts','${a.id}')">Hapus</button>
        </div>
      </div>
    </div>
  `).join('') || '<div class="card mute" style="text-align:center;padding:32px">Belum ada rekening. Tekan tombol di atas untuk membuat rekening baru.</div>'}`;
}

function filterByAcc(accId) {
  const acc = S.acc.find(a => a.id === accId);
  if (acc) {
    txFilter = { q: acc.name, cat: '', from: '', to: '' };
    S.tab = 'trx';
    render();
  }
}

// ====== VIEW: CICILAN (INSTALLMENTS) ======
let instFilter = 'active'; // 'active' | 'done'
function setInstFilter(f) { instFilter = f; render(); }

function inst() {
  const activeList = S.inst.filter(i => i.paid_months < i.total_months);
  const doneList = S.inst.filter(i => i.paid_months >= i.total_months);
  const currentList = instFilter === 'active' ? activeList : doneList;

  const totRemaining = activeList.reduce((s, i) => s + (i.total_months - i.paid_months) * i.monthly_amount, 0);
  const totMonthly = activeList.reduce((s, i) => s + +i.monthly_amount, 0);

  const listHtml = currentList.map(i => {
    const left = i.total_months - i.paid_months, pct = Math.min(100, i.paid_months / i.total_months * 100);
    // Estimasi tgl lunas
    const estDate = new Date();
    estDate.setMonth(estDate.getMonth() + left);
    const estLabel = estDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    return `<div class="card">
      <div class="row" style="cursor:pointer" onclick="editRow('installments','${i.id}')">
        <div>
          <b style="font-size:15.5px">${esc(i.name)}</b>
          <div class="mute">${esc(accName(i.account_id))}</div>
        </div>
        <div style="text-align:right">
          <b class="out" style="font-size:15.5px">${rp(i.monthly_amount)}</b>
          <div class="mute" style="font-size:11px">/bulan</div>
        </div>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="row mute" style="font-size:12px">
        <span>${i.paid_months} / ${i.total_months} bulan (${Math.round(pct)}%)</span>
        <b style="color:var(--ink)">${left > 0 ? left + ' bulan lagi' : '🎉 LUNAS'}</b>
      </div>
      <div class="row mute" style="margin-top:6px;font-size:11.5px">
        <span>Sisa: <b>${rp(left * i.monthly_amount)}</b></span>
        ${left > 0 ? `<span>Est. Lunas: <b>${estLabel}</b></span>` : ''}
      </div>
      <div class="row" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
        ${left > 0 ? `<button onclick="pay('${i.id}')">Bayar Bulan Ini</button>` : '<span></span>'}
        <div>
          <button class="ghost" onclick="editRow('installments','${i.id}')">Edit</button>
          <button class="ghost danger" onclick="del('installments','${i.id}')">Hapus</button>
        </div>
      </div>
    </div>`;
  }).join('') || `<div class="card mute" style="text-align:center;padding:24px">Tidak ada cicilan ${instFilter === 'active' ? 'aktif' : 'yang sudah lunas'}.</div>`;

  return `<h1>Cicilan & Pinjaman</h1>
  <div class="card" style="border-left:4px solid var(--out)">
    <div class="row">
      <div>
        <div class="mute">Total Beban Sisa Cicilan</div>
        <div class="big out" style="font-size:24px;margin-top:2px">${rp(totRemaining)}</div>
      </div>
      <div style="text-align:right">
        <div class="mute">Beban Tiap Bulan</div>
        <b style="font-size:16px">${rp(totMonthly)}</b>
      </div>
    </div>
  </div>

  <div class="segTabs" style="margin-bottom:12px">
    <button class="${instFilter === 'active' ? 'on' : ''}" onclick="setInstFilter('active')">Cicilan Berjalan (${activeList.length})</button>
    <button class="${instFilter === 'done' ? 'on' : ''}" onclick="setInstFilter('done')">Sudah Lunas (${doneList.length})</button>
  </div>

  ${listHtml}`;
}

// ====== VIEW: TABUNGAN & IMPIAN ======
function sav() {
  const list = S.sav.map(x => {
    const b = savBal(x), pct = x.target ? Math.max(0, Math.min(100, b / x.target * 100)) : 0;
    const remaining = x.target ? Math.max(0, x.target - b) : 0;

    return `<div class="card">
      <div class="row">
        <div>
          <span class="badge" style="background:var(--main-light);color:var(--main);font-size:10px;padding:2px 6px;border-radius:4px">Target Impian</span>
          <b style="font-size:16px;display:block;margin-top:2px;cursor:pointer" onclick="editRow('savings','${x.id}')">${esc(x.name)}</b>
        </div>
        <div>
          <button class="ghost" onclick="editRow('savings','${x.id}')">Edit</button>
          <button class="ghost danger" onclick="del('savings','${x.id}')">Hapus</button>
        </div>
      </div>
      <div class="big" style="font-size:24px;margin:6px 0 2px">${rp(b)}</div>
      ${x.target ? `
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="row mute" style="font-size:12px">
          <span>Target: <b>${rp(x.target)}</b></span>
          <b>${Math.round(pct)}%</b>
        </div>
        ${remaining > 0 ? `<div class="mute" style="font-size:11.5px;margin-top:4px">Kurang <b>${rp(remaining)}</b> lagi</div>` : '<div class="in" style="font-size:12px;font-weight:700;margin-top:4px">🎉 Target Tabungan Tercapai!</div>'}
      ` : ''}

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <div class="row" style="gap:8px">
          <button style="flex:1" onclick="openSavModal('${x.id}','deposit')">+ Setor Dana</button>
          ${S.acc.length ? `<button class="outline" style="flex:1" onclick="openSavModal('${x.id}','withdraw')">- Tarik Saldo</button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('') || '<div class="card mute" style="text-align:center;padding:24px">Belum ada pos tabungan. Buat target tabungan pertama Anda.</div>';

  return `<h1>Pos Tabungan</h1>
  <div class="card" style="border-left:4px solid var(--main)">
    <div class="row">
      <div>
        <div class="mute">Total Akumulasi Semua Tabungan</div>
        <div class="big" style="font-size:24px;margin-top:2px">${rp(savTotal())}</div>
      </div>
      <button onclick="goAdd('sav')">+ Tabungan</button>
    </div>
  </div>
  ${list}`;
}

// Modal Setor / Tarik Tabungan Cepat
function openSavModal(savId, action) {
  const x = S.sav.find(s => s.id === savId);
  if (!x) return;
  const isDeposit = action === 'deposit';
  const html = `
    <div class="sheet-bg" id="savModal" onclick="if(event.target===this)this.remove()">
      <div class="sheet">
        <div class="sheet-handle"></div>
        <h3>${isDeposit ? '💰 Setor Tabungan: ' : '🏧 Tarik Saldo: '} ${esc(x.name)}</h3>
        <div class="mute" style="margin-bottom:8px">Saldo saat ini: <b>${rp(savBal(x))}</b></div>
        <input id="modal_sav_amt" type="text" inputmode="numeric" placeholder="Nominal (${CUR})" oninput="formatInputCurrency(this)">
        ${!isDeposit && S.acc.length ? `
          <div class="mute" style="margin:8px 0 4px">Kirimkan ke rekening:</div>
          <select id="modal_sav_acc">${accOpts()}</select>
        ` : ''}
        <button style="width:100%;margin-top:10px" onclick="execSavMove('${savId}','${action}')">${isDeposit ? 'Konfirmasi Setor' : 'Konfirmasi Tarik'}</button>
        <button class="ghost" style="width:100%;margin-top:6px" onclick="$('savModal').remove()">Batal</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(() => {
    const el = $('modal_sav_amt');
    if (el) { el.focus(); formatInputCurrency(el); }
  }, 50);
}

async function execSavMove(savId, action) {
  const amt = inIDR('modal_sav_amt');
  if (!(amt > 0)) return alert('Isi nominal dengan benar.');
  const x = S.sav.find(s => s.id === savId);
  if (action === 'withdraw') {
    if (amt > savBal(x)) return alert('Saldo tabungan tidak mencukupi.');
  }
  const accId = $('modal_sav_acc') ? v('modal_sav_acc') : null;
  if (action === 'withdraw' && !accId) return alert('Pilih rekening tujuan.');

  const ok = await run(sb.from('saving_moves').insert({
    saving_id: savId,
    account_id: accId,
    type: action,
    amount: amt,
    date: today()
  }));

  if (ok) {
    const m = $('savModal');
    if (m) m.remove();
    toast('Mutasi tabungan berhasil disimpan', 'success');
    load();
  }
}

// ====== CSV IMPORT & SAMPLE DOWNLOAD ======
function downloadSampleCsv() {
  const csvContent = "data:text/csv;charset=utf-8," + "Tanggal,Rekening,Tipe,Kategori,Catatan,Jumlah\n2026-11-01,BCA,expense,Makan,Makan Siang Resto,45000\n2026-11-02,BCA,income,Gaji,Gaji Bulanan,7500000\n2026-11-03,Dompet,expense,Transport,Bensin Motor,25000";
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "template-mutasi-duitku.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  const splitLine = line => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ',' || c === ';') { out.push(cur); cur = ''; } else cur += c; }
    }
    out.push(cur); return out.map(s => s.trim());
  };
  const header = splitLine(lines[0]).map(h => h.toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) { const cells = splitLine(lines[i]); const obj = {}; header.forEach((h, idx) => obj[h] = cells[idx] ?? ''); rows.push(obj); }
  return rows;
}

async function importCsv(file) {
  if (!file) return;
  const box = $('impStatus');
  box.innerHTML = '<div class="mute" style="margin-top:8px">⏳ Membaca dan menganalisis mutasi CSV...</div>';
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    const col = (o, names) => { for (const n of names) if (o[n] !== undefined && o[n] !== '') return o[n]; return ''; };
    const accCache = {}; S.acc.forEach(a => accCache[a.name.toLowerCase()] = a.id);
    const toInsert = []; let skipped = 0;

    for (const r of rows) {
      let dateRaw = col(r, ['tanggal', 'date']), date = dateRaw;
      const dm = dateRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dm) { let [, d, mo, y] = dm; if (y.length === 2) y = '20' + y; date = y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0'); }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }

      const accNameRaw = col(r, ['rekening', 'account']) || S.acc[0]?.name || '';
      let accId = accCache[accNameRaw.toLowerCase()];
      if (!accId && accNameRaw) {
        const { data, error } = await sb.from('accounts').insert({ name: accNameRaw, balance: 0 }).select().single();
        if (!error && data) { accId = data.id; accCache[accNameRaw.toLowerCase()] = accId; S.acc.push(data); }
      }
      if (!accId) { skipped++; continue; }

      let type = col(r, ['tipe', 'type']).toLowerCase();
      const incAmt = parseAmt(col(r, ['pemasukan', 'income'])), expAmt = parseAmt(col(r, ['pengeluaran', 'expense']));
      let amount = 0;
      if (incAmt > 0) { amount = incAmt; type = 'income'; }
      else if (expAmt > 0) { amount = expAmt; type = 'expense'; }
      else { amount = parseAmt(col(r, ['jumlah', 'amount'])); type = /masuk|income|in\b/i.test(type) ? 'income' : 'expense'; }

      if (!(amount > 0)) { skipped++; continue; }
      toInsert.push({ account_id: accId, type, amount, category: col(r, ['kategori', 'category']) || null, note: col(r, ['catatan', 'note']) || null, date });
    }

    if (toInsert.length) await run(sb.from('transactions').insert(toInsert));
    box.innerHTML = '';
    toast(`✅ Berhasil impor ${toInsert.length} transaksi${skipped ? ` (${skipped} dilewati)` : ''}`, 'success');
    load();
  } catch (e) {
    box.innerHTML = '<div class="mute" style="margin-top:8px;color:var(--out)">⚠️ Format file CSV tidak didukung atau terjadi kesalahan pembacaan.</div>';
  }
}

// ====== EXCEL EXPORT ======
// ====== CETAK / SIMPAN LAPORAN PDF BULANAN ======
function printMonthlyReport(m) {
  m = m || S.month;
  const cur = S.tx.filter(t => t.date.startsWith(m));
  const inc = sum(cur, 'income'), exp = sum(cur, 'expense'), net = inc - exp;
  const label = new Date(m + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast('Pop-up terblokir. Izinkan pop-up di browser untuk mencetak PDF.', 'warn');
    return;
  }
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Laporan Keuangan Duitku - ${label}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 36px; color: #0f172a; max-width: 820px; margin: 0 auto; line-height: 1.4; }
    h1 { margin: 0 0 4px; font-size: 22px; color: #1e3a8a; }
    .meta { color: #64748b; font-size: 12.5px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .box { padding: 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
    .box .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .box .val { font-size: 18px; font-weight: 700; }
    .val.in { color: #059669; } .val.out { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12.5px; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #fafafa; }
    .text-right { text-align: right; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Laporan Keuangan Duitku</h1>
      <div class="meta">Periode: <b>${label}</b> · Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 16px;border-radius:6px;background:#2563eb;color:#fff;border:0;cursor:pointer;font-weight:600">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="grid">
    <div class="box"><div class="lbl">Total Pemasukan</div><div class="val in">${rp(inc)}</div></div>
    <div class="box"><div class="lbl">Total Pengeluaran</div><div class="val out">${rp(exp)}</div></div>
    <div class="box"><div class="lbl">Arus Kas Bersih (Net)</div><div class="val" style="color:${net >= 0 ? '#059669' : '#dc2626'}">${rp(net)}</div></div>
  </div>

  <h4 style="margin:20px 0 6px">Rincian Saldo Rekening Saat Ini</h4>
  <table>
    <thead><tr><th>Nama Rekening</th><th class="text-right">Saldo</th></tr></thead>
    <tbody>
      ${S.acc.map(a => `<tr><td>${esc(a.name)}</td><td class="text-right"><b>${rp(accBal(a))}</b></td></tr>`).join('')}
    </tbody>
  </table>

  <h4 style="margin:24px 0 6px">Daftar Transaksi Periode Ini (${cur.length} Transaksi)</h4>
  <table>
    <thead><tr><th>Tanggal</th><th>Rekening</th><th>Kategori & Catatan</th><th class="text-right">Nominal</th></tr></thead>
    <tbody>
      ${cur.length ? cur.map(t => `
        <tr>
          <td>${t.date}</td>
          <td>${esc(accName(t.account_id))}</td>
          <td><b>${esc(t.category || '-')}</b>${t.note ? ' <span style="color:#64748b">(' + esc(t.note) + ')</span>' : ''}</td>
          <td class="text-right" style="color:${t.type === 'income' ? '#059669' : '#dc2626'};font-weight:600">
            ${t.type === 'income' ? '+ ' : '- '}${rp(t.amount)}
          </td>
        </tr>
      `).join('') : '<tr><td colspan="4" style="text-align:center;color:#64748b">Tidak ada transaksi pada bulan ini.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`);
  printWindow.document.close();
}

async function exportXlsx() {
  try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', 'ExcelJS'); } 
  catch (e) { return alert('Gagal memuat library Excel. Periksa koneksi internet Anda.'); }
  
  toast('Sedang memformat laporan Excel...', 'info');
  const m = v('x_m'), cur = RATES[CUR] ? CUR : 'IDR', cv = n => +(n * RATES[cur]).toFixed(2);
  const fmt = cur === 'IDR' || cur === 'JPY' ? '#,##0' : '#,##0.00';
  const tx = S.tx.filter(t => !m || t.date.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date));
  const inc = sum(tx, 'income'), exp = sum(tx, 'expense');
  const periode = m ? new Date(m + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : 'Semua Periode';
  
  const wb = new ExcelJS.Workbook();
  const GREEN = 'FF059669', RED = 'FFE11D48', BLUE = 'FF2563EB', DARK = 'FF0F172A', LIGHT = 'FFF8FAFC', WHITE = 'FFFFFFFF';
  const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
  const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
  const box = { top: thin, bottom: thin, left: thin, right: thin };

  const r = wb.addWorksheet('Laporan Keuangan');
  r.columns = [{ width: 14 }, { width: 22 }, { width: 14 }, { width: 34 }, { width: 18 }, { width: 18 }];
  r.mergeCells('A1:F1'); r.getCell('A1').value = 'LAPORAN ARUS KAS DUITKU'; r.getCell('A1').font = { bold: true, size: 16, color: { argb: DARK } }; r.getCell('A1').alignment = { horizontal: 'center' };
  r.mergeCells('A2:F2'); r.getCell('A2').value = 'Periode: ' + periode + '  |  Mata Uang: ' + cur; r.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } }; r.getCell('A2').alignment = { horizontal: 'center' };
  r.getRow(1).height = 24;

  const boxRow = 4;
  [['PEMASUKAN', inc, GREEN, 'A'], ['PENGELUARAN', exp, RED, 'C'], ['NETTO SURPLUS', inc - exp, BLUE, 'E']].forEach(([label, val, color, col]) => {
    const c1 = col + boxRow, c2 = String.fromCharCode(col.charCodeAt(0) + 1) + boxRow;
    r.mergeCells(c1 + ':' + c2); const cell = r.getCell(c1);
    cell.value = { richText: [{ font: { bold: true, size: 9, color: { argb: WHITE } }, text: label + '\n' }, { font: { bold: true, size: 14, color: { argb: WHITE } }, text: cur + ' ' + val.toLocaleString('id-ID', { maximumFractionDigits: 2 }) }] };
    cell.fill = fill(color); cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    r.getRow(boxRow).height = 38;
  });

  const head = boxRow + 2;
  ['Tanggal', 'Rekening', 'Arus', 'Kategori / Keterangan', 'Pemasukan', 'Pengeluaran'].forEach((h, i) => {
    const cell = r.getCell(head, i + 1); cell.value = h; cell.font = { bold: true, color: { argb: WHITE } }; cell.fill = fill(DARK); cell.alignment = { horizontal: 'center' }; cell.border = box;
  });

  tx.forEach((t, i) => {
    const row = head + 1 + i, isInc = t.type === 'income';
    const vals = [t.date, accName(t.account_id), isInc ? 'Masuk' : 'Keluar', (t.category || 'Lainnya') + (t.note ? ' — ' + t.note : ''), isInc ? cv(t.amount) : null, !isInc ? cv(t.amount) : null];
    vals.forEach((val, ci) => {
      const cell = r.getCell(row, ci + 1); cell.value = val; cell.border = box;
      if (ci >= 4 && val !== null) { cell.numFmt = fmt; cell.font = { color: { argb: isInc ? GREEN : RED }, bold: true }; }
      if (i % 2 === 1) cell.fill = fill(LIGHT);
    });
  });

  const totalRow = head + 1 + tx.length;
  r.mergeCells('A' + totalRow + ':D' + totalRow); r.getCell('A' + totalRow).value = 'TOTAL KESELURUHAN'; r.getCell('A' + totalRow).font = { bold: true };
  r.getCell('E' + totalRow).value = cv(inc); r.getCell('F' + totalRow).value = cv(exp);
  ['A', 'E', 'F'].forEach(c => { const cell = r.getCell(c + totalRow); cell.border = box; cell.font = { bold: true }; cell.fill = fill(LIGHT); if (c !== 'A') cell.numFmt = fmt; });
  
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = 'duitku-' + (m || 'semua') + '.xlsx'; a.click(); URL.revokeObjectURL(url);
}

// ====== HELPER DECIMAL & CURRENCY PARSER (ANTI SALAH 20.000,00 JADI 2 JUTA) ======
function parseReceiptAmount(rawStr) {
  if (!rawStr) return 0;
  let s = String(rawStr).trim();
  s = s.replace(/^[rR][pP]\.?\s*/g, '');
  s = s.replace(/\s*,-$/g, '');
  
  // Kasus desimal 2 digit di ujung: cth ",00" atau ".00" atau ",50"
  const mDec2 = s.match(/[,.](\d{2})$/);
  if (mDec2) {
    const cents = mDec2[1];
    const mainPart = s.slice(0, -3).replace(/[.,]/g, '');
    if (cents === '00') {
      return parseFloat(mainPart) || 0;
    } else {
      return parseFloat(mainPart + '.' + cents) || 0;
    }
  }

  // Kasus desimal 1 digit di ujung: cth ",0" atau ".0"
  const mDec1 = s.match(/[,.](\d{1})$/);
  if (mDec1) {
    const cents = mDec1[1];
    const mainPart = s.slice(0, -2).replace(/[.,]/g, '');
    return parseFloat(mainPart + '.' + cents) || 0;
  }

  // Format ribuan biasa (cth: 20.000 atau 20,000 atau 20000)
  const cleaned = s.replace(/[.,]/g, '');
  return parseFloat(cleaned) || 0;
}

// Convert File to Base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ====== PRE-PROCESSING GAMBAR STRUK VIA HTML5 CANVAS (UNTUK LOCAL OCR) ======
async function preprocessReceiptImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width, height = img.height;
        const maxDim = 1400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          let totalLuma = 0;
          for (let i = 0; i < d.length; i += 4) {
            totalLuma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          }
          const avgLuma = totalLuma / (d.length / 4);
          const threshold = Math.min(210, Math.max(90, avgLuma * 0.90));

          for (let i = 0; i < d.length; i += 4) {
            const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = luma < threshold ? 0 : 255;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch(err) {
          resolve(file);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ====== DUAL ENGINE OCR SCANNER (AI GEMINI VISION + HIGH-ACCURACY LOCAL) ======
async function scanReceipt(file, p) {
  p = p || 't_';
  if (!file) return;
  const box = $('scanStatus');

  // ENGINE 1: GOOGLE GEMINI AI VISION (JIKA API KEY TERSEDIA)
  if (GEMINI_API_KEY) {
    box.innerHTML = '<div class="mute" style="margin:8px 0">✨ Mengirim gambar ke Google Gemini AI Vision...</div>';
    try {
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';
      const cleanBase64 = base64Data.split(',')[1];

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const prompt = `Analisis struk belanja Indonesia ini secara teliti.
Ekstrak data berikut dalam format JSON murni:
{
  "total": <angka total akhir yang harus dibayar, berupa integer tanpa sen jika ,00, contoh 20000>,
  "date": <tanggal transaksi format YYYY-MM-DD, atau kosong jika tidak ada>,
  "merchant": <nama toko atau restoran>,
  "category": <pilih salah satu kategori: Makan, Transport, Belanja, Kesehatan, Tagihan, Hiburan, Lainnya>
}
PENTING:
- Bedakan antara TOTAL AKHIR / TOTAL BELANJA dengan TUNAI/CASH (uang yang dibayarkan pembeli) dan KEMBALIAN/CHANGE. Ambil TOTAL AKHIR belanja.
- Hati-hati dengan format desimal: jika tertulis "20.000,00" atau "20000,00" maka totalnya adalah 20000 (bukan 2 juta!).
Hanya kembalikan JSON murni tanpa markdown triple backticks.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: cleanBase64 } }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      const rawAnswer = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJson = rawAnswer.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      const totalVal = Math.round(Number(parsed.total) || 0);
      const merchantVal = (parsed.merchant || '').trim();
      const dateVal = (parsed.date || '').trim();
      const catVal = (parsed.category || '').trim();

      if (totalVal > 0) {
        const amtEl = $(p + 'amt');
        amtEl.value = String(totalVal);
        amtEl.dispatchEvent(new Event('input'));
      }
      if (merchantVal) $(p + 'note').value = merchantVal.slice(0, 50);
      if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) $(p + 'date').value = dateVal;
      if (catVal) $(p + 'cat').value = catVal;

      box.innerHTML = `<div class="mute" style="margin:6px 0;color:var(--in)">
        ✨ <b>Dianalisis Sempurna oleh Gemini AI!</b><br>
        Total: <b>${rp(totalVal)}</b> ${catVal ? `· Kategori: <b>${catVal}</b>` : ''} ${merchantVal ? `· Toko: <b>${esc(merchantVal)}</b>` : ''}
      </div>`;
      return;
    } catch(aiErr) {
      console.warn('Gemini AI Vision gagal, beralih ke local OCR:', aiErr);
      box.innerHTML = `<div class="mute" style="margin:6px 0;color:var(--warn)">⚠️ AI API gagal (${aiErr.message}), beralih ke scanner lokal...</div>`;
    }
  }

  // ENGINE 2: LOCAL HIGH-ACCURACY OCR DENGAN PERBAIKAN DESIMAL (ANTI-SALAH 20.000,00 JADI 2 JUTA)
  box.innerHTML = '<div class="mute" style="margin:8px 0">⏳ Mempersiapkan scanner struk lokal...</div>';
  try { 
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.0.4/tesseract.min.js', 'Tesseract'); 
  } catch (e) { 
    box.innerHTML = '<div class="mute" style="margin:8px 0;color:var(--out)">⚠️ Gagal memuat library scanner OCR. Periksa koneksi internet Anda.</div>'; 
    return; 
  }

  try {
    const processedImg = await preprocessReceiptImage(file);
    const { data } = await Tesseract.recognize(processedImg, 'ind+eng', {
      logger: m => {
        if (m.status === 'recognizing text' && m.progress !== undefined) {
          box.innerHTML = `<div class="mute" style="margin:8px 0">🔍 Memindai teks struk... <b>${Math.round(m.progress * 100)}%</b></div>`;
        }
      }
    });

    const rawText = data.text || '';
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

    // Helper ekstrak nominal dengan fungsi parseReceiptAmount anti-salah desimal
    const extractNums = (str) => {
      const matches = str.match(/(\d[\d.,]{2,})/g) || [];
      const res = [];
      for (const m of matches) {
        const val = parseReceiptAmount(m);
        if (val >= 100 && val <= 100000000) {
          res.push(val);
        }
      }
      return res;
    };

    let bestTotal = 0;

    // Prioritas 1: Baris Grand Total / Total Akhir / Total Belanja / Tagihan
    for (const l of lines) {
      const low = l.toLowerCase();
      if (/(grand\s*total|total\s*akhir|total\s*belanja|total\s*bayar|total\s*tagihan|tagihan|amount\s*due|total\s*harga|harga\s*total)/i.test(low)) {
        const nums = extractNums(l);
        if (nums.length) {
          bestTotal = nums[nums.length - 1];
          break;
        }
      }
    }

    // Prioritas 2: Baris TOTAL murni
    if (!bestTotal) {
      for (const l of lines) {
        const low = l.toLowerCase();
        if (/\btotal\b/i.test(low) && !/(subtotal|kembali|change|kembalian|tunai|cash|bayar)/i.test(low)) {
          const nums = extractNums(l);
          if (nums.length) {
            bestTotal = nums[nums.length - 1];
            break;
          }
        }
      }
    }

    // Prioritas 3: Baris Subtotal
    if (!bestTotal) {
      for (const l of lines) {
        const low = l.toLowerCase();
        if (/subtotal|sub\s*total/i.test(low)) {
          const nums = extractNums(l);
          if (nums.length) {
            bestTotal = nums[nums.length - 1];
            break;
          }
        }
      }
    }

    // Prioritas 4: Fallback
    if (!bestTotal) {
      const candidates = [];
      for (const l of lines) {
        const low = l.toLowerCase();
        if (!/(kembali|change|kembalian|tunai|cash|debit|kartu|card|saldo|telp|pajak|ppn)/i.test(low)) {
          const nums = extractNums(l);
          candidates.push(...nums);
        }
      }
      if (candidates.length) {
        bestTotal = Math.max(...candidates);
      }
    }

    // Deteksi Tanggal Struk
    let dateVal = '';
    const dateMatch = rawText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dateMatch) {
      let [, d, mo, y] = dateMatch;
      if (y.length === 2) y = '20' + y;
      if (+d <= 31 && +mo <= 12) {
        dateVal = y + '-' + mo.padStart(2, '0') + '-' + d.padStart(2, '0');
      }
    }

    // Deteksi Toko / Merchant
    let merchant = '';
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const lineCandidate = lines[i].replace(/[^\w\s\.-]/g, '').trim();
      if (lineCandidate.length >= 3 && !/^\d/.test(lineCandidate) && !/(struk|receipt|selamat|nota|bukti|pembayaran)/i.test(lineCandidate)) {
        merchant = lineCandidate;
        break;
      }
    }

    // Deteksi Kategori
    let detectedCat = '';
    const lowerText = rawText.toLowerCase();
    if (/indomaret|alfamart|alfamidi|superindo|hypermart|transmart|lotte|circle\s*k|familymart|lawson|miniso|uniqlo|guardian|watsons?|century/i.test(lowerText)) {
      detectedCat = 'Belanja';
    } else if (/kfc|mcd|mcdonald|burger\s*king|hokben|starbucks|janji\s*jiwa|kopi\s*kenangan|chatime|mixue|fore|solaria|dapur\s*solo|mie\s*gacoan|pizza\s*hut|domino|richeese|bakso|soto|warung|resto|cafe|coffee|dapur|bakery|roti/i.test(lowerText)) {
      detectedCat = 'Makan';
    } else if (/spbu|pertamina|shell|bp\b|parkir|parking|toll|jasamarga|jasa\s*marga|bensin|pertalite|pertamax|solar|grab|gojek|maxim/i.test(lowerText)) {
      detectedCat = 'Transport';
    } else if (/apotek|kimia\s*farma|k-?24|klinik|rumah\s*sakit|hospital|dokter|optik|prodia|laboratorium/i.test(lowerText)) {
      detectedCat = 'Kesehatan';
    } else if (/pln|listrik|pdam|indihome|biznet|telkom|bpjs|pulsa|token/i.test(lowerText)) {
      detectedCat = 'Tagihan';
    } else if (/cinema\s*21|xxi|cgv|cinepolis|timezone|steam|netflix|spotify/i.test(lowerText)) {
      detectedCat = 'Hiburan';
    }

    if (bestTotal) {
      const amtEl = $(p + 'amt');
      amtEl.value = String(Math.round(bestTotal));
      amtEl.dispatchEvent(new Event('input'));
    }
    if (merchant) $(p + 'note').value = merchant.slice(0, 50);
    if (dateVal) $(p + 'date').value = dateVal;
    if (detectedCat) $(p + 'cat').value = detectedCat;

    box.innerHTML = (bestTotal ? 
      `<div class="mute" style="margin:6px 0;color:var(--in)">
        ✓ <b>Terdeteksi (OCR Lokal)!</b><br>
        Nominal: <b>${rp(bestTotal)}</b> ${detectedCat ? `· Kategori: <b>${detectedCat}</b>` : ''} ${merchant ? `· Toko: <b>${esc(merchant)}</b>` : ''}
        <div style="font-size:11px;color:var(--mute);margin-top:2px">💡 Tips: Aktifkan API Key Gemini (gratis) untuk akurasi 100% tanpa salah baca.</div>
      </div>` : 
      `<div class="mute" style="margin:6px 0;color:var(--warn)">
        ⚠️ Angka total belum terdeteksi otomatis, silakan ketik manual.
      </div>`
    ) + `<details style="margin-top:6px">
      <summary class="mute" style="cursor:pointer;font-size:11.5px">Lihat hasil teks OCR mentah</summary>
      <div style="max-height:100px;overflow-y:auto;background:var(--card-subtle);padding:8px;border-radius:8px;font-size:11px;white-space:pre-wrap;margin-top:4px">${esc(rawText || '(Teks kosong)')}</div>
    </details>`;

  } catch (err) {
    console.error(err);
    box.innerHTML = '<div class="mute" style="margin:6px 0;color:var(--out)">⚠️ Gagal memindai struk. Silakan isi form secara manual.</div>';
  }
}

async function addSav(p) {
  p = p || 's_';
  if (!v(p + 'name')) return alert('Isi nama tabungan.');
  const t = inIDR(p + 'tgt'); if (t === null) return;
  const payload = { name: v(p + 'name'), target: t > 0 ? t : null };
  const isEdit = editing && editing.table === 'savings';
  const q = isEdit ? sb.from('savings').update(payload).eq('id', editing.id) : sb.from('savings').insert(payload);
  if (await run(q)) { if (p[0] === 'q') { showAddSheet = false; addMode = null; editing = null; } toast('Tabungan berhasil disimpan', 'success'); load(); }
}

async function addBudget(p) {
  p = p || 'qb_';
  const cat = v(p + 'cat').trim(); if (!cat) return alert('Isi kategori pengeluaran.');
  const lim = inIDR(p + 'limit'); if (lim === null) return;
  if (!(lim > 0)) return alert('Isi batas nominal budget.');
  const payload = { category: cat, monthly_limit: lim };
  const isEdit = editing && editing.table === 'budgets';
  const q = isEdit ? sb.from('budgets').update(payload).eq('id', editing.id) : sb.from('budgets').insert(payload);
  if (await run(q)) { showAddSheet = false; addMode = null; editing = null; toast('Anggaran budget tersimpan', 'success'); load(); }
}

async function addRecurring(p) {
  p = p || 'qr_';
  const name = v(p + 'name').trim(); if (!name) return alert('Isi nama transaksi rutin.');
  const amt = inIDR(p + 'amt'); if (amt === null) return;
  const day = +v(p + 'day');
  if (!(amt > 0)) return alert('Isi nominal transaksi.');
  if (!(day >= 1 && day <= 28)) return alert('Tanggal jatuh tempo harus di antara 1 - 28.');
  const payload = { account_id: v(p + 'acc'), name, type: v(p + 'type'), amount: amt, category: v(p + 'cat') || null, day_of_month: day };
  const isEdit = editing && editing.table === 'recurring';
  const q = isEdit ? sb.from('recurring').update(payload).eq('id', editing.id) : sb.from('recurring').insert(payload);
  if (await run(q)) { showAddSheet = false; addMode = null; editing = null; toast('Transaksi rutin berhasil disimpan', 'success'); load(); }
}

async function addTransfer(evt) {
  const from = v('qf_from'), to = v('qf_to');
  if (!from || !to || from === to) return toast('Pilih dua rekening yang berbeda.', 'warn');
  const amt = inIDR('qf_amt'); 
  if (amt === null || !(amt > 0)) return toast('Isi nominal transfer yang valid.', 'warn');
  const note = v('qf_note').trim(), date = v('qf_date') || today();
  const fromAcc = S.acc.find(a => a.id === from), toAcc = S.acc.find(a => a.id === to);
  
  const targetBtn = (evt && evt.target && evt.target.tagName === 'BUTTON') ? evt.target : document.querySelector('button[onclick*="addTransfer"]');
  if (targetBtn) { targetBtn.disabled = true; targetBtn.innerText = 'Memproses transfer...'; }
  try {
    const ok1 = await run(sb.from('transactions').insert({ account_id: from, type: 'expense', amount: amt, category: 'Transfer', note: 'Ke ' + (toAcc ? toAcc.name : '') + (note ? ' - ' + note : ''), date }));
    const ok2 = ok1 && await run(sb.from('transactions').insert({ account_id: to, type: 'income', amount: amt, category: 'Transfer', note: 'Dari ' + (fromAcc ? fromAcc.name : '') + (note ? ' - ' + note : ''), date }));
    if (ok2) { 
      showAddSheet = false; 
      addMode = null; 
      toast('Transfer saldo berhasil!', 'success'); 
      load(); 
    }
  } finally {
    if (targetBtn) { targetBtn.disabled = false; targetBtn.innerText = 'Konfirmasi Transfer'; }
  }
}

async function addAcc(p) {
  p = p || 'a_';
  if (!v(p + 'name')) return alert('Isi nama rekening.');
  const bal = inIDR(p + 'bal'); if (bal === null) return;
  const payload = { name: v(p + 'name'), balance: bal };
  const isEdit = editing && editing.table === 'accounts';
  const q = isEdit ? sb.from('accounts').update(payload).eq('id', editing.id) : sb.from('accounts').insert(payload);
  if (await run(q)) { if (p[0] === 'q') { showAddSheet = false; addMode = null; editing = null; } toast('Rekening berhasil disimpan', 'success'); load(); }
}

async function addTx(p) {
  p = p || 't_';
  const amt = inIDR(p + 'amt'); if (amt === null) return;
  if (!(amt > 0)) return alert('Isi nominal transaksi.');
  const payload = { account_id: v(p + 'acc'), type: v(p + 'type'), amount: amt, category: v(p + 'cat') || null, note: v(p + 'note') || null, date: v(p + 'date') || today() };
  const isEdit = editing && editing.table === 'transactions';
  const q = isEdit ? sb.from('transactions').update(payload).eq('id', editing.id) : sb.from('transactions').insert(payload);
  if (await run(q)) { if (p[0] === 'q') { showAddSheet = false; addMode = null; editing = null; } toast('Transaksi tersimpan', 'success'); load(); }
}

async function addInst(p) {
  p = p || 'i_';
  const mo = inIDR(p + 'amt'); if (mo === null) return;
  if (!v(p + 'name') || !(mo > 0) || !(+v(p + 'tot') > 0)) return alert('Lengkapi data cicilan.');
  const payload = { account_id: v(p + 'acc'), name: v(p + 'name'), monthly_amount: mo, total_months: +v(p + 'tot'), paid_months: Math.min(+v(p + 'paid') || 0, +v(p + 'tot')) };
  const isEdit = editing && editing.table === 'installments';
  const q = isEdit ? sb.from('installments').update(payload).eq('id', editing.id) : sb.from('installments').insert(payload);
  if (await run(q)) { if (p[0] === 'q') { showAddSheet = false; addMode = null; editing = null; } toast('Cicilan berhasil disimpan', 'success'); load(); }
}

async function saveUsername() {
  const name = v('pf_uname').trim();
  if (!name) return alert('Isi username.');
  const { data, error } = await sb.auth.updateUser({ data: { username: name } });
  if (error) return alert(error.message);
  CURRENT_USER = data.user; toast('Username berhasil disimpan', 'success'); render();
}

async function changePassword() {
  const p1 = v('pf_pw1'), p2 = v('pf_pw2');
  if (p1.length < 6) return alert('Password baru minimal 6 karakter.');
  if (p1 !== p2) return alert('Konfirmasi password baru tidak cocok.');
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) return alert(error.message);
  $('pf_pw1').value = ''; $('pf_pw2').value = ''; toast('Kata sandi berhasil diperbarui', 'success');
}

async function pay(id) {
  const i = S.inst.find(x => x.id === id);
  if (!i || i.paid_months >= i.total_months) return;
  if (!confirm(`Bayar cicilan ${i.name} sebesar ${rp(i.monthly_amount)} dari ${accName(i.account_id)}?`)) return;
  const ok = await run(sb.from('transactions').insert({ account_id: i.account_id, installment_id: i.id, type: 'expense', amount: i.monthly_amount, category: 'Cicilan', note: i.name, date: today() }));
  if (ok && await run(sb.from('installments').update({ paid_months: i.paid_months + 1 }).eq('id', id))) { toast('Cicilan bulan ini berhasil dibayar', 'success'); load(); }
}

async function del(table, id) {
  if (!confirm('Hapus data ini secara permanen?')) return;
  if (await run(sb.from(table).delete().eq('id', id))) { toast('Data telah dihapus', 'success'); load(); }
}

fetchRates();
initSupabase();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}


// Bind essential actions to window for direct HTML event handlers
declare global {
  interface Window {
    S: AppState;
    sb: typeof sb;
    CURRENT_USER: any;
    render: () => void;
    toggleAddSheet: (v: boolean) => void;
    goAdd: (mode: string) => void;
    openTransfer: () => void;
    togglePrivacy: () => void;
    toggleThemeSheet: (v: boolean) => void;
    changeMonth: (delta: number) => void;
    pickMonth: (el: HTMLInputElement) => void;
    pickTheme: (theme: string) => void;
    selectTxType: (type: string, btn: HTMLElement) => void;
    pickCat: (c: string, targetId: string, chipEl?: HTMLElement) => void;
    handleSearch: (q: string) => void;
    setTxFilter: (key: string, val: string) => void;
    clearTxFilter: () => void;
    editRow: (table: string, id: string) => void;
    del: (table: string, id: string) => void;
    addTx: (p?: string) => void;
    addAcc: (p?: string) => void;
    addInst: (p?: string) => void;
    addSav: (p?: string) => void;
    addBudget: (p?: string) => void;
    addRecurring: (p?: string) => void;
    pay: (id: string) => void;
    openSavModal: (id: string, action: string) => void;
    submitSavMove: (id: string, action: string) => void;
    filterByAcc: (id: string) => void;
    uploadProfilePhoto: (file: File) => void;
    setPresetAvatar: (av: string) => void;
    removeAvatar: (id?: string) => void;
    saveUsername: () => void;
    changePassword: () => void;
    logout: () => void;
    login: () => void;
    signup: () => void;
    sendReset: () => void;
    finishRecovery: () => void;
    toggleForgot: (v: boolean) => void;
    promptGeminiKey: () => void;
    saveGeminiKey: (key: string) => void;
    scanReceipt: (file: File, p?: string) => void;
  }
}

if (typeof window !== 'undefined') {
  (window as any).S = S;
  (window as any).sb = sb;
  (window as any).render = render;
  (window as any).toggleAddSheet = toggleAddSheet;
  (window as any).goAdd = goAdd;
  (window as any).openTransfer = openTransfer;
  (window as any).togglePrivacy = () => { togglePrivacy(); render(); };
  (window as any).toggleThemeSheet = toggleThemeSheet;
  (window as any).changeMonth = changeMonth;
  (window as any).pickMonth = pickMonth;
  (window as any).pickTheme = pickTheme;
  (window as any).selectTxType = selectTxType;
  (window as any).pickCat = pickCat;
  (window as any).handleSearch = handleSearch;
  (window as any).setTxFilter = setTxFilter;
  (window as any).clearTxFilter = clearTxFilter;
  (window as any).editRow = editRow;
  (window as any).del = del;
  (window as any).addTx = addTx;
  (window as any).addAcc = addAcc;
  (window as any).addInst = addInst;
  (window as any).addSav = addSav;
  (window as any).addBudget = addBudget;
  (window as any).addRecurring = addRecurring;
  (window as any).pay = pay;
  (window as any).openSavModal = openSavModal;
  (window as any).submitSavMove = submitSavMove;
  (window as any).filterByAcc = filterByAcc;
  (window as any).uploadProfilePhoto = uploadProfilePhoto;
  (window as any).setPresetAvatar = setPresetAvatar;
  (window as any).removeAvatar = removeAvatar;
  (window as any).saveUsername = saveUsername;
  (window as any).changePassword = changePassword;
  (window as any).logout = logout;
  (window as any).login = login;
  (window as any).signup = signup;
  (window as any).sendReset = sendReset;
  (window as any).finishRecovery = finishRecovery;
  (window as any).toggleForgot = toggleForgot;
  (window as any).promptGeminiKey = promptGeminiKey;
  (window as any).saveGeminiKey = saveGeminiKey;
  (window as any).scanReceipt = scanReceipt;
}
