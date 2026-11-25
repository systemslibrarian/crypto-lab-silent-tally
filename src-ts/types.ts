export interface Hospital {
  id: number;
  name: string;
  count: number;
  draft?: string;
  locked: boolean;
}

export interface ShareData {
  coefficients: bigint[];
  shares: bigint[];
}

export interface AppState {
  currentExhibit: number;
  hospitals: Hospital[];
  shareData: Map<number, ShareData>;
  localSums: bigint[];
  reconstructedTotal: number | null;
  coalitionSelection: Set<number>;
}

export const HOSPITALS: Hospital[] = [
  { id: 1, name: 'Geneva Medical Institute', count: 1247, locked: false },
  { id: 2, name: 'Seoul Research Center', count: 983, locked: false },
  { id: 3, name: 'Johns Hopkins Clinical Division', count: 2104, locked: false },
  { id: 4, name: 'Lagos University Hospital', count: 761, locked: false },
  { id: 5, name: 'São Paulo Clinical Center', count: 1589, locked: false },
];

export const THRESHOLD = 3;
export const N_PARTIES = 5;
export const P = (1n << 61n) - 1n;
