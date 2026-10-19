export const OPENING_MINUTES = 9 * 60;
export const CLOSING_MINUTES = 19 * 60;

export interface AppointmentInterval {
  startsAt: Date;
  endsAt: Date;
}

export function isWithinBusinessHours(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const start = Object.fromEntries(
    formatter.formatToParts(startsAt).map(({ type, value }) => [type, value]),
  );
  const end = Object.fromEntries(
    formatter.formatToParts(endsAt).map(({ type, value }) => [type, value]),
  );
  const startMinutes = Number(start.hour) * 60 + Number(start.minute);
  const endMinutes = Number(end.hour) * 60 + Number(end.minute);
  const isSameDay =
    start.year === end.year &&
    start.month === end.month &&
    start.day === end.day;

  return (
    isSameDay &&
    start.weekday !== "Sun" &&
    startMinutes >= OPENING_MINUTES &&
    endMinutes <= CLOSING_MINUTES
  );
}

export function hasOverlap(
  requested: AppointmentInterval,
  existing: AppointmentInterval,
): boolean {
  return (
    requested.startsAt < existing.endsAt &&
    requested.endsAt > existing.startsAt
  );
}
