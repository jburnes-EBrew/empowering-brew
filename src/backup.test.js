import { describe, expect, it } from 'vitest';
import { cloneInitialState } from './data';
import { backupDue, fullBackupText, lastScheduledTime, parseFullBackup, salesCsvRows, toCsv } from './backup';

const at = (iso) => new Date(iso);
const withSales = (times, settings = {}) => {
  const state = cloneInitialState();
  state.settings = { ...state.settings, backupTime: '15:00', ...settings };
  state.sales = times.map((soldAt, index) => ({ id: `s${index}`, soldAt: new Date(soldAt).toISOString(), productName: 'Black Panther Mocha', temperature: 'iced', price: 3.5, estimateStatus: 'not-configured' }));
  return state;
};

describe('daily backup reminder', () => {
  it('uses today after the backup time and yesterday before it', () => {
    expect(lastScheduledTime('15:00', at('2026-10-27T16:00:00')).getDate()).toBe(27);
    expect(lastScheduledTime('15:00', at('2026-10-27T09:00:00')).getDate()).toBe(26);
  });

  it('is not due before 3 PM on the first day', () => {
    expect(backupDue(withSales(['2026-10-27T10:00:00']), at('2026-10-27T14:59:00'))).toBe(false);
  });

  it('is due at 3 PM when there are sales not yet backed up', () => {
    expect(backupDue(withSales(['2026-10-27T10:00:00']), at('2026-10-27T15:00:00'))).toBe(true);
  });

  it('stays quiet after a backup until new sales arrive past the next 3 PM', () => {
    const state = withSales(['2026-10-27T10:00:00'], { lastSalesBackupAt: at('2026-10-27T15:05:00').toISOString() });
    expect(backupDue(state, at('2026-10-27T17:00:00'))).toBe(false);
    expect(backupDue(state, at('2026-10-28T16:00:00'))).toBe(false);
    state.sales.push({ id: 'new', soldAt: at('2026-10-28T09:00:00').toISOString() });
    expect(backupDue(state, at('2026-10-28T14:00:00'))).toBe(false);
    expect(backupDue(state, at('2026-10-28T15:00:00'))).toBe(true);
  });

  it('keeps reminding after a missed day', () => {
    const state = withSales(['2026-10-27T10:00:00']);
    expect(backupDue(state, at('2026-10-28T08:00:00'))).toBe(true);
  });

  it('can be turned off', () => {
    expect(backupDue(withSales(['2026-10-27T10:00:00'], { backupTime: '' }), at('2026-10-27T16:00:00'))).toBe(false);
  });
});

describe('backup files', () => {
  it('writes every sale to CSV, marking undone sales', () => {
    const state = withSales(['2026-10-27T10:00:00']);
    state.sales[0].voidedAt = '2026-10-27T10:00:05.000Z';
    const rows = salesCsvRows(state.sales);
    expect(rows).toHaveLength(2);
    expect(rows[1].slice(2, 7)).toEqual(['Black Panther Mocha', 'Iced', '', '3.50', 'Undone']);
    expect(toCsv([['a "quote"', 1]])).toBe('"a ""quote""","1"');
  });

  it('round-trips a full backup', () => {
    const state = withSales(['2026-10-27T10:00:00']);
    const { state: restored, exportedAt } = parseFullBackup(fullBackupText(state));
    expect(exportedAt).toBeTruthy();
    expect(restored.sales).toEqual(state.sales);
    expect(restored.recipes).toHaveLength(10);
  });

  it('rejects files that are not full backups', () => {
    expect(() => parseFullBackup('{"hello":1}')).toThrow('not an Empowering Brew full backup');
  });
});
