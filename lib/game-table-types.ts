export interface TableCardInfo {
  imageUrl: string | null;
  typeLine: string | null;
  cmc: number | null;
  oracleText: string | null;
}

/** Handed off from the Simulator (via localStorage) to the standalone /table window. */
export interface TableHandoff {
  commander: string | null;
  hand: string[];
  library: string[];
  cardData: Record<string, TableCardInfo>;
}

export const TABLE_HANDOFF_KEY = 'grimoire_table_handoff';
export const TABLE_STATE_KEY = 'grimoire_table_state';
