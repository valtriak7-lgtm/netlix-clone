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
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { loginUser, registerUser, updatePassword, updateProfile } from './api/authApi';
import { fetchUsers, removeUser, updateUserRole, updateUserSubscription } from './api/adminApi';
import { fetchMovies, fetchTmdbTrailer } from './api/moviesApi';
import Settings from './components/Settings';
import Subscription from './components/Subscription';
import './App.css';

// Lazy-loaded components are downloaded only when needed to keep initial load faster.
const DetailsModal = lazy(() => import('./components/DetailsModal'));
const TrailerSlider = lazy(() => import('./components/TrailerSlider'));

// localStorage keys used to persist app data between page refreshes.
const USER_KEY = 'netflix_user';
const LIST_KEY = 'netflix_my_list';
const SETTINGS_KEY = 'netflix_settings';

// Main header navigation links shown at the top of the app.
const NAV_ITEMS = [
  { to: '/', label: 'Home' },
  { to: '/tv-shows', label: 'TV Shows' },
  { to: '/movies', label: 'Movies' },
  { to: '/new-popular', label: 'New & Popular' },
  { to: '/my-list', label: 'My List' },
];
// Public image URLs used for branding and default profile visuals.
const NETFLIX_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg';
const DEFAULT_NETFLIX_PROFILE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Netflix_2015_N_logo.svg';
const CUSTOM_PROFILE_AVATAR_URL = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Cdefs%3E%3ClinearGradient id=%22bg%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop offset=%220%25%22 stop-color=%22%230b0b0b%22/%3E%3Cstop offset=%22100%25%22 stop-color=%22%23202020%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22200%22 height=%22200%22 rx=%2224%22 fill=%22url(%23bg)%22/%3E%3Ccircle cx=%22100%22 cy=%2284%22 r=%2235%22 fill=%22%23e50914%22/%3E%3Crect x=%2248%22 y=%22128%22 width=%22104%22 height=%2244%22 rx=%2222%22 fill=%22%23e50914%22/%3E%3C/svg%3E';

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
    </div>
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

// Footer: simple footer with static help/account links.
function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/70 px-4 py-10 text-neutral-400 backdrop-blur-md sm:px-8">
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
function HomePage({ view, sections, allMovies, loading, error, myList, onToggleList, user, onLogout, query, setQuery }) {
  const location = useLocation();
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
          items = items.filter((item) => item.title.toLowerCase().includes(lowered));
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
                  setModalMode('play');
                  setModalItem(activeHero || featured);
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
          {loading && <p className="py-10 text-center text-neutral-300">Loading titles...</p>}
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
                    setModalMode('play');
                    setModalItem(item);
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
function SearchPage({ allMovies, loading, error, myList, onToggleList, user, onLogout, query, setQuery }) {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
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
      return searchable.includes(loweredQuery);
    });

    if (sortBy === 'newest') {
      items = [...items].sort((a, b) => b.year - a.year);
    } else if (sortBy === 'oldest') {
      items = [...items].sort((a, b) => a.year - b.year);
    } else if (sortBy === 'a-z') {
      items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    }

    return items;
  }, [categoryFilter, deferredQuery, listFilter, myListIds, reloadedItems, sortBy, typeFilter, yearFilter]);

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
                      setModalMode('play');
                      setModalItem(nextItem);
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

      onLogin(normalizeUser(authUser));
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
          <h2 className="mt-8 text-4xl font-bold">{mode === 'signup' ? 'Create Account' : 'Sign In'}</h2>
          <p className="mt-2 text-sm text-neutral-400">
            {mode === 'signup'
              ? 'Join now and continue watching where you left off.'
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
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded bg-neutral-800 px-4 py-3 text-sm text-white outline-none ring-red-600 focus:ring-2"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-red-600 py-3 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-sm text-neutral-300">
            {mode === 'signup' ? 'Already have an account?' : 'New to Netflix?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
                setError('');
              }}
              className="font-semibold text-white underline-offset-2 hover:underline"
            >
              {mode === 'signup' ? 'Sign in now' : 'Create one'}
            </button>
          </p>
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
function ProfilePage({ user, onLogout, myListCount }) {
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
        </div>
        <div className="mt-7 flex gap-3">
          <NavLink to="/my-list" className="cta-shimmer soft-ring rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-neutral-200">
            Open My List
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
    <UserManagementPanel
      user={user}
      title="Admin Dashboard"
      subtitle="Manage users, plans, and subscription status."
      movies={movies}
      myList={myList}
      canManageRoles={false}
      canDeleteUsers={false}
    />
  );
}

// SuperAdminPage: full-access admin wrapper for role changes and account deletion.
function SuperAdminPage({ user, movies, myList }) {
  return (
    <UserManagementPanel
      user={user}
      title="Super Admin Console"
      subtitle="Full control over users, roles, plans, and account lifecycle."
      movies={movies}
      myList={myList}
      canManageRoles
      canDeleteUsers
    />
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

  const sections = useMemo(() => groupByCategory(movies), [movies]);
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
            <HomePage view="home" sections={sections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/movies"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="movies" sections={sections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tv-shows"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="shows" sections={sections} {...sharedProps} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/new-popular"
        element={
          <ProtectedRoute user={user}>
            <HomePage view="new" sections={sections} {...sharedProps} />
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
              <ProfilePage user={user} onLogout={() => setUser(null)} myListCount={myList.length} />
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

