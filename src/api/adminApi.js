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

export async function fetchUsers({ actorId, search = '' }) {
  try {
    const response = await client.get('/admin/users', {
      params: { actorId, search },
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load users'));
  }
}

export async function updateUserSubscription({ actorId, userId, plan, status }) {
  try {
    const response = await client.put(`/admin/users/${userId}/subscription`, {
      actorId,
      plan,
      status,
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update subscription'));
  }
}

export async function updateUserRole({ actorId, userId, role }) {
  try {
    const response = await client.put(`/admin/users/${userId}/role`, {
      actorId,
      role,
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update role'));
  }
}

export async function removeUser({ actorId, userId }) {
  try {
    await client.delete(`/admin/users/${userId}`, {
      data: { actorId },
    });
    return true;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to delete user'));
  }
}
