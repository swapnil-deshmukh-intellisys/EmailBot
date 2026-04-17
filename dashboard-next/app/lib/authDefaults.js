export const TEMP_AUTH_ROLES = {
  ADMIN: 'admin',
  USER: 'user'
};

export const DEFAULT_ADMIN_LOGIN_ID = 'akshaymore.intellisys@gmail.com';
export const DEFAULT_ADMIN_PASSWORD = 'Pilote@123';
export const DEFAULT_USER_PASSWORD = 'Pilote@123';

export const SEEDED_USER_EMAILS = [
  'gayatri.intellisys@gmail.com',
  'adeshrasal.intellisys@gmail.com',
  'akshaymore.intellisys@gmail.com',
  'harshada.intellisys@gmail.com',
  'vaishnavic.intellisys@gmail.com',
  'surajmolke.intellisys@gmail.com',
  'krushnawaghmare.intellisys@gmail.com',
  'omghorpade.intellisys@gmail.com',
  'rushikeshbhaganagare.intellisys@gmail.com',
  'priyankakamble.intellisys@gmail.com',
  'ritesh.intellisys@gmail.com',
  'priyanka.intellisys@gmail.com',
  'rutujadhav.intellisysy@gmail.com',
  'nikita.intellisys@gmail.com',
  'rahuljadhav.intellisys@gmail.com',
  'gaurav.intellisys@gmail.com',
  'drushtibothikar.intellisys@gmail.com',
  'dhanashree.intellisys@gmail.com',
  'rameshwarr.tec@gmail.com',
  'rutik.intellisys@gmail.com',
  'mahesh.patil.intellisys@gmail.com',
  'swapnil.deshmukh.intellisys@gmail.com'
];

export function normalizeSeedEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeLoginType(value = '') {
  return normalizeSeedEmail(value) === TEMP_AUTH_ROLES.ADMIN ? TEMP_AUTH_ROLES.ADMIN : TEMP_AUTH_ROLES.USER;
}

export function getSeedHeadingForRole(role = '') {
  return normalizeLoginType(role) === TEMP_AUTH_ROLES.ADMIN ? 'Admin Login' : 'User Login';
}

export function getSeedEmailPlaceholder(role = '') {
  return normalizeLoginType(role) === TEMP_AUTH_ROLES.ADMIN ? 'Enter admin email' : 'Enter user email';
}

export function isSeedAdminEmail(email = '') {
  return normalizeSeedEmail(email) === normalizeSeedEmail(DEFAULT_ADMIN_LOGIN_ID);
}

export function isSeedUserEmail(email = '') {
  return SEEDED_USER_EMAILS.map((item) => normalizeSeedEmail(item)).includes(normalizeSeedEmail(email));
}

export function getSeedLoginPrefill(role = '') {
  if (normalizeLoginType(role) === TEMP_AUTH_ROLES.ADMIN) {
    return { identifier: DEFAULT_ADMIN_LOGIN_ID, password: DEFAULT_ADMIN_PASSWORD };
  }
  return { identifier: '', password: '' };
}
