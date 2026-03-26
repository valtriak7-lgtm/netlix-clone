// File purpose: Application logic for this Netflix Clone module.
import {
  Suspense,
  lazy,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  updatePassword,
  updateProfile,
} from './api/authApi';
import { fetchUsers, removeUser, updateUserRole, updateUserSubscription } from './api/adminApi';
import { fetchMovies, fetchTmdbTrailer } from './api/moviesApi';
import { fetchWatchHistory, fetchWatchProgress, saveWatchProgress } from './api/userApi';
import Settings from './components/Settings';
import Subscription from './components/Subscription';
import AdminSuiteShowcase from './components/AdminSuiteShowcase';
import UserExperienceHub from './components/UserExperienceHub';
import './App.css';

// Lazy-loaded components are downloaded only when needed to keep initial load faster.
const DetailsModal = lazy(() => import('./components/DetailsModal'));
const TrailerSlider = lazy(() => import('./components/TrailerSlider'));

// localStorage keys used to persist app data between page refreshes.
const USER_KEY = 'netflix_user';
const LIST_KEY = 'netflix_my_list';
const SETTINGS_KEY = 'netflix_settings';
const WATCH_PROGRESS_KEY = 'netflix_watch_progress';
const WATCH_HISTORY_KEY = 'netflix_watch_history';
const PROFILES_KEY = 'netflix_profiles';
const ACTIVE_PROFILE_KEY = 'netflix_active_profile';
const DOWNLOADS_KEY = 'netflix_downloads';
const REVIEWS_KEY = 'netflix_reviews';
const KIDS_PIN_KEY = 'netflix_kids_pin';

// Main header navigation links shown at the top of the app.
const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/tv-shows', label: 'TV Shows' },
  { to: '/movies', label: 'Movies' },
  { to: '/new-popular', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
  { to: '/watch-history', label: 'History' },
  { to: '/experience', label: 'Experience' },
  { to: '/feature-lab', label: 'Feature Lab' },
];
// Public image URLs used for branding and default profile visuals.
const NETFLIX_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg';
const DEFAULT_NETFLIX_PROFILE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Netflix_2015_N_logo.svg';
const CUSTOM_PROFILE_AVATAR_URL = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Cdefs%3E%3ClinearGradient id=%22bg%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop offset=%220%25%22 stop-color=%22%230b0b0b%22/%3E%3Cstop offset=%22100%25%22 stop-color=%22%23202020%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22200%22 height=%22200%22 rx=%2224%22 fill=%22url(%23bg)%22/%3E%3Ccircle cx=%22100%22 cy=%2284%22 r=%2235%22 fill=%22%23e50914%22/%3E%3Crect x=%2248%22 y=%22128%22 width=%22104%22 height=%2244%22 rx=%2222%22 fill=%22%23e50914%22/%3E%3C/svg%3E';
const FOOTER_IMAGE_LINK = '#';
const FOOTER_PLACEHOLDER_IMAGE_URL = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22220%22 height=%2270%22 viewBox=%220 0 220 70%22%3E%3Crect width=%22220%22 height=%2270%22 rx=%228%22 fill=%22%23161616%22 stroke=%22%23373737%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 fill=%22%23d4d4d4%22 font-size=%2212%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-family=%22Arial,sans-serif%22%3EAdd Footer Image%3C/text%3E%3C/svg%3E';
const NETFLIX_INSTAGRAM_URL = 'https://www.instagram.com/netflix/';
const NETFLIX_FACEBOOK_URL = 'https://www.facebook.com/netflix/';
const NETFLIX_WHATSAPP_CHANNEL_URL = 'https://www.whatsapp.com/channel/0029Va5nZToFSAt56yKM0C1f';

// Starter settings applied for new users and as fallback values.
const DEFAULT_SETTINGS = {
  theme: 'dark',
  language: 'english',
  autoplay: true,
  autoplayPreview: true,
  profileVisibility: 'private',
  twoFactor: false,
  loginAlerts: true,
  subtitleLanguage: 'english',
  maturityLevel: '16+',
  playbackQuality: 'auto',
  downloadOnWifiOnly: true,
  profileLock: false,
  dataSaver: false,
};

// Bigger number means higher permissions in role checks.
const ROLE_PRIORITY = {
  user: 1,
  admin: 2,
  superadmin: 3,
};

// normalizeUser: cleans and fills user data so the app always has safe defaults.
function normalizeUser(input) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const safeRole = ROLE_PRIORITY[input.role] ? input.role : 'user';
  const safeSubscription = input.subscription && typeof input.subscription === 'object'
    ? input.subscription
    : {};

  return {
    ...input,
    profileId: (typeof input.profileId === 'string' && input.profileId.trim())
      ? input.profileId.trim()
      : `user-${String(input.id || '').slice(-6)}`,
    avatar:
      (typeof input.avatar === 'string' && input.avatar.trim()) ||
      DEFAULT_NETFLIX_PROFILE_URL,
    role: safeRole,
    subscription: {
      plan: safeSubscription.plan || 'basic',
      status: safeSubscription.status || 'active',
      services: Array.isArray(safeSubscription.services) ? safeSubscription.services : ['streaming-hd'],
      renewalDate: safeSubscription.renewalDate || null,
    },
  };
}

// canAccessRole: checks if a user has enough permissions for a protected feature.
function canAccessRole(user, minimumRole) {
  if (!user) {
    return false;
  }
  return (ROLE_PRIORITY[user.role] || 0) >= (ROLE_PRIORITY[minimumRole] || 0);
}

// normalizeContentType: maps API/data type variants to app filter values.
function normalizeContentType(type) {
  const safeType = String(type || '').trim().toLowerCase();
  if (safeType === 'movie') {
    return 'movie';
  }
  if (['series', 'tv', 'show', 'tvshow', 'tv-show', 'tv series'].includes(safeType)) {
    return 'series';
  }
  return '';
}

function fuzzyIncludes(text, query) {
  const source = String(text || '').toLowerCase();
  const needle = String(query || '').toLowerCase().trim();
  if (!needle) {
    return true;
  }
  if (source.includes(needle)) {
    return true;
  }
  let index = 0;
  for (let i = 0; i < source.length && index < needle.length; i += 1) {
    if (source[i] === needle[index]) {
      index += 1;
    }
  }
  return index === needle.length;
}

// NetflixBrand: renders the Netflix logo in compact or regular size.
function NetflixBrand({ compact = false }) {
  const widthClass = compact ? 'w-24 sm:w-28' : 'w-28 sm:w-36';
  return (
    <img
      src={NETFLIX_LOGO_URL}
      alt="Netflix"
      className={`h-auto ${widthClass}`}
      loading="eager"
    />
  );
}

// ProfileAvatar: shows the user's avatar and swaps to a fallback if image loading fails.
function ProfileAvatar({ user }) {
  const avatar = (typeof user?.avatar === 'string' && user.avatar.trim())
    ? user.avatar.trim()
    : DEFAULT_NETFLIX_PROFILE_URL;

  return (
    <img
      src={avatar}
      alt={user?.name ? `${user.name} profile` : 'Netflix profile'}
      className="h-8 w-8 rounded object-cover"
      referrerPolicy="no-referrer"
      onError={(event) => {
        event.currentTarget.src = CUSTOM_PROFILE_AVATAR_URL;
      }}
    />
  );
}

// readStorage: safely reads JSON from localStorage; returns fallback if missing/corrupt.
function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// writeStorage: stores JS values in localStorage as JSON strings.
function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// groupByCategory: groups movies into rows by category for the home rails.
function groupByCategory(movies) {
  const grouped = movies.reduce((acc, movie) => {
    const category = movie.category || 'Featured';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(movie);
    return acc;
  }, {});

  return Object.entries(grouped).map(([title, items], index) => ({
    id: `${title.toLowerCase().replace(/\s+/g, '-')}-${index}`,
    title,
    items,
  }));
}

function buildTopTenSection(movies) {
  const ranked = [...movies]
    .sort((a, b) => {
      const ratingA = Number.parseFloat(String(a.rating || '').replace(/[^\d.]/g, '')) || 0;
      const ratingB = Number.parseFloat(String(b.rating || '').replace(/[^\d.]/g, '')) || 0;
      if (ratingB !== ratingA) {
        return ratingB - ratingA;
      }
      return Number(b.year || 0) - Number(a.year || 0);
    })
    .slice(0, 10);

  return { id: 'top-10', title: 'Top 10 in Your Region', items: ranked };
}

function buildContinueWatchingSection(movies, progressMap) {
  if (!movies.length || !progressMap || typeof progressMap !== 'object') {
    return { id: 'continue-watching', title: 'Continue Watching', items: [] };
  }

  const lookup = new Map(movies.map((movie) => [String(movie.id), movie]));
  const entries = Object.entries(progressMap)
    .filter(([, value]) => Number(value) > 0 && Number(value) < 95)
    .sort(([, a], [, b]) => Number(b) - Number(a));

  const items = entries
    .map(([id]) => lookup.get(String(id)))
    .filter(Boolean)
    .slice(0, 20);

  return { id: 'continue-watching', title: 'Continue Watching', items };
}

