/**
 * Converts an epoch millisecond timestamp into a relative time string (e.g., "5 minutes ago").
 * TODO: Consider using a library like date-fns for more robust formatting and localization.
 * @param timestamp The epoch timestamp in milliseconds.
 * @returns A relative time string.
 */
export function timeAgo(timestamp: number | null): string {
  if (timestamp === null) {
    return 'never';
  }

  const now = Date.now();
  const secondsPast = (now - timestamp) / 1000;

  if (secondsPast < 60) {
    return `${Math.round(secondsPast)}s ago`;
  }
  if (secondsPast < 3600) {
    return `${Math.round(secondsPast / 60)}m ago`;
  }
  if (secondsPast <= 86400) {
    return `${Math.round(secondsPast / 3600)}h ago`;
  }

  const daysPast = Math.round(secondsPast / 86400);

  if (daysPast < 7) {
    return `${daysPast}d ago`;
  }

  if (daysPast < 30) {
    const weeks = Math.round(daysPast / 7);
    return `${weeks}w ago`;
  }

  if (daysPast < 365) {
    const months = Math.round(daysPast / 30);
    return `${months}mo ago`;
  }

  const years = Math.round(daysPast / 365);
  return `${years}y ago`;
} 