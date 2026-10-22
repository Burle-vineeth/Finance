import { formatDate } from '@angular/common';

/** Today's date on this phone as YYYY-MM-DD (toISOString would give the UTC date, which is yesterday before 5:30 am in India) */
export const localToday = (): string => formatDate(new Date(), 'yyyy-MM-dd', 'en-IN');

/** A date as YYYY-MM-DD in this phone's time zone */
export const localDay = (value: string | Date): string => formatDate(value, 'yyyy-MM-dd', 'en-IN');

/** A random id the server uses to recognise a resent submission */
export const newRequestId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
