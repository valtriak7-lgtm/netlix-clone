import axios from 'axios';
import { getAccessToken } from './authApi';

const DEFAULT_API_URL = 'http://localhost:5000';

function getBaseUrl() {
  const envUrl = process.env.REACT_APP_API_URL;
  const base = (envUrl && typeof envUrl === 'string' ? envUrl : DEFAULT_API_URL).replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

const client = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export async function fetchWatchProgress() {
  try {
    const response = await client.get('/users/me/watch-progress');
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load watch progress'));
  }
}

export async function saveWatchProgress(movieId, payload) {
  try {
    const response = await client.put(`/users/me/watch-progress/${movieId}`, payload || {});
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to save watch progress'));
  }
}

export async function fetchContinueWatching() {
  try {
    const response = await client.get('/users/me/continue-watching');
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load continue watching'));
  }
}

export async function fetchWatchHistory() {
  try {
    const response = await client.get('/users/me/watch-history');
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load watch history'));
  }
}

