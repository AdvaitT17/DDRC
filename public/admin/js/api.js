async function fetchWithAuth(url, options = {}) {
  const token = AuthManager.getAuthToken();
  if (!token) {
    throw new Error("No auth token available");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    AuthManager.clearAuth();
    AuthManager.redirectToLogin();
    throw new Error("Authentication failed");
  }

  return response;
}
