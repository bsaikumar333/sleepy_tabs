export type TabStateLabel = 'Asleep' | 'Active' | 'Pinned' | 'Playing audio' | 'Open';

export interface TabStateInfo {
  label: TabStateLabel;
  badgeClass: string;
  isAsleep: boolean;
}

