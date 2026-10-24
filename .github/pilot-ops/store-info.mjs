// Reports, without secrets, what EAS already has for store uploads.
const token = process.env.EXPO_TOKEN;
if (!token) { console.log('::warning::EXPO_TOKEN missing'); process.exit(0); }
const gql = async (query, variables) => {
  const response = await fetch('https://api.expo.dev/graphql', {method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`}, body: JSON.stringify({query, variables})});
  return response.json();
};
const appId = process.env.EXPO_PROJECT_ID;
const bundleId = process.env.BUNDLE_ID;
const tryQuery = async (label, query, pick) => {
  try {
    const result = await gql(query, {appId, bundleId});
    if (result.errors) console.log(`${label}: query error: ${result.errors.map((e) => e.message).join('; ').slice(0, 300)}`);
    else console.log(`${label}:`, JSON.stringify(pick(result.data)));
  } catch (error) { console.log(`${label}: failed: ${error.message}`); }
};

await tryQuery('owner/project', `query($appId: String!) { app { byId(appId: $appId) { fullName githubRepository { metadata { githubRepoName githubRepoOwnerName } } } } }`, (d) => d.app.byId);

await tryQuery('iOS submissions (ascAppIdentifier)', `query($appId: String!) { app { byId(appId: $appId) { submissions(filter: {platform: IOS}, offset: 0, limit: 10) { id status createdAt iosConfig { ascAppIdentifier } } } } }`,
  (d) => d.app.byId.submissions.map((s) => ({status: s.status, createdAt: s.createdAt, ascAppIdentifier: s.iosConfig?.ascAppIdentifier ?? null})));

await tryQuery('Android submissions', `query($appId: String!) { app { byId(appId: $appId) { submissions(filter: {platform: ANDROID}, offset: 0, limit: 10) { id status createdAt androidConfig { track } } } } }`,
  (d) => d.app.byId.submissions.map((s) => ({status: s.status, createdAt: s.createdAt, track: s.androidConfig?.track ?? null})));

await tryQuery('Android service account key for submissions', `query($appId: String!, $bundleId: String!) { app { byId(appId: $appId) { androidAppCredentials(filter: {applicationIdentifier: $bundleId}) { googleServiceAccountKeyForSubmissions { id } } } } }`,
  (d) => d.app.byId.androidAppCredentials.map((c) => ({hasSubmissionKey: !!c.googleServiceAccountKeyForSubmissions})));

await tryQuery('iOS App Store Connect API key for submissions', `query($appId: String!) { app { byId(appId: $appId) { iosAppCredentials { appleAppIdentifier { bundleIdentifier } appStoreConnectApiKeyForSubmissions { id } } } } }`,
  (d) => d.app.byId.iosAppCredentials.map((c) => ({bundle: c.appleAppIdentifier?.bundleIdentifier, hasSubmissionKey: !!c.appStoreConnectApiKeyForSubmissions})));

await tryQuery('Latest submissions with errors', `query($appId: String!) { app { byId(appId: $appId) { submissions(filter: {}, offset: 0, limit: 4) { platform status createdAt updatedAt error { errorCode message } } } } }`,
  (d) => d.app.byId.submissions.map((s) => ({platform: s.platform, status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt, error: s.error ? `${s.error.errorCode}: ${String(s.error.message).slice(0, 300)}` : null})));

// Public lookup works only if the app is live on the App Store.
try {
  const lookup = await (await fetch(`https://itunes.apple.com/lookup?bundleId=${bundleId}`)).json();
  console.log('App Store public lookup:', lookup.resultCount ? `trackId=${lookup.results[0].trackId}` : 'not listed (expected before release)');
} catch (error) { console.log('App Store public lookup failed:', error.message); }
