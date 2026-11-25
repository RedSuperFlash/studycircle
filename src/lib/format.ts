export const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
export const dateLabel = (
  value: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) =>
  new Intl.DateTimeFormat(undefined, options).format(
    new Date(value.length === 10 ? value + 'T12:00:00' : value),
  );
export const isoDay = (offset = 0) => {
  const day = new Date(today() + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};
export const deltaDays = (date: string) =>
  Math.round((Date.parse(date.slice(0, 10)) - Date.parse(today())) / 86_400_000);
export const clock = (seconds: number) =>
  [Math.floor(Math.max(0, seconds) / 60), Math.max(0, seconds) % 60]
    .map((x) => String(x).padStart(2, '0'))
    .join(':');
export function timerPhase(startedAt: string, study: number, pause: number, now = Date.now()) {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  if (elapsed < study * 60) return { phase: 'Focus', remaining: study * 60 - elapsed };
  if (elapsed < (study + pause) * 60)
    return { phase: 'Break', remaining: (study + pause) * 60 - elapsed };
  return { phase: 'Complete', remaining: 0 };
}
export function errorText(error: unknown) {
  return typeof error === 'object' && error !== null && 'message' in error
    ? String(error.message)
    : 'Something went wrong. Please try again.';
}
