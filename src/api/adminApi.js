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

export async function getDashboardMetrics({ actorId }) {
  try {
    const response = await client.get('/admin/dashboard/metrics', {
      params: { actorId },
    });
    return response.data?.data || {};
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load dashboard metrics'));
  }
}

export async function getRealtimeMonitoring({ actorId }) {
  try {
    const response = await client.get('/admin/dashboard/realtime', {
      params: { actorId },
    });
    return response.data?.data || {};
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load realtime monitoring'));
  }
}

export async function listAdminContent({ actorId, search = '', type = '' }) {
  try {
    const response = await client.get('/admin/content', {
      params: { actorId, search, type },
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load content'));
  }
}

export async function createAdminContent({ actorId, payload }) {
  try {
    const response = await client.post('/admin/content', {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create content'));
  }
}

export async function bulkUploadAdminContent({ actorId, csvText }) {
  try {
    const response = await client.post('/admin/content/bulk-upload', {
      actorId,
      csvText,
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to bulk upload content'));
  }
}

export async function updateAdminVideoAssets({ actorId, contentId, payload }) {
  try {
    const response = await client.put(`/admin/content/${contentId}/video-assets`, {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update video assets'));
  }
}

export async function addSeasonToContent({ actorId, contentId, seasonNumber, title }) {
  try {
    const response = await client.post(`/admin/content/${contentId}/seasons`, {
      actorId,
      seasonNumber,
      title,
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to add season'));
  }
}

export async function addEpisodeToSeason({ actorId, contentId, seasonNumber, payload }) {
  try {
    const response = await client.post(`/admin/content/${contentId}/seasons/${seasonNumber}/episodes`, {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to add episode'));
  }
}

export async function updateContentOrganization({ actorId, contentId, payload }) {
  try {
    const response = await client.put(`/admin/content/${contentId}/organization`, {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update content organization'));
  }
}

export async function setUserSuspension({ actorId, userId, isSuspended }) {
  try {
    const response = await client.put(`/admin/users/${userId}/suspension`, {
      actorId,
      isSuspended,
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update suspension status'));
  }
}

export async function resetManagedUserPassword({ actorId, userId }) {
  try {
    const response = await client.post(`/admin/users/${userId}/reset-password`, {
      actorId,
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to reset password'));
  }
}

export async function terminateManagedUser({ actorId, userId }) {
  try {
    const response = await client.post(`/admin/users/${userId}/terminate`, {
      actorId,
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to terminate account'));
  }
}

export async function getSubscriptionPlans({ actorId }) {
  try {
    const response = await client.get('/admin/billing/plans', {
      params: { actorId },
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load plans'));
  }
}

export async function saveSubscriptionPlan({ actorId, payload }) {
  try {
    const response = await client.post('/admin/billing/plans', {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to save plan'));
  }
}

export async function getPromotions({ actorId }) {
  try {
    const response = await client.get('/admin/billing/promotions', {
      params: { actorId },
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load promotions'));
  }
}

export async function savePromotion({ actorId, payload }) {
  try {
    const response = await client.post('/admin/billing/promotions', {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to save promotion'));
  }
}

export async function generateInvoice({ actorId, payload }) {
  try {
    const response = await client.post('/admin/billing/invoices', {
      actorId,
      ...(payload || {}),
    });
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to generate invoice'));
  }
}

export async function getFailedPayments({ actorId }) {
  try {
    const response = await client.get('/admin/billing/failed-payments', {
      params: { actorId },
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load failed payments'));
  }
}

export async function getContentPerformance({ actorId }) {
  try {
    const response = await client.get('/admin/analytics/content-performance', {
      params: { actorId },
    });
    return response.data?.data || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load content performance'));
  }
}

export async function getUserEngagement({ actorId }) {
  try {
    const response = await client.get('/admin/analytics/user-engagement', {
      params: { actorId },
    });
    return response.data?.data || {};
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to load user engagement'));
  }
}
