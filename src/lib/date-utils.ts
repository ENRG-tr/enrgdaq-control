/**
 * Utils for date formatting.
 */

/**
 * Formats a given date to "YYYY-MM-DD HH:mm"
 *
 * @param date - The date to format (can be a Date object, string, or number)
 * @returns The formatted date string
 */
export function formatDate(
  date: Date | string | number | null | undefined,
): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
