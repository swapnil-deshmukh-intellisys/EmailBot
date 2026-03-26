export const DRAFT_CATEGORIES = [
  { label: 'Cover Story', value: 'cover_story' },
  { label: 'Reminder', value: 'reminder' },
  { label: 'Follow Up', value: 'follow_up' },
  { label: 'Updated Cost', value: 'updated_cost' },
  { label: 'Final Cost', value: 'final_cost' }
];

export const REPLY_MODE_DRAFT_TYPES = new Set(['reminder', 'follow_up', 'updated_cost', 'final_cost']);

export const SUMMARY_RANGES = [
  { label: 'Today', value: 'today' },
  { label: '7 Days', value: '7d' },
  { label: '15 Days', value: '15d' },
  { label: '30 Days', value: '30d' },
  { label: '3 Monthly Quarter', value: 'quarter' },
  { label: 'Customize', value: 'customize' }
];

export const COUNTRY_TIME_SLOTS = {
  india: { timezone: 'Asia/Kolkata', slots: ['09:00 AM', '11:00 AM', '02:00 PM', '05:00 PM'] },
  usa: { timezone: 'America/New_York', slots: ['08:00 AM', '10:00 AM', '01:00 PM', '04:00 PM'] },
  uk: { timezone: 'Europe/London', slots: ['09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM'] },
  uae: { timezone: 'Asia/Dubai', slots: ['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM'] },
  australia: { timezone: 'Australia/Sydney', slots: ['08:00 AM', '11:00 AM', '02:00 PM', '05:00 PM'] }
};

export const QUICK_DRAFT_PREFIX = {
  cover_story: 'cs',
  reminder: 'rem',
  follow_up: 'fu',
  updated_cost: 'uc',
  final_cost: 'fc'
};

export const PREVIEW_ROWS_PER_PAGE = 50;
