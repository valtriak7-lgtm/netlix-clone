// File purpose: Application logic for this Netflix Clone module.
import axios from 'axios';

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

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

export async function loginUser(payload) {
  try {
    const response = await client.post('/auth/login', payload);
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to login'));
  }
}

export async function registerUser(payload) {
  try {
    const response = await client.post('/auth/register', payload);
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create account'));
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
