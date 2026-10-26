// Up to 2 decimals without trailing zeros: 1.05, 2.4, 12
const twoDecimals = (value: number) => String(Number(value.toFixed(2)));

/** Short amount for tight spaces (calendar days, chart axes): ₹600, ₹1.05k, ₹12.35k, ₹1.25L */
export const compactRupees = (amount: number): string => {
  // The unit is picked after rounding, so 99,999 reads ₹1L rather than ₹100k
  if (Number(twoDecimals(amount)) < 1000) return `₹${twoDecimals(amount)}`;
  if (Number(twoDecimals(amount / 1000)) < 100) return `₹${twoDecimals(amount / 1000)}k`;
  return `₹${twoDecimals(amount / 100000)}L`;
};
