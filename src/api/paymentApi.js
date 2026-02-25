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

export async function createPaymentOrder(payload) {
  try {
    const response = await client.post('/payments/create-order', payload);
    return response.data?.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create payment order'));
  }
}

export async function verifyPayment(payload) {
  try {
    const response = await client.post('/payments/verify', payload);
    return response.data?.data?.user;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to verify payment'));
  }
}
