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
