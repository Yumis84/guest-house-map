const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
export const ISOLATION_CONFIRMATION = 'disposable-local-owner-cabinet';

export function requireLoopbackUrl(name, value, protocols) {
  if (!value) throw Error(`${name} is required for an isolated local Supabase stack.`);
  let url;
  try { url = new URL(value); } catch { throw Error(`${name} must be a valid URL.`); }
  if (!LOOPBACK_HOSTS.has(url.hostname) || !protocols.includes(url.protocol)) {
    throw Error(`Refusing non-loopback ${name}.`);
  }
  return value;
}

export function readOwnerTestConfig(env = process.env) {
  if (env.OWNER_TEST_CONFIRM_ISOLATED !== ISOLATION_CONFIRMATION) {
    throw Error(`Set OWNER_TEST_CONFIRM_ISOLATED=${ISOLATION_CONFIRMATION} only for a disposable local stack.`);
  }
  const url = requireLoopbackUrl('OWNER_TEST_SUPABASE_URL', env.OWNER_TEST_SUPABASE_URL, ['http:']);
  const database = requireLoopbackUrl('OWNER_TEST_DATABASE_URL', env.OWNER_TEST_DATABASE_URL, ['postgres:', 'postgresql:']);
  const anon = env.OWNER_TEST_ANON_KEY;
  const service = env.OWNER_TEST_SERVICE_ROLE_KEY;
  if (!anon || !service) throw Error('Local anon and service-role keys are required; do not use hosted credentials.');
  if (anon === service) throw Error('Anon and service-role keys must be different.');
  return {url, database, anon, service};
}
