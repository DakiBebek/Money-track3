import type {
  AccountRow,
  TransactionRow,
  InstallmentRow,
  SavingsRow,
  SavingMoveRow,
  BudgetRow,
  RecurringRow,
  ProfileRow
} from './database';

export type AppTab = 'home' | 'trx' | 'accs' | 'inst' | 'sav';

export interface AppState {
  tab: AppTab;
  month: string; // YYYY-MM
  acc: AccountRow[];
  tx: TransactionRow[];
  inst: InstallmentRow[];
  sav: SavingsRow[];
  mv: SavingMoveRow[];
  bud: BudgetRow[];
  rec: RecurringRow[];
}

export interface TxFilter {
  q: string;
  cat: string;
  from: string;
  to: string;
}

export interface EditingState {
  table: 'accounts' | 'transactions' | 'installments' | 'savings' | 'budgets' | 'recurring';
  id: string;
}

export interface ThemeConfig {
  label: string;
  swatch: string;
  vars: Record<string, string>;
}

export interface UserMetadata {
  username?: string;
  avatar_url?: string;
}

export interface UserSession {
  id: string;
  email?: string;
  user_metadata?: UserMetadata;
}

export interface GeminiOcrResult {
  total: number;
  date?: string;
  merchant?: string;
  category?: string;
}
