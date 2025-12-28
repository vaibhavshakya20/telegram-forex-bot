
export enum UserStatus {
  ACTIVE = 'active',
  EXITED = 'exited'
}

export interface TradeResult {
  tradeId: string;
  pair: string;
  result: string; // "SL", "1:1", "1:2", etc.
  points: number;
  timestamp: number;
}

export interface User {
  id: string;
  username: string;
  joinTimestamp: number;
  tradesCount: number;
  points: number;
  status: UserStatus;
  history: TradeResult[];
}

export interface AppState {
  users: User[];
  trades: TradeResult[];
  adminId: string;
}

export type ViewMode = 'admin' | 'user_simulation';
