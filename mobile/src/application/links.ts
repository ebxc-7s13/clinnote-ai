/** Public project pages (GitHub). Opened in the browser; nothing is sent with them. */
const REPO = 'https://github.com/ebxc-7s13/clinnote-ai';

export const PROJECT_LINKS = {
  repository: REPO,
  releases: `${REPO}/releases`,
  issues: `${REPO}/issues`,
  privacy: `${REPO}/blob/main/PRIVACY.md`,
  security: `${REPO}/blob/main/SECURITY.md`,
  notices: `${REPO}/blob/main/THIRD_PARTY_NOTICES.md`,
} as const;
