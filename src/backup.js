import { ESTIMATE_LABELS } from './estimates';
import { migrate } from './storage';

const TEMPERATURES = { hot: 'Hot', iced: 'Iced', none: '' };
export const DEFAULT_BACKUP_TIME = '15:00';

export function salesCsvRows(sales) {
  return [
    ['Date', 'Time', 'Product', 'Temperature', 'Flavor', 'Price', 'Status', 'Source name', 'Recipe version', 'Estimate status', 'Estimated usage'],
    ...sales.map((sale) => {
      const at = new Date(sale.soldAt);
      return [at.toLocaleDateString('en-US'), at.toLocaleTimeString('en-US'), sale.productName, TEMPERATURES[sale.temperature] ?? sale.temperature, sale.option || '', sale.price?.toFixed(2), sale.voidedAt ? 'Undone' : 'Sold', sale.sourceName, sale.recipeVersionId || '', ESTIMATE_LABELS[sale.estimateStatus] || '', (sale.usage || []).map((use) => `${use.quantity} ${use.unit} ${use.itemName}`).join('; ')];
    }),
  ];
}

export const toCsv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

// The most recent scheduled backup time at or before `now` (today's if it has passed, otherwise yesterday's).
export function lastScheduledTime(time, now) {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(hours, minutes, 0, 0);
  if (scheduled > now) scheduled.setDate(scheduled.getDate() - 1);
  return scheduled;
}

// A backup is due when a sale the last backup did not include was made before the most
// recent daily backup time. Missed days stay due until someone saves a backup; days with
// no sales never prompt.
export function backupDue(state, now = new Date()) {
  const time = state.settings?.backupTime;
  if (!time) return false;
  const last = state.settings?.lastSalesBackupAt;
  const scheduled = lastScheduledTime(time, now).toISOString();
  return state.sales.some((sale) => (!last || sale.soldAt > last) && sale.soldAt <= scheduled);
}

export const dateStamp = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const fullBackupText = (state) => JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'empowering-brew' }, null, 1);

export function parseFullBackup(text) {
  const data = JSON.parse(text);
  if (data?.app !== 'empowering-brew' || !Array.isArray(data.sales)) throw new Error('This file is not an Empowering Brew full backup.');
  const { exportedAt, app, ...state } = data;
  return { state: migrate(state), exportedAt };
}

// On iPad (and installed Home Screen apps) the share sheet is the reliable way to
// save a file: Save to Files, Google Drive, AirDrop, Mail. Elsewhere, a normal download.
// Returns false only when the person cancels.
export async function saveFile(filename, text, type) {
  const file = new File([text], filename, { type });
  if (navigator.maxTouchPoints > 1 && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return true;
}
