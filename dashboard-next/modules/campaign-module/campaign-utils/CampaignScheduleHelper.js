export function getTimeZoneParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

export function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

export function buildScheduledDate(timeZone, slot) {
  if (!slot) return null;
  const now = new Date();
  const zoneNow = getTimeZoneParts(now, timeZone);
  const normalizedSlot = String(slot || '').trim().replace(/\s+/g, ' ');
  const [timePart, rawMeridiem] = normalizedSlot.split(' ');
  const meridiem = String(rawMeridiem || '').toUpperCase();
  if (!timePart || !meridiem || !['AM', 'PM'].includes(meridiem)) return null;
  let [hours, minutes] = timePart.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  let targetUtcMs = Date.UTC(zoneNow.year, zoneNow.month - 1, zoneNow.day, hours, minutes, 0);
  targetUtcMs -= getTimeZoneOffsetMs(new Date(targetUtcMs), timeZone);
  let targetDate = new Date(targetUtcMs);

  if (targetDate <= now) {
    const tomorrowUtcMs = Date.UTC(zoneNow.year, zoneNow.month - 1, zoneNow.day + 1, hours, minutes, 0);
    targetUtcMs = tomorrowUtcMs - getTimeZoneOffsetMs(new Date(tomorrowUtcMs), timeZone);
    targetDate = new Date(targetUtcMs);
  }

  return targetDate;
}

export function normalizeScheduledSlotInput(value = '') {
  const trimmed = String(value || '').trim().replace(/\s+/g, ' ');
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (!match) return '';
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export function normalizeDurationUnit(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'seconds' || normalized === 'second') return 'seconds';
  if (normalized === 'hours' || normalized === 'hour') return 'hours';
  return 'minutes';
}

export function convertDelayIntervalToSeconds(intervalValue, durationUnit = 'minutes') {
  const numeric = Number(intervalValue);
  const safeInterval = Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : 1;
  const unit = normalizeDurationUnit(durationUnit);
  if (unit === 'seconds') return safeInterval;
  if (unit === 'hours') return safeInterval * 3600;
  return safeInterval * 60;
}

export function parseHtmlTimeValue(timeValue = '') {
  const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

export function buildScheduledDateTimeInZone(dateValue = '', timeValue = '', timeZone = 'Asia/Kolkata') {
  const dateMatch = String(dateValue || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeParts = parseHtmlTimeValue(timeValue);
  if (!dateMatch || !timeParts) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const { hours, minutes } = timeParts;
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  let targetUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0);
  targetUtcMs -= getTimeZoneOffsetMs(new Date(targetUtcMs), timeZone);
  targetUtcMs -= getTimeZoneOffsetMs(new Date(targetUtcMs), timeZone) - getTimeZoneOffsetMs(new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)), timeZone);

  const targetDate = new Date(targetUtcMs);
  return Number.isNaN(targetDate.getTime()) ? null : targetDate;
}

export function isFutureScheduledDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  return date.getTime() > Date.now();
}

export function buildScheduledLabel({ country = '', timeZone = '', dateValue = '', timeValue = '', scheduledAt = null } = {}) {
  const countryLabel = String(country || 'India').trim() || 'India';
  const zoneLabel = String(timeZone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';
  const dateLabel = String(dateValue || '').trim();
  const timeLabel = String(timeValue || '').trim();
  const atLabel = scheduledAt instanceof Date && !Number.isNaN(scheduledAt.getTime())
    ? scheduledAt.toLocaleString('en-IN', { timeZone: zoneLabel })
    : `${dateLabel} ${timeLabel}`.trim();
  return `${countryLabel} • ${zoneLabel} • ${atLabel}`.trim();
}
