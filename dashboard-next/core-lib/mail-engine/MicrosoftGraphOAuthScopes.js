export const DELEGATED_MAILBOX_SCOPE = 'openid profile email offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send MailboxSettings.Read';

export function isGraphAppOnlyEnabled() {
  return String(process.env.ENABLE_GRAPH_APP_ONLY || '').trim().toLowerCase() === 'true';
}
