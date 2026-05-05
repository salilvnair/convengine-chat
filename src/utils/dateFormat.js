/**
 * Lightweight date/time formatter — no external dependencies.
 *
 * Supported date tokens (used in dateSeparatorFormat):
 *   YYYY  Full 4-digit year           → 2026
 *   YY    2-digit year                → 26
 *   MMMM  Full month name             → April
 *   MMM   Short month name            → Apr
 *   MM    Zero-padded month           → 04
 *   M     Month number                → 4
 *   dddd  Full weekday name           → Thursday
 *   ddd   Short weekday name          → Thu
 *   DD    Zero-padded day             → 05
 *   D     Day number                  → 5
 *
 * Special date format values:
 *   'auto'  → "Today", "Yesterday", or "ddd, MMM D" for older dates (WhatsApp style)
 *
 * Supported time tokens (used in bubbleTimeFormat):
 *   HH   Zero-padded 24-hour          → 14
 *   H    24-hour                       → 14
 *   hh   Zero-padded 12-hour          → 02
 *   h    12-hour                       → 2
 *   mm   Zero-padded minutes           → 05
 *   ss   Zero-padded seconds           → 09
 *   A    AM/PM uppercase               → PM
 *   a    am/pm lowercase               → pm
 */

const DAYS_FULL  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Returns a stable 'YYYY-M-D' string (local time) for grouping messages by
 * calendar day.  Two timestamps that produce the same key are on the same day.
 * @param {number} ts - Unix ms timestamp
 * @returns {string}
 */
export function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Format a timestamp as a date string.
 *
 * @param {number} ts     - Unix ms timestamp
 * @param {string} format - Format string or 'auto' (default: 'auto')
 * @returns {string}
 */
export function formatDate(ts, format = 'auto') {
  const d   = new Date(ts);
  const now  = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgMidnight   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((todayMidnight - msgMidnight) / 86400000);

  if (format === 'auto') {
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    format = 'ddd, MMM D';
  }

  // Single regex replaces all tokens simultaneously so a substituted value
  // (e.g. "May") can never be matched by a later token (e.g. bare "M").
  return format.replace(/MMMM|MMM|MM|M|dddd|ddd|DD|D|YYYY|YY/g, (tok) => {
    switch (tok) {
      case 'MMMM': return MONS_FULL[d.getMonth()];
      case 'MMM':  return MONS_SHORT[d.getMonth()];
      case 'MM':   return String(d.getMonth() + 1).padStart(2, '0');
      case 'M':    return String(d.getMonth() + 1);
      case 'dddd': return DAYS_FULL[d.getDay()];
      case 'ddd':  return DAYS_SHORT[d.getDay()];
      case 'DD':   return String(d.getDate()).padStart(2, '0');
      case 'D':    return String(d.getDate());
      case 'YYYY': return String(d.getFullYear());
      case 'YY':   return String(d.getFullYear()).slice(-2);
      default:     return tok;
    }
  });
}

/**
 * Format a timestamp as a time string.
 *
 * @param {number} ts     - Unix ms timestamp
 * @param {string} format - Format string (default: 'h:mm A')
 * @returns {string}
 */
export function formatTime(ts, format = 'h:mm A') {
  const d  = new Date(ts);
  const H  = d.getHours();
  const h  = H % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const A  = H < 12 ? 'AM' : 'PM';

  return format
    .replace('HH', String(H).padStart(2, '0'))
    .replace('H',  String(H))
    .replace('hh', String(h).padStart(2, '0'))
    .replace('h',  String(h))
    .replace('mm', mm)
    .replace('ss', ss)
    .replace('A',  A)
    .replace('a',  A.toLowerCase());
}