function buildHistorySection(movies, watchHistory) {
  if (!Array.isArray(watchHistory) || !watchHistory.length) {
    return { id: 'watch-history', title: 'Recently Watched', items: [] };
  }

  const lookup = new Map(movies.map((movie) => [String(movie.id), movie]));
  const items = watchHistory
    .map((id) => lookup.get(String(id)))
    .filter(Boolean)
    .slice(0, 20);

  return { id: 'watch-history', title: 'Recently Watched', items };
}

function buildRecommendationSection(movies, myList, watchHistory) {
  if (!movies.length) {
    return { id: 'recommended', title: 'Because You Watched', items: [] };
  }

  const seedItems = [...myList, ...watchHistory.map((id) => movies.find((movie) => String(movie.id) === String(id)))].filter(Boolean);
  const preferredCategories = new Set(seedItems.map((item) => String(item.category || '').trim()).filter(Boolean));
  const seenIds = new Set(seedItems.map((item) => String(item.id)));

  const candidates = preferredCategories.size
    ? movies.filter((item) => preferredCategories.has(String(item.category || '').trim()) && !seenIds.has(String(item.id)))
    : movies.filter((item) => !seenIds.has(String(item.id)));

  return {
    id: 'recommended',
    title: 'Because You Watched',
    items: candidates.slice(0, 20),
  };
}

// resolveTrailerForItem: gets a trailer URL from item data or fetches it from TMDB ids.
async function resolveTrailerForItem(item) {
  if (!item) {
    return '';
  }
  if (item.trailerUrl) {
    return item.trailerUrl;
  }
  const match = String(item.id || '').match(/^tmdb-(movie|series)-(\d+)$/);
  if (!match) {
    return '';
  }
  const [, type, tmdbId] = match;
  try {
    return await fetchTmdbTrailer(type, tmdbId);
  } catch {
    return '';
  }
}

