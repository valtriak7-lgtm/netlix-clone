// File purpose: Application logic for this Netflix Clone module.
const Movie = require('../models/Movie');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const seedMovies = require('../data/seedMovies');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_TIMEOUT_MS = Number(process.env.TMDB_TIMEOUT_MS || 15000);
const TMDB_COOLDOWN_MS = Number(process.env.TMDB_COOLDOWN_MS || 5 * 60 * 1000);
let tmdbDisabledUntil = 0;
let tmdbFailureStreak = 0;

function buildTmdbUrl(path, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is missing in server/.env');
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set('api_key', apiKey);

  const language = process.env.TMDB_LANGUAGE || 'en-US';
  const region = process.env.TMDB_REGION || 'US';

  if (language) {
    url.searchParams.set('language', language);
  }
  if (region) {
    url.searchParams.set('region', region);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function tmdbFetch(path, params, attempts = 2) {
  const url = buildTmdbUrl(path, params);
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TMDB_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload?.status_message || payload?.message || 'TMDB request failed';
        throw new Error(message);
      }
      return payload;
    } catch (error) {
      lastError = error;
      const cause = error?.cause?.message || error?.cause || error?.message;
      console.warn('TMDB fetch failed:', cause);
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

async function fetchTrailerUrl(id, type) {
  const path = type === 'series' ? `/tv/${id}/videos` : `/movie/${id}/videos`;
  const payload = await tmdbFetch(path);
  const results = payload?.results || [];
  const preferred = ['Trailer', 'Teaser', 'Clip'];
  const video = preferred
    .map((kind) => results.find((item) => item.site === 'YouTube' && item.type === kind))
    .find(Boolean);
  return video ? `https://www.youtube.com/embed/${video.key}` : '';
}

async function fetchGenreMap(type) {
  const path = type === 'series' ? '/genre/tv/list' : '/genre/movie/list';
  const payload = await tmdbFetch(path);
  const map = new Map();
  (payload?.genres || []).forEach((genre) => {
    if (genre?.name && genre?.id) {
      map.set(genre.name.toLowerCase(), genre.id);
    }
  });
  return map;
}

function mapTmdbItem(item, category, type, trailerMap, isFeatured) {
  const title = item.title || item.name || 'Untitled';
  const date = item.release_date || item.first_air_date || '';
  const year = date ? Number(date.slice(0, 4)) : new Date().getFullYear();
  const poster = item.poster_path
    ? `${TMDB_IMAGE_BASE}/w500${item.poster_path}`
    : item.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w780${item.backdrop_path}`
      : '';
  const backdrop = item.backdrop_path
    ? `${TMDB_IMAGE_BASE}/w1280${item.backdrop_path}`
    : poster;
  const key = `${type}:${item.id}`;

  return {
    id: `tmdb-${type}-${item.id}`,
    title,
    description: item.overview || 'No description available.',
    category,
    type,
    year,
    rating: item.adult ? '18+' : '13+',
    duration: type === 'series' ? 'Series' : 'Movie',
    image: poster,
    backdrop,
    trailerUrl: trailerMap.get(key) || '',
    featured: isFeatured,
  };
}

async function getMoviesFromTmdb(req, res, next) {
  try {
    const perCategory = Math.min(Math.max(Number(req.query.perCategory) || 16, 6), 40);
    const genreMapMovie = await fetchGenreMap('movie');
    const genreMapTv = await fetchGenreMap('series');

    const categories = [
      { title: 'Trending Movies', path: '/trending/movie/week', type: 'movie' },
      { title: 'Trending TV', path: '/trending/tv/week', type: 'series' },
      { title: 'Now Playing', path: '/movie/now_playing', type: 'movie' },
      { title: 'Popular Movies', path: '/movie/popular', type: 'movie' },
      { title: 'Top Rated Movies', path: '/movie/top_rated', type: 'movie' },
      { title: 'Upcoming Movies', path: '/movie/upcoming', type: 'movie' },
      { title: 'Popular TV', path: '/tv/popular', type: 'series' },
      { title: 'Top Rated TV', path: '/tv/top_rated', type: 'series' },
      { title: 'On The Air', path: '/tv/on_the_air', type: 'series' },
    ];

    const genreCategories = [];
    const movieGenres = [
      'Action',
      'Adventure',
      'Animation',
      'Comedy',
      'Crime',
      'Documentary',
      'Drama',
      'Family',
      'Fantasy',
      'Horror',
      'Romance',
      'Science Fiction',
      'Thriller',
    ];
    const tvGenres = [
      'Action & Adventure',
      'Animation',
      'Comedy',
      'Crime',
      'Documentary',
      'Drama',
      'Family',
      'Mystery',
      'Reality',
      'Sci-Fi & Fantasy',
      'War & Politics',
    ];

    movieGenres.forEach((name) => {
      const id = genreMapMovie.get(name.toLowerCase());
      if (id) {
        genreCategories.push({
          title: `${name} Movies`,
          path: '/discover/movie',
          type: 'movie',
          params: { with_genres: String(id), sort_by: 'popularity.desc' },
        });
      }
    });

    tvGenres.forEach((name) => {
      const id = genreMapTv.get(name.toLowerCase());
      if (id) {
        genreCategories.push({
          title: `${name} TV`,
          path: '/discover/tv',
          type: 'series',
          params: { with_genres: String(id), sort_by: 'popularity.desc' },
        });
      }
    });

    const categoryResults = await Promise.all(
      [...categories, ...genreCategories].map(async (category) => {
        const payload = await tmdbFetch(category.path, category.params);
        const results = payload?.results || [];
        return { ...category, results: results.slice(0, perCategory) };
      })
    );

    const trailerTargets = [];
    categoryResults.slice(0, 2).forEach((category) => {
      category.results.slice(0, 3).forEach((item) => {
        trailerTargets.push({ id: item.id, type: category.type });
      });
    });

    const trailerResults = await Promise.allSettled(
      trailerTargets.map(async (target) => {
        const trailerUrl = await fetchTrailerUrl(target.id, target.type);
        return [`${target.type}:${target.id}`, trailerUrl];
      })
    );
    const trailerEntries = trailerResults
      .filter((result) => result.status === 'fulfilled' && result.value[1])
      .map((result) => result.value);
    const trailerMap = new Map(trailerEntries);

    const data = [];
    categoryResults.forEach((category, categoryIndex) => {
      category.results.forEach((item, index) => {
        data.push(
          mapTmdbItem(item, category.title, category.type, trailerMap, categoryIndex === 0 && index === 0)
        );
      });
    });

    tmdbFailureStreak = 0;
    tmdbDisabledUntil = 0;
    return res.status(200).json({ count: data.length, data });
  } catch (error) {
    throw error;
  }
}

function normalizeMovie(movieDoc) {
  const movie = movieDoc.toObject ? movieDoc.toObject() : movieDoc;
  return {
    id: movie._id.toString(),
    title: movie.title,
    description: movie.description,
    category: movie.category,
    type: movie.type,
    year: movie.year,
    rating: movie.rating,
    duration: movie.duration,
    image: movie.imageUrl,
    backdrop: movie.backdropUrl,
    trailerUrl: movie.trailerUrl,
    featured: movie.featured,
    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt,
  };
}

function normalizeSeedMovie(movie) {
  return {
    id: `seed-${movie.title.toLowerCase().replace(/\s+/g, '-')}`,
    title: movie.title,
    description: movie.description,
    category: movie.category,
    type: movie.type,
    year: movie.year,
    rating: movie.rating,
    duration: movie.duration,
    image: movie.imageUrl,
    backdrop: movie.backdropUrl,
    trailerUrl: movie.trailerUrl,
    featured: movie.featured,
    createdAt: undefined,
    updatedAt: undefined,
  };
}

async function getMovies(req, res, next) {
  try {
    const now = Date.now();
    const tmdbDisabled = tmdbDisabledUntil > now;
    if (process.env.TMDB_API_KEY && req.query.source !== 'db' && !tmdbDisabled) {
      try {
        return await getMoviesFromTmdb(req, res, next);
      } catch (error) {
        tmdbFailureStreak += 1;
        if (tmdbFailureStreak >= 1) {
          tmdbDisabledUntil = now + TMDB_COOLDOWN_MS;
          console.warn(
            `TMDB unavailable, falling back to database/seed. Disabled for ${Math.round(
              TMDB_COOLDOWN_MS / 1000
            )}s.`
          );
        } else {
          console.warn('TMDB unavailable, falling back to database/seed.');
        }
      }
    } else if (tmdbDisabled) {
      console.warn('TMDB temporarily disabled, serving database/seed data.');
    }

    const { search = '', category = '', type = '', featured = '', limit = '200' } = req.query;
    const filter = {};

    if (search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    if (category.trim()) {
      filter.category = category.trim();
    }

    if (type.trim()) {
      filter.type = type.trim();
    }

    if (featured === 'true' || featured === 'false') {
      filter.featured = featured === 'true';
    }

    const cappedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const isDbReady = mongoose.connection.readyState === 1;

    if (isDbReady) {
      const movies = await Movie.find(filter).sort({ createdAt: -1 }).limit(cappedLimit);
      tmdbFailureStreak = 0;
      tmdbDisabledUntil = 0;
      return res.status(200).json({
        count: movies.length,
        data: movies.map(normalizeMovie),
      });
    }

    const filteredSeed = seedMovies
      .filter((movie) => !type || movie.type === type)
      .filter((movie) => !category || movie.category === category)
      .filter((movie) => !search || movie.title.toLowerCase().includes(search.toLowerCase()))
      .filter((movie) => (featured === 'true' ? movie.featured : true))
      .slice(0, cappedLimit);

    return res.status(200).json({
      count: filteredSeed.length,
      data: filteredSeed.map(normalizeSeedMovie),
    });
  } catch (error) {
    return next(error);
  }
}

async function getMovieById(req, res, next) {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    return res.status(200).json({ data: normalizeMovie(movie) });
  } catch (error) {
    return next(error);
  }
}

async function getTmdbTrailer(req, res, next) {
  try {
    const { type, id } = req.params;
    const normalizedType = type === 'series' ? 'series' : type === 'movie' ? 'movie' : '';
    if (!normalizedType || !id) {
      return res.status(400).json({ message: 'Valid type and id are required.' });
    }

    if (!process.env.TMDB_API_KEY) {
      return res.status(503).json({ message: 'TMDB trailer service is unavailable.' });
    }

    const trailerUrl = await fetchTrailerUrl(id, normalizedType);
    if (!trailerUrl) {
      return res.status(404).json({ message: 'Trailer not available for this title.' });
    }

    return res.status(200).json({ data: { trailerUrl } });
  } catch (error) {
    return next(error);
  }
}

async function createMovie(req, res, next) {
  try {
    const movie = await Movie.create(req.body);
    return res.status(201).json({
      message: 'Movie created',
      data: normalizeMovie(movie),
    });
  } catch (error) {
    return next(error);
  }
}

async function updateMovie(req, res, next) {
  try {
    const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    return res.status(200).json({
      message: 'Movie updated',
      data: normalizeMovie(movie),
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteMovie(req, res, next) {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    return res.status(200).json({ message: 'Movie deleted' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMovies,
  getMovieById,
  getTmdbTrailer,
  createMovie,
  updateMovie,
  deleteMovie,
};
