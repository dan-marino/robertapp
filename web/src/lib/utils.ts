export function formatGameDate(dateString: string, format: 'short' | 'long'): string {
  const date = new Date(dateString + 'T12:00:00');
  if (format === 'short') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
