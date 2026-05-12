export const DRAFT_TYPE_ITEMS = [
  { value: 'cover_story', label: 'Cover Story' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'updated_cost', label: 'Updated Cost' },
  { value: 'final_cost', label: 'Final Cost' }
];

export const ALLOWED_DRAFT_TYPES = [
  ...DRAFT_TYPE_ITEMS.map((item) => item.value),
  'initial_outreach',
  'open_followup',
  'final_followup',
  'custom'
];

export const LEGACY_DRAFT_TYPE_ALIASES = {
  coverstory: 'cover_story',
  cover_story: 'cover_story',
  cover: 'cover_story',
  reminder: 'reminder',
  followup: 'followup',
  follow_up: 'followup',
  'follow-up': 'followup',
  openfollowup: 'open_followup',
  open_followup: 'open_followup',
  open_follow_up: 'open_followup',
  'open-follow-up': 'open_followup',
  finalfollowup: 'final_cost',
  final_followup: 'final_cost',
  final_follow_up: 'final_cost',
  'final-follow-up': 'final_cost',
  updatedcost: 'updated_cost',
  updated_cost: 'updated_cost',
  finalcost: 'final_cost',
  final_cost: 'final_cost',
  initialoutreach: 'initial_outreach',
  initial_outreach: 'initial_outreach',
  initial: 'initial_outreach',
  custom: 'custom'
};

export function normalizeDraftType(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return LEGACY_DRAFT_TYPE_ALIASES[normalized] || normalized || 'initial_outreach';
}

export function inferDraftTypeFromDraft(draft = {}) {
  const explicit = normalizeDraftType(draft.draftType || draft.category || draft.type || '');
  if (ALLOWED_DRAFT_TYPES.includes(explicit) && explicit !== 'initial_outreach') {
    return explicit;
  }

  const text = `${draft.title || ''} ${draft.subject || ''}`.toLowerCase();
  if (text.includes('cover story')) return 'cover_story';
  if (text.includes('reminder')) return 'reminder';
  if (text.includes('open follow')) return 'open_followup';
  if (text.includes('updated cost')) return 'updated_cost';
  if (text.includes('final follow') || text.includes('final cost')) return 'final_cost';
  if (text.includes('follow-up') || text.includes('follow up') || text.includes('followup')) return 'followup';
  return ALLOWED_DRAFT_TYPES.includes(explicit) ? explicit : 'initial_outreach';
}

export function draftTypeLabel(value = '') {
  const normalized = normalizeDraftType(value);
  return DRAFT_TYPE_ITEMS.find((item) => item.value === normalized)?.label || 'Cover Story';
}
