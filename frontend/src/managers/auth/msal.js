// Dummy auth module — MSAL / Azure AD completely removed.
// getAccessToken is still exported so useChatData.js doesn't break.
// The backend ignores the token entirely.

export async function getAccessToken() {
  return "dummy-token";
}

export async function getAccount() {
  return null;
}

export async function logout() {
  // no-op
}
