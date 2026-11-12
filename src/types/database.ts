export type TransactionType = 'income' | 'expense';
export type SavingMoveType = 'deposit' | 'withdraw';

export interface ProfileRow {
  id: string;
  username: string | null;
  avatar_url: string | null;
  updated_at?: string;
}

export interface AccountRow {
  id: string;
  user_id?: string;
  name: string;
  balance: number;
  created_at?: string;
}

export interface TransactionRow {
  id: string;
  user_id?: string;
  account_id: string;
  installment_id?: string | null;
  type: TransactionType;
  amount: number;
  category: string | null;
  note: string | null;
  date: string; // YYYY-MM-DD
  created_at?: string;
}

export interface InstallmentRow {
  id: string;
  user_id?: string;
  account_id: string;
  name: string;
  monthly_amount: number;
  total_months: number;
  paid_months: number;
  created_at?: string;
}

export interface SavingsRow {
  id: string;
  user_id?: string;
  name: string;
  target?: number | null;
  created_at?: string;
}

export interface SavingMoveRow {
  id: string;
  user_id?: string;
  saving_id: string;
  account_id: string;
  type: SavingMoveType;
  amount: number;
  created_at?: string;
}

export interface BudgetRow {
  id: string;
  user_id?: string;
  category: string;
  monthly_limit: number;
  created_at?: string;
}

export interface RecurringRow {
  id: string;
  user_id?: string;
  account_id: string;
  name: string;
  type: TransactionType;
  amount: number;
  category: string | null;
  day_of_month: number;
  last_run?: string | null;
  created_at?: string;
}
