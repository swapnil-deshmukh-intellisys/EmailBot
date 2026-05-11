export const DELEGATED_MAILBOX_SCOPE = 'openid profile email offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send MailboxSettings.Read';

export function isGraphAppOnlyEnabled() {
  const explicitFlag = String(process.env.ENABLE_GRAPH_APP_ONLY || '').trim().toLowerCase();
  if (explicitFlag) return ['true', '1', 'yes', 'on'].includes(explicitFlag);

  const provider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const hasDefaultGraphCredentials = Boolean(process.env.TENANT_ID && process.env.CLIENT_ID && process.env.CLIENT_SECRET);
  const hasProjectGraphCredentials = Boolean(
    (process.env.TEC_TENANT_ID && process.env.TEC_CLIENT_ID && process.env.TEC_CLIENT_SECRET) ||
    (process.env.TUT_TENANT_ID && process.env.TUT_CLIENT_ID && process.env.TUT_CLIENT_SECRET)
  );

  return provider === 'graph' && (hasDefaultGraphCredentials || hasProjectGraphCredentials);
}
