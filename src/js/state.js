// Gemeinsamer Anwendungszustand
export const S = {
  raw: null, recs: [], students: [], issues: [], colMap: {}, missingCols: [],
  today: null, measure: 'koepfe', refill: false, excludeDup: true,
  catMap: {}, kreisOrder: [], clusters: [], sevFilter: 'all', checkFilter: null, tab: 'check'
};
export const CATS = ['Professor/in', 'LfbA', 'WiMi', 'Sonstige'];
