/**
 * Converts an epoch millisecond timestamp into a relative time string (e.g., "5 minutes ago").
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
  if (secondsPast < 86400) {
    return `${Math.round(secondsPast / 3600)}h ago`;
  }
  
  const daysPast = Math.floor(secondsPast / 86400);
  
  if (daysPast === 1) {
    return '1 day ago';
  }
  if (daysPast < 7) {
    return `${daysPast} days ago`;
  }
  if (daysPast < 30) {
    const weeksPast = Math.floor(daysPast / 7);
    return weeksPast === 1 ? '1 week ago' : `${weeksPast} weeks ago`;
  }
  if (daysPast < 365) {
    const monthsPast = Math.floor(daysPast / 30);
    return monthsPast === 1 ? '1 month ago' : `${monthsPast} months ago`;
  }
  
  const yearsPast = Math.floor(daysPast / 365);
  return yearsPast === 1 ? '1 year ago' : `${yearsPast} years ago`;
} 