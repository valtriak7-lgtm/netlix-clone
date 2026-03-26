import axios from 'axios';

const DEFAULT_API_URL = 'http://localhost:5000';
const ACCESS_TOKEN_KEY = 'netflix_access_token';
const REFRESH_TOKEN_KEY = 'netflix_refresh_token';

function getBaseUrl() {
  const envUrl = process.env.REACT_APP_API_URL;
  const base = (envUrl && typeof envUrl === 'string' ? envUrl : DEFAULT_API_URL).replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

const baseURL = getBaseUrl();
const client = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
}

export function setAuthSession({ accessToken = '', refreshToken = '' }) {
  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('Session expired. Please sign in again.');
  }
  const response = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  const data = response.data?.data || {};
  setAuthSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return data.accessToken;
}

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const original = error?.config || {};
    const isAuthRoute = String(original.url || '').includes('/auth/');

    if (status !== 401 || original._retry || isAuthRoute) {
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      if (!refreshInFlight) {
        refreshInFlight = refreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
      }
      const nextAccessToken = await refreshInFlight;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${nextAccessToken}`;
      return client(original);
    } catch (refreshError) {
      clearAuthSession();
      return Promise.reject(refreshError);
    }
  }
);

function mapAuthResponse(payload) {
  const data = payload?.data || {};
  if (data.accessToken || data.refreshToken) {
    setAuthSession({
      accessToken: data.accessToken || '',
      refreshToken: data.refreshToken || '',
    });
  }
  return {
    user: data.user || null,
    accessToken: data.accessToken || '',
    refreshToken: data.refreshToken || '',
    expiresIn: data.expiresIn || 0,
    emailVerificationToken: data.emailVerificationToken || '',
  };
}

export async function loginUser(payload) {
  try {
    const response = await client.post('/auth/login', payload);
    return mapAuthResponse(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to login'));
  }
}

export async function registerUser(payload) {
  try {
    const response = await client.post('/auth/register', payload);
    return mapAuthResponse(response.data);
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create account'));
  }
}

export async function logoutUser() {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await client.post('/auth/logout', { refreshToken });
    }
  } catch {
    // logout should still clear local session if server token revoke fails
  } finally {
    clearAuthSession();
  }
}

export async function requestEmailVerification(userId) {
  try {
    const response = await client.post('/auth/verify-email/request', { userId });
    return response.data?.data || {};
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to request email verification'));
  }
}

export async function confirmEmailVerification(token) {
  try {
    const response = await client.post('/auth/verify-email/confirm', { token });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to verify email'));
  }
}

export async function requestPasswordReset(email) {
  try {
    const response = await client.post('/auth/forgot-password', { email });
    return response.data?.data || {};
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to send reset link'));
  }
}

export async function resetPasswordWithToken({ token, newPassword }) {
  try {
    const response = await client.post('/auth/reset-password', { token, newPassword });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to reset password'));
  }
}

export async function updateProfile(payload) {
  try {
    const response = await client.put('/auth/profile', payload);
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update profile'));
  }
}

export async function updatePassword(payload) {
  try {
    const response = await client.put('/auth/password', payload);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update password'));
  }
}

