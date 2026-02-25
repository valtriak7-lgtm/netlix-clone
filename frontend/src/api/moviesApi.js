// File purpose: Application logic for this Netflix Clone module.
import seedMovies from '../data/seedMovies';

const DEFAULT_API_URL = 'http://localhost:5000';

function getBaseUrl() {
  const envUrl = process.env.REACT_APP_API_URL;
  const base = (envUrl && typeof envUrl === 'string' ? envUrl : DEFAULT_API_URL).replace(/\/$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}

async function handleJsonResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Request failed';
    throw new Error(message);
  }
  return payload;
}

export async function fetchMovies(options = {}) {
  const params = new URLSearchParams();
  if (options.search) params.set('search', options.search);
  if (options.category) params.set('category', options.category);
  if (options.type) params.set('type', options.type);
  if (typeof options.featured === 'boolean') params.set('featured', String(options.featured));
  if (options.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  const url = `${getBaseUrl()}/movies${query ? `?${query}` : ''}`;
  try {
    const response = await fetch(url);
    const payload = await handleJsonResponse(response);
    return Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    console.warn('Falling back to local seed data:', error);
    return seedMovies;
  }
}

export async function fetchTmdbTrailer(type, id) {
  const safeType = type === 'series' ? 'series' : 'movie';
  const url = `${getBaseUrl()}/movies/tmdb-trailer/${safeType}/${id}`;
  const response = await fetch(url);
  const payload = await handleJsonResponse(response);
  return payload?.data?.trailerUrl || '';
}