// Header: top navigation bar with search and profile dropdown actions.
function Header({ isScrolled, query, setQuery, user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const dropdownRef = useRef(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const onSearchChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    if (location.pathname !== '/search') {
      navigate('/search');
    }
  };

  useEffect(() => {
    if (!showDropdown) {
      return undefined;
    }

    const onClickOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [showDropdown]);

  return (
    <header
      className={`fixed top-0 z-40 w-full transition-all duration-300 ${
        isScrolled
          ? 'border-b border-white/10 bg-black/75 backdrop-blur-md'
          : 'bg-gradient-to-b from-black/90 to-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-4 sm:px-8">
        <div className="flex items-center gap-7">
          <button
            type="button"
            className="inline-flex items-center"
            onClick={() => navigate('/')}
            aria-label="Netflix home"
          >
            <NetflixBrand />
          </button>
          <nav className="hidden items-center gap-5 text-sm md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `nav-link ${isActive ? 'active text-white' : 'text-neutral-300 hover:text-white'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
            >
              <path
                d="M10.5 3.5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm9.7 13.3-3.3-3.3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={query}
              onChange={onSearchChange}
              placeholder="Search titles..."
              className="search-input-glass w-40 rounded border border-neutral-600 bg-black/70 py-2 pl-9 pr-3 text-sm text-white placeholder:text-neutral-400 focus:border-white focus:outline-none sm:w-60"
            />
          </div>
          <div ref={dropdownRef} className="profile-orb relative">
            <button
              type="button"
              className="soft-ring rounded border border-neutral-500 bg-neutral-900 p-0.5 hover:border-white focus:outline-none"
              onClick={() => setShowDropdown((prev) => !prev)}
              aria-label="Profile menu"
            >
              <ProfileAvatar user={user} />
            </button>
            {showDropdown && (
              <div className="glass-panel smooth-enter absolute right-0 z-50 mt-2 w-48 rounded-md">
                {user ? (
                  <>
                    <button
                      type="button"
                      className="dropdown-item w-full px-4 py-2 text-left text-white hover:bg-neutral-800"
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                    >
                      Logout
                    </button>
                    <NavLink
                      to="/help"
                      className="dropdown-item block px-4 py-2 text-white hover:bg-neutral-800"
                      onClick={() => setShowDropdown(false)}
                    >
                      Help
                    </NavLink>
                    <NavLink
                      to="/settings"
                      className="dropdown-item block px-4 py-2 text-white hover:bg-neutral-800"
                      onClick={() => setShowDropdown(false)}
                    >
                      Settings
                    </NavLink>
                    <NavLink
                      to="/subscription"
                      className="dropdown-item block px-4 py-2 text-white hover:bg-neutral-800"
                      onClick={() => setShowDropdown(false)}
                    >
                      Subscription
                    </NavLink>
                    {canAccessRole(user, 'admin') && (
                      <NavLink
                        to="/admin"
                        className="dropdown-item block px-4 py-2 text-white hover:bg-neutral-800"
                        onClick={() => setShowDropdown(false)}
                      >
                        Admin
                      </NavLink>
                    )}
                    {canAccessRole(user, 'superadmin') && (
                      <NavLink
                        to="/super-admin"
                        className="dropdown-item block px-4 py-2 text-white hover:bg-neutral-800"
                        onClick={() => setShowDropdown(false)}
                      >
                        Super Admin
                      </NavLink>
                    )}
                  </>
                ) : (
                  <NavLink
                    to="/login"
                    className="dropdown-item block px-4 py-2 text-white hover:bg-neutral-800"
                    onClick={() => setShowDropdown(false)}
                  >
                    Sign In
                  </NavLink>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// AppPageLayout: shared page wrapper that includes the common header shell.
function AppPageLayout({ user, onLogout, query, setQuery, children }) {
  return (
    <div className="app-shell min-h-screen bg-black text-white">
      <Header
        isScrolled
        query={query}
        setQuery={setQuery}
        user={user}
        onLogout={onLogout}
      />
      {children}
      <MobileBottomNav />
    </div>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/90 px-3 py-2 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-center text-[11px]">
        {[
          { to: '/', label: 'Home' },
          { to: '/search', label: 'Search' },
          { to: '/my-list', label: 'My List' },
          { to: '/watch-history', label: 'History' },
          { to: '/profile', label: 'Profile' },
        ].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `rounded px-1 py-2 ${isActive ? 'bg-white text-black' : 'text-neutral-300'}`}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

// MovieCard: single title card with play, info, and My List actions.
function MovieCard({ item, onOpen, onPlay, inList, onToggleList, square = false }) {
  // Use square cards for search grid and wide cards for horizontal rails.
  const cardSizeClass = square
    ? 'aspect-square w-full min-w-0'
    : 'h-44 min-w-[170px] sm:h-52 sm:min-w-[220px]';

  return (
    <div className={`film-card glass-panel elevate-on-hover group relative overflow-hidden rounded-md text-left hover:z-20 ${cardSizeClass}`}>
      <button type="button" onClick={() => onOpen(item)} className="h-full w-full">
        <img
          src={item.image}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:brightness-50"
        />
      </button>
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 opacity-0 transition duration-300 group-hover:opacity-100">
        <h3 className="text-sm font-bold text-white">{item.title}</h3>
        <p className="mt-1 text-xs text-neutral-300">
          {item.year} | {item.rating} | {item.duration}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onPlay(item)}
            className="soft-ring rounded bg-white px-2 py-1 text-xs font-semibold text-black transition hover:bg-neutral-200"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => onToggleList(item)}
            className="soft-ring rounded border border-white/70 px-2 py-1 text-xs font-semibold text-white transition hover:border-white"
          >
            {inList ? 'Remove from List' : '+ My List'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Row: horizontal scrolling rail that renders a list of movie cards.
function Row({ section, onOpen, onPlay, myListIds, onToggleList }) {
  const railRef = useRef(null);

  const scrollRail = (direction) => {
    if (!railRef.current) {
      return;
    }
    railRef.current.scrollBy({ left: direction * 700, behavior: 'smooth' });
  };

  if (!section.items.length) {
    return null;
  }

  return (
    <section className="rail-pop smooth-enter relative mt-8">
      <h2 className="section-title mb-3 text-lg font-semibold tracking-wide text-white sm:text-2xl">
        {section.title}
      </h2>
      <button
        type="button"
        aria-label={`Scroll ${section.title} left`}
        onClick={() => scrollRail(-1)}
        className="absolute left-0 top-1/2 z-20 hidden h-24 w-8 -translate-y-1/2 rounded-r-md bg-black/60 text-2xl text-white transition hover:bg-black/90 md:block"
      >
        {'<'}
      </button>
      <div ref={railRef} className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
        {section.items.map((item) => (
          <MovieCard
            key={item.id}
            item={item}
            onOpen={onOpen}
            onPlay={onPlay}
            inList={myListIds.has(item.id)}
            onToggleList={onToggleList}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label={`Scroll ${section.title} right`}
        onClick={() => scrollRail(1)}
        className="absolute right-0 top-1/2 z-20 hidden h-24 w-8 -translate-y-1/2 rounded-l-md bg-black/60 text-2xl text-white transition hover:bg-black/90 md:block"
      >
        {'>'}
      </button>
    </section>
  );
}

function LoadingRails() {
  return (
    <div className="space-y-8 py-6">
      {[1, 2, 3].map((row) => (
        <div key={row}>
          <div className="mb-3 h-5 w-44 animate-pulse rounded bg-neutral-800" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((card) => (
              <div
                key={`${row}-${card}`}
                className="h-44 min-w-[170px] animate-pulse rounded-md bg-neutral-800 sm:h-52 sm:min-w-[220px]"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Footer: simple footer with static help/account links.
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/70 px-4 py-10 text-neutral-400 backdrop-blur-md sm:px-8">
      <div className="mx-auto mb-8 flex max-w-[1100px] justify-center sm:justify-start">
        <a href={FOOTER_IMAGE_LINK} className="inline-flex rounded focus:outline-none focus:ring-2 focus:ring-white/60">
          <img
            src={FOOTER_PLACEHOLDER_IMAGE_URL}
            alt="Footer image link placeholder"
            className="h-[70px] w-[220px] rounded border border-white/20 object-cover transition hover:border-white/50"
            loading="lazy"
          />
        </a>
      </div>
      <div className="mx-auto mb-8 flex max-w-[1100px] items-center gap-4">
        <a
          href={NETFLIX_INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Netflix Instagram"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-neutral-300 transition hover:border-white hover:text-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.1.1 1.8.2 2.3.4.7.3 1.2.6 1.7 1.1s.8 1 1.1 1.7c.2.5.4 1.2.4 2.3.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.1-.2 1.8-.4 2.3-.3.7-.6 1.2-1.1 1.7s-1 1-1.7 1.1c-.5.2-1.2.4-2.3.4-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.1-.1-1.8-.2-2.3-.4-.7-.3-1.2-.6-1.7-1.1s-1-1-1.1-1.7c-.2-.5-.4-1.2-.4-2.3C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.1.2-1.8.4-2.3.3-.7.6-1.2 1.1-1.7s1-1 1.7-1.1c.5-.2 1.2-.4 2.3-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.9c-3.1 0-3.4 0-4.7.1-1 .1-1.5.2-1.9.3-.5.2-.8.4-1.2.8-.4.4-.6.7-.8 1.2-.1.4-.3.9-.3 1.9-.1 1.3-.1 1.6-.1 4.7s0 3.4.1 4.7c.1 1 .2 1.5.3 1.9.2.5.4.8.8 1.2.4.4.7.6 1.2.8.4.1.9.3 1.9.3 1.3.1 1.6.1 4.7.1s3.4 0 4.7-.1c1-.1 1.5-.2 1.9-.3.5-.2.8-.4 1.2-.8.4-.4.6-.7.8-1.2.1-.4.3-.9.3-1.9.1-1.3.1-1.6.1-4.7s0-3.4-.1-4.7c-.1-1-.2-1.5-.3-1.9-.2-.5-.4-.8-.8-1.2-.4-.4-.7-.6-1.2-.8-.4-.1-.9-.3-1.9-.3-1.3-.1-1.6-.1-4.7-.1Zm0 3.2A4.7 4.7 0 1 1 12 16.7 4.7 4.7 0 0 1 12 7.3Zm0 7.5a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Zm6-7.7a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
          </svg>
        </a>
        <a
          href={NETFLIX_FACEBOOK_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Netflix Facebook"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-neutral-300 transition hover:border-white hover:text-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.2-1.5 1.5-1.5h1.6V4.6c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3.1h2.5v8h3Z" />
          </svg>
        </a>
        <a
          href={NETFLIX_WHATSAPP_CHANNEL_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Netflix WhatsApp Channel"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-neutral-300 transition hover:border-white hover:text-white"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
            <path d="M20.5 3.5A11 11 0 0 0 3.7 17.6L2 22l4.5-1.6A11 11 0 1 0 20.5 3.5Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.7 1 .9-2.6-.2-.3A9 9 0 1 1 12 20.5Zm4.9-6.7c-.3-.1-1.7-.8-2-.8-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-1.6-.8-2.6-1.5-3.7-3.4-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5l.3-.4c.1-.2.1-.3 0-.5 0-.1-.6-1.5-.9-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-1 1-1 2.4 0 1.4 1 2.8 1.2 2.9.1.2 2 3.1 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.1 1.8.1.6-.1 1.7-.7 2-1.3.2-.6.2-1.2.1-1.3-.1-.1-.3-.2-.6-.3Z" />
          </svg>
        </a>
      </div>
      <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-6 text-sm sm:grid-cols-4">
        <a href="#faq" className="hover:text-white">
          FAQ
        </a>
        <a href="#help" className="hover:text-white">
          Help Center
        </a>
        <a href="#account" className="hover:text-white">
          Account
        </a>
        <a href="#media" className="hover:text-white">
          Media Center
        </a>
        <a href="#investor" className="hover:text-white">
          Investor Relations
        </a>
        <a href="#jobs" className="hover:text-white">
          Jobs
        </a>
        <a href="#privacy" className="hover:text-white">
          Privacy
        </a>
        <a href="#contact" className="hover:text-white">
          Contact Us
        </a>
      </div>
    </footer>
  );
}

// HomePage: main browsing screen with hero banner, rows, and details modal.
function HomePage({
  view,
  sections,
  allMovies,
  loading,
  error,
  myList,
  onToggleList,
  onPlayItem,
  user,
  onLogout,
  query,
  setQuery,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('info');
  const [isScrolled, setIsScrolled] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);
  // useDeferredValue keeps typing smooth by delaying expensive filtering work.
  const deferredQuery = useDeferredValue(query);

  // Convert My List into a Set for fast O(1) lookup by id.
  const myListIds = useMemo(() => new Set(myList.map((item) => item.id)), [myList]);

  // Reset local search/modal state whenever user navigates to a different route.
  useEffect(() => {
    setModalItem(null);
    setModalMode('info');
  }, [location.pathname, setQuery]);

  // Track header style based on scroll position.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Build visible rows from the selected view + search input.
  const visibleSections = useMemo(() => {
    const lowered = deferredQuery.trim().toLowerCase();

    return sections
      .map((section) => {
        let items = section.items;

        if (view === 'movies') {
          items = items.filter((item) => normalizeContentType(item.type) === 'movie');
        }

        if (view === 'shows') {
          items = items.filter((item) => normalizeContentType(item.type) === 'series');
        }

        if (view === 'new') {
          items = [...items].sort((a, b) => b.year - a.year);
        }

        if (lowered) {
          items = items.filter((item) => fuzzyIncludes(item.title, lowered));
        }

        return { ...section, items };
      })
      .filter((section) => section.items.length > 0);
  }, [deferredQuery, sections, view]);

  // Pick the hero fallback item if no trailer carousel items are available.
  const featured = useMemo(() => {
    const featuredMovie = allMovies.find((movie) => movie.featured);
    return featuredMovie || visibleSections[0]?.items[0] || allMovies[0] || null;
  }, [allMovies, visibleSections]);

  // Hero slider prefers titles that already have trailer URLs.
  const trailers = useMemo(
    () => allMovies.filter((movie) => movie.trailerUrl).slice(0, 10),
    [allMovies]
  );

  // Hero rotates through trailers; if empty, it uses the single featured item.
  const heroItems = useMemo(() => {
    if (trailers.length) {
      return trailers;
    }
    if (featured) {
      return [featured];
    }
    return [];
  }, [featured, trailers]);

  // Auto-rotate hero every 8s unless paused by mouse hover.
  useEffect(() => {
    let timer;
    if (!isHeroPaused && heroItems.length > 1) {
      timer = setInterval(() => {
        setHeroIndex((prev) => (prev + 1) % heroItems.length);
      }, 8000);
    }
    return () => clearInterval(timer);
  }, [heroItems.length, isHeroPaused]);

  const activeHero = heroItems[heroIndex];

  // Convert a trailer URL into an autoplaying, muted YouTube embed URL.
  const getYouTubeEmbedUrl = (url) => {
    if (!url) {
      return '';
    }
    const match = url.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    const id = match?.[1];
    if (!id) {
      return url;
    }
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&rel=0&modestbranding=1`;
  };

  return (
    <div className="app-shell min-h-screen bg-black text-white">
      <Header
        isScrolled={isScrolled}
        query={query}
        setQuery={setQuery}
        user={user}
        onLogout={onLogout}
      />

      <main>
        <section
          className="hero-ambient hero-glow smooth-enter relative h-screen min-h-[520px] overflow-hidden"
          onMouseEnter={() => setIsHeroPaused(true)}
          onMouseLeave={() => setIsHeroPaused(false)}
        >
          {activeHero?.trailerUrl ? (
            <div className="hero-video">
              <iframe
                title={`${activeHero.title} preview`}
                src={getYouTubeEmbedUrl(activeHero.trailerUrl)}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <img
              src={activeHero?.backdrop || activeHero?.image}
              alt={activeHero?.title || 'Featured'}
              className="h-full w-full animate-slow-zoom object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute bottom-14 left-4 z-10 max-w-2xl space-y-4 px-2 sm:left-8">
            <p className="hero-kicker tracking-[0.35em] text-red-500">N SERIES</p>
            <h2 className="animate-fade-in-up section-title text-4xl font-extrabold leading-tight sm:text-6xl">
              {activeHero?.title || featured?.title || 'Streaming Right Now'}
            </h2>
            <p className="max-w-xl text-sm text-neutral-200 sm:text-base">
              {activeHero?.description ||
                featured?.description ||
                'Discover trending movies and shows with a fast, animated browsing experience.'}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onPlayItem(activeHero || featured);
                  if ((activeHero || featured)?.id) {
                    navigate(`/watch/${(activeHero || featured).id}`);
                  }
                }}
                className="cta-shimmer soft-ring rounded bg-white px-7 py-2 font-semibold text-black transition hover:bg-neutral-200"
              >
                Play
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalMode('info');
                  setModalItem(activeHero || featured);
                }}
                className="soft-ring rounded bg-neutral-500/70 px-7 py-2 font-semibold text-white transition hover:bg-neutral-400/80"
              >
                More Info
              </button>
            </div>
          </div>
        </section>

        <Suspense
          fallback={<div className="mt-4 px-6 text-sm text-neutral-300">Loading previews...</div>}
        >
          <TrailerSlider trailers={trailers} />
        </Suspense>


        <div className="relative z-10 mx-auto mt-[-50px] max-w-[1400px] px-4 pb-14 sm:px-8">
          {loading && <LoadingRails />}
          {!loading && error && (
            <p className="mb-4 rounded border border-red-600/40 bg-red-900/20 px-4 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          {!loading && visibleSections.length > 0 && (
            <div className="stagger-in">
              {visibleSections.map((section) => (
                <Row
                  key={section.id}
                  section={section}
                  onOpen={(item) => {
                    setModalMode('info');
                    setModalItem(item);
                  }}
                  onPlay={(item) => {
                    onPlayItem(item);
                    navigate(`/watch/${item.id}`);
                  }}
                  myListIds={myListIds}
                  onToggleList={onToggleList}
                />
              ))}
            </div>
          )}

          {!loading && !visibleSections.length && query.trim() !== '' && (
            <div className="glass-panel mt-20 rounded-lg border border-neutral-800 bg-neutral-900/70 p-8 text-center">
              <p className="text-xl font-semibold">No matches found for "{query}"</p>
              <p className="mt-2 text-neutral-300">Try a different title in search.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <Suspense fallback={null}>
        <DetailsModal
          item={modalItem}
          autoPlay={modalMode === 'play'}
          inList={modalItem ? myListIds.has(modalItem.id) : false}
          onToggleList={onToggleList}
          onResolveTrailer={resolveTrailerForItem}
          onClose={() => setModalItem(null)}
        />
      </Suspense>
    </div>
  );
}

// SearchPage: advanced search with filters, sorting, and modal playback/info.
function SearchPage({
  allMovies,
  loading,
  error,
  myList,
  onToggleList,
  onPlayItem,
  user,
  onLogout,
  query,
  setQuery,
}) {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [minRating, setMinRating] = useState('0');
  const [listFilter, setListFilter] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('info');
  // Keep API-driven results separate so filter changes can reload data.
  const [reloadedItems, setReloadedItems] = useState(allMovies);
  // Show refresh feedback while reloading on filter changes.
  const [isReloading, setIsReloading] = useState(false);
  // Surface reload errors without breaking already loaded content.
  const [reloadError, setReloadError] = useState('');
  // useDeferredValue keeps typing smooth by delaying expensive filtering work.
  const deferredQuery = useDeferredValue(query);

  // Keep local reload cache in sync when parent movie data updates.
  useEffect(() => {
    setReloadedItems(allMovies);
  }, [allMovies]);

  // Reload movies whenever search/type/category changes so filter feels live.
  useEffect(() => {
    let active = true;

    async function reloadFilteredMovies() {
      setIsReloading(true);
      setReloadError('');
      try {
        const data = await fetchMovies({
          limit: 500,
          search: deferredQuery.trim() || undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
        });
        if (!active) {
          return;
        }
        setReloadedItems(Array.isArray(data) ? data : []);
      } catch (apiError) {
        if (!active) {
          return;
        }
        setReloadError(apiError.message || 'Unable to refresh filtered movies.');
      } finally {
        if (active) {
          setIsReloading(false);
        }
      }
    }

    void reloadFilteredMovies();
    return () => {
      active = false;
    };
  }, [deferredQuery, typeFilter, categoryFilter]);

  // Convert My List into a Set for fast O(1) lookup by id.
  const myListIds = useMemo(() => new Set(myList.map((item) => item.id)), [myList]);
  // Build filter options from existing movie categories.
  const categories = useMemo(
    () => Array.from(new Set(allMovies.map((item) => item.category).filter(Boolean))).sort(),
    [allMovies]
  );
  // Build year filter options sorted newest first.
  const years = useMemo(
    () => Array.from(new Set(allMovies.map((item) => item.year).filter(Boolean))).sort((a, b) => b - a),
    [allMovies]
  );
  const languages = useMemo(
    () => Array.from(
      new Set(
        allMovies
          .map((item) => String(item.language || item.audioLanguage || 'Unknown').trim())
          .filter(Boolean)
      )
    ).sort(),
    [allMovies]
  );

  // Apply all active filters + search text + sort order to produce visible search results.
  const visibleItems = useMemo(() => {
    const loweredQuery = deferredQuery.trim().toLowerCase();
    // Start from reloaded data, then apply remaining local-only filters.
    let items = reloadedItems.filter((item) => {
      if (typeFilter !== 'all' && normalizeContentType(item.type) !== typeFilter) {
        return false;
      }
      const normalizedCategory = String(item.category || '').trim().toLowerCase();
      if (categoryFilter !== 'all' && normalizedCategory !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (yearFilter !== 'all' && String(item.year) !== yearFilter) {
        return false;
      }
      const itemLanguage = String(item.language || item.audioLanguage || 'Unknown').trim().toLowerCase();
      if (languageFilter !== 'all' && itemLanguage !== languageFilter.toLowerCase()) {
        return false;
      }
      const numericRating = Number.parseFloat(String(item.rating || '').replace(/[^\d.]/g, '')) || 0;
      if (numericRating < Number(minRating || 0)) {
        return false;
      }
      if (listFilter === 'in-list' && !myListIds.has(item.id)) {
        return false;
      }
      if (listFilter === 'not-in-list' && myListIds.has(item.id)) {
        return false;
      }
      if (!loweredQuery) {
        return true;
      }
      const searchable = `${item.title} ${item.description || ''} ${item.category || ''}`.toLowerCase();
      return fuzzyIncludes(searchable, loweredQuery);
    });

    if (sortBy === 'newest') {
      items = [...items].sort((a, b) => b.year - a.year);
    } else if (sortBy === 'oldest') {
      items = [...items].sort((a, b) => a.year - b.year);
    } else if (sortBy === 'a-z') {
      items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    }

    return items;
  }, [categoryFilter, deferredQuery, languageFilter, listFilter, minRating, myListIds, reloadedItems, sortBy, typeFilter, yearFilter]);

  return (
    <div className="app-shell min-h-screen bg-black text-white">
      <Header
        isScrolled
        query={query}
        setQuery={setQuery}
        user={user}
        onLogout={onLogout}
      />

      <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-24 sm:px-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="soft-ring elevate-on-hover rounded border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:border-white"
          >
            Back
          </button>
        </div>
        <section className="search-panel glass-panel smooth-enter rounded-lg p-4 sm:p-6">
          <div className="search-filters flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Type</label>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="all">All</option>
                <option value="movie">Movies</option>
                <option value="series">TV Shows</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Category</label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Year</label>
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={String(year)}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Language</label>
              <select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="all">All Languages</option>
                {languages.map((language) => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Min Rating</label>
              <select
                value={minRating}
                onChange={(event) => setMinRating(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="0">Any</option>
                <option value="5">5+</option>
                <option value="6">6+</option>
                <option value="7">7+</option>
                <option value="8">8+</option>
                <option value="9">9+</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">My List</label>
              <select
                value={listFilter}
                onChange={(event) => setListFilter(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="all">All Titles</option>
                <option value="in-list">Only My List</option>
                <option value="not-in-list">Not in My List</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Sort</label>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="a-z">A-Z</option>
              </select>
            </div>
          </div>
        </section>

        {(loading || isReloading) && (
          <p className="py-10 text-center text-neutral-300">
            {loading ? 'Loading titles...' : 'Refreshing titles...'}
          </p>
        )}
        {!loading && error && (
          <p className="mt-4 rounded border border-red-600/40 bg-red-900/20 px-4 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {!loading && !error && reloadError && (
          <p className="mt-4 rounded border border-red-600/40 bg-red-900/20 px-4 py-2 text-sm text-red-200">
            {reloadError}
          </p>
        )}

        {!loading && !isReloading && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Search Results</h2>
              <p className="text-sm text-neutral-300">{visibleItems.length} title(s)</p>
            </div>
            {visibleItems.length > 0 ? (
              <div className="stagger-in grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {visibleItems.map((item) => (
                  <MovieCard
                    key={item.id}
                    item={item}
                    onOpen={(nextItem) => {
                      setModalMode('info');
                      setModalItem(nextItem);
                    }}
                    onPlay={(nextItem) => {
                      onPlayItem(nextItem);
                      navigate(`/watch/${nextItem.id}`);
                    }}
                    inList={myListIds.has(item.id)}
                    onToggleList={onToggleList}
                    square
                  />
                ))}
              </div>
            ) : (
              <div className="search-empty-glass glass-panel rounded-lg border border-neutral-800 bg-neutral-900/70 p-8 text-center">
                <p className="text-xl font-semibold">No matches found</p>
                <p className="mt-2 text-neutral-300">Try a different filter or search text.</p>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />

      <Suspense fallback={null}>
        <DetailsModal
          item={modalItem}
          autoPlay={modalMode === 'play'}
          inList={modalItem ? myListIds.has(modalItem.id) : false}
          onToggleList={onToggleList}
          onResolveTrailer={resolveTrailerForItem}
          onClose={() => setModalItem(null)}
        />
      </Suspense>
    </div>
  );
}

// LoginPage: handles sign in/sign up flow and auth API requests.
function LoginPage({ user, onLogin, movies }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  // Featured images used in the right-side login showcase slider.
  const showcaseItems = useMemo(
    () => movies.filter((movie) => movie.image || movie.backdrop).slice(0, 12),
    [movies]
  );
  // Background marquee images for login page ambience.
  const rollingItems = useMemo(
    () => movies.filter((movie) => movie.image || movie.backdrop).slice(0, 30),
    [movies]
  );
  // Split marquee images into multiple rows to create layered motion.
  const rollingRows = useMemo(() => {
    if (!rollingItems.length) {
      return [];
    }
    return [
      rollingItems.slice(0, 12),
      rollingItems.slice(8, 20),
      rollingItems.slice(16, 28),
    ].map((row) => (row.length ? row : rollingItems.slice(0, 12)));
  }, [rollingItems]);

  // Already logged in users are sent directly to profile.
  useEffect(() => {
    if (user) {
      navigate('/profile', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (showcaseItems.length < 2) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % showcaseItems.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [showcaseItems.length]);

  // Submit sign-in/sign-up form and update global auth state on success.
  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your email.');
        return;
      }
      setSubmitting(true);
      try {
        const result = await requestPasswordReset(email.trim());
        setNotice(
          result?.resetToken
            ? `Reset token (dev): ${result.resetToken}`
            : 'If this email exists, a reset link was sent.'
        );
      } catch (apiError) {
        setError(apiError.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password.trim() || (mode === 'signup' && !name.trim())) {
      setError('Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { email: email.trim(), password: password.trim() };
      const authUser = mode === 'signup'
        ? await registerUser({ ...payload, name: name.trim(), role })
        : await loginUser(payload);

      onLogin(normalizeUser(authUser?.user));
      navigate('/', { replace: true });
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      {rollingRows.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-35">
          <div className="absolute left-1/2 top-1/2 w-[145%] -translate-x-1/2 -translate-y-1/2 -rotate-6 space-y-5">
            {rollingRows.map((row, rowIndex) => (
              <div key={`rolling-row-${rowIndex}`} className="marquee-mask">
                <div className={`marquee-track flex gap-3 ${rowIndex % 2 ? 'marquee-track-reverse' : ''}`}>
                  {[...row, ...row].map((movie, movieIndex) => (
                    <img
                      key={`${movie.id}-${movieIndex}`}
                      src={movie.image || movie.backdrop}
                      alt={movie.title}
                      className="h-28 w-48 shrink-0 rounded-md object-cover"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-8 px-4 py-8 md:grid-cols-2 md:items-center md:px-8">
        <section className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/70 p-8 backdrop-blur">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="inline-flex items-center"
            aria-label="Netflix sign in"
          >
            <NetflixBrand />
          </button>
          <h2 className="mt-8 text-4xl font-bold">
            {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Sign In'}
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {mode === 'signup'
              ? 'Join now and continue watching where you left off.'
              : mode === 'forgot'
                ? 'Enter your email and we will send a reset link.'
              : 'Sign in to continue to Netflix Clone.'}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {mode === 'signup' && (
              <>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded bg-neutral-800 px-4 py-3 text-sm text-white outline-none ring-red-600 focus:ring-2"
                />
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className="w-full rounded bg-neutral-800 px-4 py-3 text-sm text-white outline-none ring-red-600 focus:ring-2"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </>
            )}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded bg-neutral-800 px-4 py-3 text-sm text-white outline-none ring-red-600 focus:ring-2"
            />
            {mode !== 'forgot' && (
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="w-full rounded bg-neutral-800 px-4 py-3 text-sm text-white outline-none ring-red-600 focus:ring-2"
              />
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {notice && <p className="text-sm text-green-400">{notice}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-red-600 py-3 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting
                ? 'Please wait...'
                : mode === 'signup'
                  ? 'Create Account'
                  : mode === 'forgot'
                    ? 'Send Reset Link'
                    : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-sm text-neutral-300">
            {mode === 'signup' ? 'Already have an account?' : 'New to Netflix?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
                setError('');
                setNotice('');
              }}
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              {mode === 'signup' ? 'Sign in now' : 'Create one'}
            </button>
          </p>
          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === 'forgot' ? 'signin' : 'forgot'));
              setError('');
              setNotice('');
            }}
            className="mt-3 text-sm text-neutral-300 underline-offset-2 hover:text-white hover:underline"
          >
            {mode === 'forgot' ? 'Back to sign in' : 'Forgot password?'}
          </button>
        </section>

        <section className="relative hidden h-[560px] overflow-hidden md:block">
          {showcaseItems.length > 0 ? (
            showcaseItems.map((movie, index) => {
              const previousIndex = (slideIndex - 1 + showcaseItems.length) % showcaseItems.length;
              const isActive = index === slideIndex;
              const isPrevious = index === previousIndex;

              return (
                <img
                  key={movie.id}
                  src={movie.image || movie.backdrop}
                  alt={movie.title || 'Featured'}
                  className={`absolute inset-0 h-full w-full object-contain transition-all duration-1000 ease-out ${
                    isActive ? 'translate-x-0 opacity-100' : isPrevious ? '-translate-x-full opacity-0' : 'translate-x-full opacity-0'
                  }`}
                />
              );
            })
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-400">
              Loading featured titles...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ProfilePage: account summary screen showing profile and subscription stats.
function ProfilePage({ user, onLogout, myListCount, historyCount, activeProfileName, downloadCount }) {
  return (
    <div className="profile-shell min-h-screen bg-black px-4 py-10 text-white">
      <div className="profile-card glass-panel smooth-enter mx-auto mt-16 w-full max-w-3xl rounded-xl p-8">
        <p className="hero-kicker text-xs font-semibold uppercase tracking-[0.34em] text-red-500">Account Hub</p>
        <h2 className="section-title mt-3 text-3xl font-bold">Profile</h2>
        <div className="mt-6">
          <img
            src={user.avatar || DEFAULT_NETFLIX_PROFILE_URL}
            alt={`${user.name} avatar`}
            className="h-20 w-20 rounded object-cover ring-2 ring-white/20"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.src = CUSTOM_PROFILE_AVATAR_URL;
            }}
          />
        </div>
        <div className="stagger-in mt-6 grid gap-3 sm:grid-cols-2">
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Profile ID</p>
            <p className="mt-1 text-base font-semibold text-white">{user.profileId || '-'}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Name</p>
            <p className="mt-1 text-base font-semibold text-white">{user.name}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Email</p>
            <p className="mt-1 text-base font-semibold text-white">{user.email}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Role</p>
            <p className="mt-1 text-base font-semibold text-white">{user.role || 'user'}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Plan</p>
            <p className="mt-1 text-base font-semibold text-white">{user.subscription?.plan || 'basic'}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3 sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-neutral-400">My List Titles</p>
            <p className="mt-1 text-base font-semibold text-white">{myListCount}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3 sm:col-span-2">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Watch History</p>
            <p className="mt-1 text-base font-semibold text-white">{historyCount}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Active Profile</p>
            <p className="mt-1 text-base font-semibold text-white">{activeProfileName}</p>
          </div>
          <div className="metric-card rounded-lg border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Downloads</p>
            <p className="mt-1 text-base font-semibold text-white">{downloadCount}</p>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <NavLink to="/my-list" className="cta-shimmer soft-ring rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
            Open My List
          </NavLink>
          <NavLink to="/watch-history" className="soft-ring rounded border border-neutral-500 px-4 py-2 text-sm font-semibold hover:border-white">
            Watch History
          </NavLink>
          <NavLink to="/experience" className="soft-ring rounded border border-neutral-500 px-4 py-2 text-sm font-semibold hover:border-white">
            Experience Hub
          </NavLink>
          <button
            type="button"
            onClick={onLogout}
            className="soft-ring rounded border border-neutral-500 px-4 py-2 text-sm font-semibold hover:border-white"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// HelpPage: static help center information page.
function HelpPage() {
  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="glass-panel mx-auto mt-16 w-full max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900 p-8">
        <h2 className="text-3xl font-bold">Help Center</h2>
        <p className="mt-4 text-neutral-300">
          Need assistance? Reach support, check billing questions, or browse account troubleshooting.
        </p>
        <div className="mt-6 space-y-3 text-sm text-neutral-200">
          <p>1. Account access issues</p>
          <p>2. Playback and streaming quality</p>
          <p>3. Billing and payments</p>
          <p>4. Device setup and compatibility</p>
        </div>
      </div>
    </div>
  );
}

function WatchPlayerPage({ allMovies, onPlaybackProgress, onMarkPlayed }) {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const item = useMemo(
    () => allMovies.find((movie) => String(movie.id) === String(contentId)),
    [allMovies, contentId]
  );
  const [progress, setProgress] = useState(8);
  const [autoNext, setAutoNext] = useState(true);

  useEffect(() => {
    if (item) {
      onMarkPlayed(item);
    }
  }, [item, onMarkPlayed]);

  useEffect(() => {
    if (!item) {
      return undefined;
    }
    const timer = setInterval(() => {
      setProgress((current) => {
        const next = Math.min(100, current + 2);
        onPlaybackProgress(item, next);
        return next;
      });
    }, 1600);
    return () => clearInterval(timer);
  }, [item, onPlaybackProgress]);

  const related = useMemo(() => {
    if (!item) {
      return null;
    }
    return allMovies.find((movie) => String(movie.id) !== String(item.id) && normalizeContentType(movie.type) === normalizeContentType(item.type))
      || allMovies.find((movie) => String(movie.id) !== String(item.id))
      || null;
  }, [allMovies, item]);

  if (!item) {
    return (
      <div className="min-h-screen bg-black px-4 py-24 text-white">
        <p className="text-lg">Title not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative h-[58vh] min-h-[320px] bg-black">
        {item.trailerUrl ? (
          <iframe
            title={`${item.title} player`}
            src={item.trailerUrl}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="h-full w-full"
          />
        ) : (
          <img src={item.backdrop || item.image} alt={item.title} className="h-full w-full object-cover" />
        )}
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <button type="button" onClick={() => navigate(-1)} className="rounded bg-black/70 px-3 py-2 text-sm">Back</button>
          <button type="button" onClick={() => setProgress(20)} className="rounded bg-black/70 px-3 py-2 text-sm">Skip Intro</button>
          <button
            type="button"
            onClick={() => {
              if (related) {
                navigate(`/watch/${related.id}`);
              }
            }}
            className="rounded bg-black/70 px-3 py-2 text-sm"
          >
            Next Episode
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="text-2xl font-bold">{item.title}</h2>
        <p className="mt-2 text-sm text-neutral-300">{item.description}</p>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-300">
            <span>Playback Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(event) => {
              const next = Number(event.target.value);
              setProgress(next);
              onPlaybackProgress(item, next);
            }}
            className="w-full accent-red-600"
          />
          <div className="mt-3 flex items-center gap-2 text-sm">
            <input id="auto-next" type="checkbox" checked={autoNext} onChange={(event) => setAutoNext(event.target.checked)} />
            <label htmlFor="auto-next">Auto play next episode</label>
          </div>
        </div>
        {autoNext && progress >= 98 && related && (
          <div className="mt-5 rounded border border-green-600/40 bg-green-900/20 p-3 text-sm text-green-100">
            Episode complete. Up next: {related.title}
          </div>
        )}
      </div>
    </div>
  );
}

function FeatureLabPage({
  allMovies,
  myList,
  profiles,
  activeProfileId,
  onSwitchProfile,
  onAddProfile,
  kidsPin,
  setKidsPin,
  downloads,
  onToggleDownload,
  reviews,
  onSaveReview,
  onShareList,
}) {
  const [profileName, setProfileName] = useState('');
  const [reviewMovieId, setReviewMovieId] = useState(() => String(allMovies[0]?.id || ''));
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [pinInput, setPinInput] = useState('');
  const [pinStatus, setPinStatus] = useState('');
  const [shareMessage, setShareMessage] = useState('');

  const currentProfile = profiles.find((entry) => entry.id === activeProfileId) || profiles[0];
  const selectedMovie = allMovies.find((movie) => String(movie.id) === String(reviewMovieId));
  const selectedMovieReviews = reviews[String(reviewMovieId)] || [];

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto mt-16 w-full max-w-7xl space-y-6">
        <h2 className="text-3xl font-bold">Feature Lab</h2>
        <p className="text-neutral-300">Profiles, parental controls, downloads, ratings/reviews, and sharing in one place.</p>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-lg font-semibold">Profile Manager</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {profiles.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSwitchProfile(entry.id)}
                  className={`rounded px-3 py-2 text-sm ${entry.id === currentProfile?.id ? 'bg-white text-black' : 'bg-neutral-800'}`}
                >
                  {entry.name} {entry.kids ? '(Kids)' : ''}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="New profile name" className="rounded bg-black px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => {
                  if (!profileName.trim()) return;
                  onAddProfile(profileName.trim(), false);
                  setProfileName('');
                }}
                className="rounded bg-red-600 px-3 py-2 text-sm font-semibold"
              >
                Add Profile
              </button>
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-lg font-semibold">Kids PIN Lock</h3>
            <p className="mt-1 text-sm text-neutral-300">Current PIN: {kidsPin ? 'Set' : 'Not set'}</p>
            <div className="mt-3 flex gap-2">
              <input value={pinInput} onChange={(event) => setPinInput(event.target.value)} placeholder="4-digit PIN" className="rounded bg-black px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => {
                  if (/^\d{4}$/.test(pinInput)) {
                    setKidsPin(pinInput);
                    setPinStatus('PIN updated');
                    setPinInput('');
                  } else {
                    setPinStatus('Enter exactly 4 digits');
                  }
                }}
                className="rounded bg-red-600 px-3 py-2 text-sm font-semibold"
              >
                Save PIN
              </button>
            </div>
            {pinStatus && <p className="mt-2 text-xs text-neutral-300">{pinStatus}</p>}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-lg font-semibold">Downloads (Offline Simulation)</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {allMovies.slice(0, 9).map((movie) => {
                const downloaded = downloads.includes(String(movie.id));
                return (
                  <button key={movie.id} type="button" onClick={() => onToggleDownload(movie)} className={`rounded border px-2 py-2 text-xs ${downloaded ? 'border-green-500 bg-green-900/20' : 'border-neutral-700 bg-black'}`}>
                    {downloaded ? 'Downloaded' : 'Download'}: {movie.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-neutral-800 bg-neutral-900 p-4">
            <h3 className="text-lg font-semibold">Share Watchlist</h3>
            <p className="mt-2 text-sm text-neutral-300">Create a sharable summary of your current list.</p>
            <button
              type="button"
              onClick={() => {
                const message = onShareList();
                setShareMessage(message);
              }}
              className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-semibold"
            >
              Generate Share Link
            </button>
            {shareMessage && <p className="mt-2 text-xs text-neutral-200">{shareMessage}</p>}
          </div>
        </section>

        <section className="rounded border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-lg font-semibold">Ratings and Reviews</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <select value={reviewMovieId} onChange={(event) => setReviewMovieId(event.target.value)} className="rounded bg-black px-3 py-2 text-sm">
              {allMovies.slice(0, 40).map((movie) => (
                <option key={movie.id} value={String(movie.id)}>{movie.title}</option>
              ))}
            </select>
            <input type="number" min="1" max="10" value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} className="rounded bg-black px-3 py-2 text-sm" />
            <input value={reviewText} onChange={(event) => setReviewText(event.target.value)} placeholder="Write a short review" className="rounded bg-black px-3 py-2 text-sm md:col-span-2" />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!selectedMovie || !reviewText.trim()) return;
              onSaveReview(selectedMovie.id, { rating: reviewRating, text: reviewText.trim() });
              setReviewText('');
            }}
            className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-semibold"
          >
            Save Review
          </button>
          <div className="mt-4 space-y-2">
            {selectedMovieReviews.map((entry) => (
              <div key={entry.id} className="rounded border border-neutral-700 bg-black p-3 text-sm">
                <p className="font-semibold">{entry.rating}/10</p>
                <p className="text-neutral-300">{entry.text}</p>
              </div>
            ))}
            {!selectedMovieReviews.length && <p className="text-sm text-neutral-400">No reviews yet for this title.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function WatchHistoryPage({ allMovies, watchHistory, myList, onToggleList, onPlayItem }) {
  const navigate = useNavigate();
  const [modalItem, setModalItem] = useState(null);
  const [modalMode, setModalMode] = useState('info');
  const myListIds = useMemo(() => new Set(myList.map((item) => item.id)), [myList]);

  const historyItems = useMemo(() => {
    const lookup = new Map(allMovies.map((movie) => [String(movie.id), movie]));
    return watchHistory
      .map((id) => lookup.get(String(id)))
      .filter(Boolean);
  }, [allMovies, watchHistory]);

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto mt-16 w-full max-w-6xl">
        <h2 className="text-3xl font-bold">Watch History</h2>
        <p className="mt-2 text-neutral-300">Resume from titles you played recently.</p>
        {historyItems.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {historyItems.map((item) => (
              <MovieCard
                key={item.id}
                item={item}
                square
                inList={myListIds.has(item.id)}
                onToggleList={onToggleList}
                onOpen={(nextItem) => {
                  setModalMode('info');
                  setModalItem(nextItem);
                }}
                onPlay={(nextItem) => {
                  onPlayItem(nextItem);
                  navigate(`/watch/${nextItem.id}`);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="glass-panel mt-8 rounded-lg border border-neutral-800 bg-neutral-900/70 p-8 text-center">
            <p className="text-lg font-semibold">No watch history yet</p>
            <p className="mt-2 text-neutral-300">Start playing any title to build your history.</p>
          </div>
        )}
      </div>

      <Suspense fallback={null}>
        <DetailsModal
          item={modalItem}
          autoPlay={modalMode === 'play'}
          inList={modalItem ? myListIds.has(modalItem.id) : false}
          onToggleList={onToggleList}
          onResolveTrailer={resolveTrailerForItem}
          onClose={() => setModalItem(null)}
        />
      </Suspense>
    </div>
  );
}

// UserManagementPanel: admin table to search users and manage plans, status, and roles.
function UserManagementPanel({ user, title, subtitle, movies, myList, canManageRoles, canDeleteUsers }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState('');
  const [actionState, setActionState] = useState({});

  const movieCount = movies.filter((item) => item.type === 'movie').length;
  const showCount = movies.filter((item) => item.type === 'series').length;

  // Fetch users with optional search text from admin API.
  const loadUsers = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    setLoadingUsers(true);
    setErrorUsers('');
    try {
      const data = await fetchUsers({ actorId: user.id, search });
      setUsers(data);
    } catch (apiError) {
      setErrorUsers(apiError.message);
    } finally {
      setLoadingUsers(false);
    }
  }, [search, user?.id]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  // Store per-row loading/message state so each row updates independently.
  const setRowAction = (userId, value) => {
    setActionState((current) => ({
      ...current,
      [userId]: { ...current[userId], ...value },
    }));
  };

  // Update subscription plan for a selected user.
  const onPlanChange = async (targetUser, plan) => {
    setRowAction(targetUser.id, { busy: true, message: '' });
    try {
      const updated = await updateUserSubscription({
        actorId: user.id,
        userId: targetUser.id,
        plan,
        status: targetUser.subscription?.status || 'active',
      });
      setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setRowAction(targetUser.id, { busy: false, message: 'Plan updated.' });
    } catch (apiError) {
      setRowAction(targetUser.id, { busy: false, message: apiError.message });
    }
  };

  // Update subscription status (active/paused/cancelled) for a selected user.
  const onStatusChange = async (targetUser, status) => {
    setRowAction(targetUser.id, { busy: true, message: '' });
    try {
      const updated = await updateUserSubscription({
        actorId: user.id,
        userId: targetUser.id,
        plan: targetUser.subscription?.plan || 'basic',
        status,
      });
      setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setRowAction(targetUser.id, { busy: false, message: 'Status updated.' });
    } catch (apiError) {
      setRowAction(targetUser.id, { busy: false, message: apiError.message });
    }
  };

  // Update account role (user/admin/superadmin) for a selected user.
  const onRoleChange = async (targetUser, role) => {
    setRowAction(targetUser.id, { busy: true, message: '' });
    try {
      const updated = await updateUserRole({
        actorId: user.id,
        userId: targetUser.id,
        role,
      });
      setUsers((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setRowAction(targetUser.id, { busy: false, message: 'Role updated.' });
    } catch (apiError) {
      setRowAction(targetUser.id, { busy: false, message: apiError.message });
    }
  };

  // Permanently remove a user account (super admin only).
  const onDeleteUser = async (targetUser) => {
    setRowAction(targetUser.id, { busy: true, message: '' });
    try {
      await removeUser({
        actorId: user.id,
        userId: targetUser.id,
      });
      setUsers((current) => current.filter((entry) => entry.id !== targetUser.id));
    } catch (apiError) {
      setRowAction(targetUser.id, { busy: false, message: apiError.message });
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="glass-panel mx-auto mt-16 w-full max-w-6xl rounded-lg border border-neutral-800 bg-neutral-900 p-8">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-3 text-neutral-300">{subtitle}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-md border border-neutral-700 bg-neutral-950 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">All Titles</p>
            <p className="mt-1 text-2xl font-bold">{movies.length}</p>
          </div>
          <div className="rounded-md border border-neutral-700 bg-neutral-950 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Movies</p>
            <p className="mt-1 text-2xl font-bold">{movieCount}</p>
          </div>
          <div className="rounded-md border border-neutral-700 bg-neutral-950 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">Series</p>
            <p className="mt-1 text-2xl font-bold">{showCount}</p>
          </div>
          <div className="rounded-md border border-neutral-700 bg-neutral-950 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">My List</p>
            <p className="mt-1 text-2xl font-bold">{myList.length}</p>
          </div>
        </div>

        <section className="mt-8 rounded-md border border-neutral-700 bg-neutral-950 p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-semibold">User Management</h3>
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users by name or email"
                className="search-input-glass w-64 rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
              >
                Search
              </button>
            </div>
          </div>

          {loadingUsers && <p className="text-sm text-neutral-300">Loading users...</p>}
          {!loadingUsers && errorUsers && <p className="text-sm text-red-300">{errorUsers}</p>}

          {!loadingUsers && !errorUsers && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-neutral-700 text-neutral-300">
                  <tr>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Actions</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => {
                    const rowState = actionState[entry.id] || {};
                    return (
                      <tr key={entry.id} className="border-b border-neutral-800 align-top">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-white">{entry.name}</p>
                          <p className="text-neutral-400">{entry.email}</p>
                        </td>
                        <td className="px-3 py-3">
                          {canManageRoles ? (
                            <select
                              value={entry.role}
                              disabled={Boolean(rowState.busy)}
                              onChange={(event) => void onRoleChange(entry, event.target.value)}
                              className="rounded border border-neutral-700 bg-black px-2 py-1 text-white"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                              <option value="superadmin">superadmin</option>
                            </select>
                          ) : (
                            <span className="capitalize">{entry.role}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={entry.subscription?.plan || 'basic'}
                            disabled={Boolean(rowState.busy)}
                            onChange={(event) => void onPlanChange(entry, event.target.value)}
                            className="rounded border border-neutral-700 bg-black px-2 py-1 text-white"
                          >
                            <option value="mobile">mobile</option>
                            <option value="basic">basic</option>
                            <option value="standard">standard</option>
                            <option value="premium">premium</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={entry.subscription?.status || 'active'}
                            disabled={Boolean(rowState.busy)}
                            onChange={(event) => void onStatusChange(entry, event.target.value)}
                            className="rounded border border-neutral-700 bg-black px-2 py-1 text-white"
                          >
                            <option value="active">active</option>
                            <option value="paused">paused</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          {canDeleteUsers ? (
                            <button
                              type="button"
                              disabled={Boolean(rowState.busy)}
                              onClick={() => void onDeleteUser(entry)}
                              className="rounded border border-red-600 px-3 py-1 text-red-300 hover:bg-red-900/30 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-neutral-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-neutral-300">
                          {rowState.busy ? 'Saving...' : rowState.message || ''}
                        </td>
                      </tr>
                    );
                  })}
                  {!users.length && (
                    <tr>
                      <td className="px-3 py-4 text-neutral-400" colSpan={6}>
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// AdminPage: limited admin wrapper around the shared user management panel.
function AdminPage({ user, movies, myList }) {
  return (
    <div className="space-y-8">
      <UserManagementPanel
        user={user}
        title="Admin Dashboard"
        subtitle="Manage users, plans, and subscription status."
        movies={movies}
        myList={myList}
        canManageRoles={false}
        canDeleteUsers={false}
      />
      <AdminSuiteShowcase user={user} canManageRoles={false} canDeleteUsers={false} />
    </div>
  );
}

// SuperAdminPage: full-access admin wrapper for role changes and account deletion.
function SuperAdminPage({ user, movies, myList }) {
  return (
    <div className="space-y-8">
      <UserManagementPanel
        user={user}
        title="Super Admin Console"
        subtitle="Full control over users, roles, plans, and account lifecycle."
        movies={movies}
        myList={myList}
        canManageRoles
        canDeleteUsers
      />
      <AdminSuiteShowcase user={user} canManageRoles canDeleteUsers />
    </div>
  );
}

// ProtectedRoute: blocks guests and redirects them to login.
function ProtectedRoute({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// RoleRoute: blocks users below required role and redirects them home.
function RoleRoute({ user, minimumRole, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!canAccessRole(user, minimumRole)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// App: root component that loads data, persists state, and defines all routes.
function App() {
  // Global app data and UI state.
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(() => normalizeUser(readStorage(USER_KEY, null)));
  const [myList, setMyList] = useState(() => readStorage(LIST_KEY, []));
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...readStorage(SETTINGS_KEY, DEFAULT_SETTINGS),
  }));
  const [searchQuery, setSearchQuery] = useState('');
  const [watchProgress, setWatchProgress] = useState(() => readStorage(WATCH_PROGRESS_KEY, {}));
  const [watchHistory, setWatchHistory] = useState(() => readStorage(WATCH_HISTORY_KEY, []));
  const [profiles, setProfiles] = useState(() => {
    const saved = readStorage(PROFILES_KEY, []);
    if (Array.isArray(saved) && saved.length) {
      return saved;
    }
    return [{ id: 'profile-main', name: 'Main', kids: false }];
  });
  const [activeProfileId, setActiveProfileId] = useState(() => readStorage(ACTIVE_PROFILE_KEY, 'profile-main'));
  const [downloads, setDownloads] = useState(() => readStorage(DOWNLOADS_KEY, []));
  const [reviews, setReviews] = useState(() => readStorage(REVIEWS_KEY, {}));
  const [kidsPin, setKidsPin] = useState(() => readStorage(KIDS_PIN_KEY, ''));

  // Load movie catalog from backend when app starts.
  useEffect(() => {
    let mounted = true;

    async function loadMovies(isInitial = false) {
      if (isInitial) {
        setLoading(true);
      }
      setError('');
      try {
        const data = await fetchMovies({ limit: 500 });
        if (!mounted) {
          return;
        }
        setMovies(data);
      } catch {
        if (!mounted) {
          return;
        }
        setError('Unable to load movies from backend. Start server and check API URL.');
      } finally {
        if (mounted && isInitial) {
          setLoading(false);
        }
      }
    }

    loadMovies(true);
    return () => {
      mounted = false;
    };
  }, []);

  // Persist user session in localStorage.
  useEffect(() => {
    writeStorage(USER_KEY, user);
  }, [user]);

  // Persist My List in localStorage.
  useEffect(() => {
    writeStorage(LIST_KEY, myList);
  }, [myList]);

  // Persist settings in localStorage.
  useEffect(() => {
    writeStorage(SETTINGS_KEY, settings);
  }, [settings]);

  useEffect(() => {
    writeStorage(WATCH_PROGRESS_KEY, watchProgress);
  }, [watchProgress]);

  useEffect(() => {
    writeStorage(WATCH_HISTORY_KEY, watchHistory);
  }, [watchHistory]);
  useEffect(() => {
    writeStorage(PROFILES_KEY, profiles);
  }, [profiles]);
  useEffect(() => {
    writeStorage(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId]);
  useEffect(() => {
    writeStorage(DOWNLOADS_KEY, downloads);
  }, [downloads]);
  useEffect(() => {
    writeStorage(REVIEWS_KEY, reviews);
  }, [reviews]);
  useEffect(() => {
    writeStorage(KIDS_PIN_KEY, kidsPin);
  }, [kidsPin]);

  // Apply selected theme as CSS classes on the document root.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(settings.theme === 'light' ? 'theme-light' : 'theme-dark');
    root.style.colorScheme = settings.theme === 'light' ? 'light' : 'dark';
  }, [settings.theme]);

  // Add/remove a title from My List using immutable state updates.
  const onToggleList = useCallback((item) => {
    if (!item) {
      return;
    }

    setMyList((current) => {
      const exists = current.some((entry) => entry.id === item.id);
      if (exists) {
        return current.filter((entry) => entry.id !== item.id);
      }
      return [...current, item];
    });
  }, []);

  const onPlayItem = useCallback((item) => {
    if (!item?.id) {
      return;
    }
    const itemId = String(item.id);

    setWatchProgress((current) => {
      const previous = Number(current[itemId] || 0);
      const nextValue = Math.min(95, previous + 15);
      return { ...current, [itemId]: nextValue };
    });

    setWatchHistory((current) => {
      const deduped = current.filter((id) => String(id) !== itemId);
      return [itemId, ...deduped].slice(0, 50);
    });
  }, []);

  const onPlaybackProgress = useCallback((item, percent) => {
    if (!item?.id) {
      return;
    }
    const itemId = String(item.id);
    setWatchProgress((current) => ({ ...current, [itemId]: Math.max(0, Math.min(100, Number(percent) || 0)) }));
  }, []);

  const onAddProfile = useCallback((name, kids = false) => {
    const id = `profile-${Date.now()}`;
    setProfiles((current) => [...current, { id, name, kids }].slice(0, 8));
    setActiveProfileId(id);
  }, []);

  const onToggleDownload = useCallback((item) => {
    if (!item?.id) {
      return;
    }
    const itemId = String(item.id);
    setDownloads((current) => (
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId]
    ));
  }, []);

  const onSaveReview = useCallback((movieId, review) => {
    const id = `review-${Date.now()}`;
    setReviews((current) => ({
      ...current,
      [String(movieId)]: [{ id, ...review }, ...(current[String(movieId)] || [])].slice(0, 15),
    }));
  }, []);

  const onShareList = useCallback(() => {
    const ids = myList.map((item) => item.id).slice(0, 20).join('-');
    return `https://netflix-clone.local/share/${ids || 'empty-list'}`;
  }, [myList]);

  const sections = useMemo(() => groupByCategory(movies), [movies]);
  const topTenSection = useMemo(() => buildTopTenSection(movies), [movies]);
  const continueWatchingSection = useMemo(
    () => buildContinueWatchingSection(movies, watchProgress),
    [movies, watchProgress]
  );
  const historySection = useMemo(
    () => buildHistorySection(movies, watchHistory),
    [movies, watchHistory]
  );
  const recommendationSection = useMemo(
    () => buildRecommendationSection(movies, myList, watchHistory),
    [movies, myList, watchHistory]
  );
  const homeSections = useMemo(
    () => [
      continueWatchingSection,
      recommendationSection,
      topTenSection,
      historySection,
      ...sections,
    ].filter((section) => Array.isArray(section.items) && section.items.length > 0),
    [continueWatchingSection, historySection, recommendationSection, sections, topTenSection]
  );
  const myListSection = useMemo(
    () => [{ id: 'my-list', title: 'My List', items: myList }],
    [myList]
  );

  // Shared props passed to multiple route pages to avoid repetition.
  const sharedProps = {
    allMovies: movies,
    loading,
    error,
    myList,
    onToggleList,
    onPlayItem,
    user,
    onLogout: () => setUser(null),
    query: searchQuery,
    setQuery: setSearchQuery,
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="home" sections={homeSections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/movies"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="movies" sections={homeSections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tv-shows"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="shows" sections={homeSections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-popular"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="new" sections={homeSections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-list"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="home" sections={myListSection} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute user={user}>
            <SearchPage {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/watch/:contentId"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <WatchPlayerPage
                allMovies={movies}
                onPlaybackProgress={onPlaybackProgress}
                onMarkPlayed={onPlayItem}
              />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<LoginPage user={user} onLogin={(nextUser) => setUser(normalizeUser(nextUser))} movies={movies} />} />
      <Route
        path="/profile"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <ProfilePage
                user={user}
                onLogout={() => setUser(null)}
                myListCount={myList.length}
                historyCount={watchHistory.length}
                activeProfileName={(profiles.find((entry) => entry.id === activeProfileId) || profiles[0])?.name || 'Main'}
                downloadCount={downloads.length}
              />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/watch-history"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <WatchHistoryPage
                allMovies={movies}
                watchHistory={watchHistory}
                myList={myList}
                onToggleList={onToggleList}
                onPlayItem={onPlayItem}
              />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/experience"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <UserExperienceHub
                user={user}
                movies={movies}
                myList={myList}
                settings={settings}
                onToggleList={onToggleList}
              />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/feature-lab"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <FeatureLabPage
                allMovies={movies}
                myList={myList}
                profiles={profiles}
                activeProfileId={activeProfileId}
                onSwitchProfile={setActiveProfileId}
                onAddProfile={onAddProfile}
                kidsPin={kidsPin}
                setKidsPin={setKidsPin}
                downloads={downloads}
                onToggleDownload={onToggleDownload}
                reviews={reviews}
                onSaveReview={onSaveReview}
                onShareList={onShareList}
              />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <HelpPage />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <Settings
                user={user}
                settings={settings}
                onSave={(nextSettings) => setSettings((current) => ({ ...current, ...nextSettings }))}
                onUserUpdate={(nextUser) => setUser(normalizeUser(nextUser))}
                onUpdateProfile={updateProfile}
                onUpdatePassword={updatePassword}
              />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscription"
        element={
          <ProtectedRoute user={user}>
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <Subscription user={user} onUserUpdate={(nextUser) => setUser(normalizeUser(nextUser))} />
            </AppPageLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <RoleRoute user={user} minimumRole="admin">
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <AdminPage user={user} movies={movies} myList={myList} />
            </AppPageLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/super-admin"
        element={
          <RoleRoute user={user} minimumRole="superadmin">
            <AppPageLayout
              user={user}
              onLogout={() => setUser(null)}
              query={searchQuery}
              setQuery={setSearchQuery}
            >
              <SuperAdminPage user={user} movies={movies} myList={myList} />
            </AppPageLayout>
          </RoleRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default App;

