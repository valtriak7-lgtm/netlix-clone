import { useMemo, useState } from 'react';

const USER_FEATURES = [
  'Personal dashboard snapshot',
  'Mood-based quick picks',
  'Smart continue watching',
  'My List health score',
  'Weekend binge planner',
  'Watch-time goals tracker',
  'Streak and rewards badges',
  'Offline download planner',
  'Language preference mixer',
  'Playback profile switcher',
  'Family profile hints',
  'Genre heatmap cards',
  'Release reminder simulator',
  'Personalized mini analytics',
  'One-click watch challenge',
];

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}

function UserExperienceHub({ user, movies, myList, settings, onToggleList }) {
  const [goalHours, setGoalHours] = useState(6);
  const [sessionHours, setSessionHours] = useState(2.5);
  const [challengeGenre, setChallengeGenre] = useState('Drama');
  const [challengeDone, setChallengeDone] = useState(0);
  const [releaseReminder, setReleaseReminder] = useState('');

  const movieCount = movies.filter((item) => item.type === 'movie').length;
  const seriesCount = movies.filter((item) => item.type === 'series').length;
  const listHealth = Math.min(100, Math.round((myList.length / Math.max(1, movies.length)) * 500));
  const streakDays = Math.min(45, Math.max(3, Math.round(sessionHours * 4)));
  const profileLevel = streakDays > 25 ? 'Platinum Viewer' : streakDays > 12 ? 'Gold Viewer' : 'Rising Viewer';
  const preferredLanguage = settings?.language || 'english';
  const autoplayMode = settings?.autoplay ? 'On' : 'Off';
  const goalProgress = Math.min(100, Math.round((sessionHours / Math.max(1, goalHours)) * 100));

  const moodPicks = useMemo(() => {
    const picks = movies.slice(0, 12);
    return {
      Chill: picks.filter((item, idx) => idx % 3 === 0).slice(0, 4),
      Intense: picks.filter((item, idx) => idx % 3 === 1).slice(0, 4),
      FeelGood: picks.filter((item, idx) => idx % 3 === 2).slice(0, 4),
    };
  }, [movies]);

  const challengePool = useMemo(
    () => movies.filter((item) => String(item.category || '').toLowerCase().includes(challengeGenre.toLowerCase())).slice(0, 5),
    [movies, challengeGenre]
  );

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="glass-panel mx-auto mt-16 w-full max-w-7xl rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">User Power Hub</h2>
            <p className="mt-1 text-sm text-neutral-300">Premium user-level feature showcase built for demo and presentation.</p>
          </div>
          <div className="rounded border border-red-700 bg-red-900/20 px-3 py-2 text-xs text-red-100">
            Viewer: {user?.name || 'Guest'} | Level: {profileLevel}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {USER_FEATURES.map((item, index) => (
            <div key={item} className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200">
              <span className="mr-2 text-red-400">#{index + 1}</span>
              {item}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Metric label="Movies" value={movieCount} />
          <Metric label="Series" value={seriesCount} />
          <Metric label="My List" value={myList.length} />
          <Metric label="List Health" value={`${listHealth}%`} />
          <Metric label="Streak" value={`${streakDays} days`} />
          <Metric label="Autoplay" value={autoplayMode} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
            <h3 className="mb-3 text-lg font-semibold">Mood Picks</h3>
            {Object.entries(moodPicks).map(([mood, list]) => (
              <div key={mood} className="mb-3">
                <p className="mb-2 text-xs uppercase tracking-wide text-neutral-400">{mood}</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleList(item)}
                      className="rounded border border-neutral-700 bg-black px-3 py-1 text-xs hover:border-red-500"
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
            <h3 className="mb-3 text-lg font-semibold">Watch Goal Tracker</h3>
            <div className="grid grid-cols-1 gap-2">
              <label className="text-xs text-neutral-400">Weekly Goal (hours)</label>
              <input type="number" value={goalHours} onChange={(e) => setGoalHours(Number(e.target.value) || 1)} className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
              <label className="text-xs text-neutral-400">Completed (hours)</label>
              <input type="number" step="0.5" value={sessionHours} onChange={(e) => setSessionHours(Number(e.target.value) || 0)} className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
              <div className="mt-2 h-3 rounded bg-neutral-800">
                <div className="h-3 rounded bg-red-600" style={{ width: `${goalProgress}%` }} />
              </div>
              <p className="text-xs text-neutral-300">Progress: {goalProgress}%</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
            <h3 className="mb-3 text-lg font-semibold">One-Click Watch Challenge</h3>
            <div className="mb-3 flex items-center gap-2">
              <input value={challengeGenre} onChange={(e) => setChallengeGenre(e.target.value)} placeholder="Genre keyword" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
              <button type="button" onClick={() => setChallengeDone((current) => Math.min(5, current + 1))} className="rounded bg-red-600 px-3 py-2 text-sm font-semibold">Complete 1</button>
            </div>
            <p className="mb-2 text-xs text-neutral-300">Progress: {challengeDone}/5 titles</p>
            <div className="space-y-2">
              {challengePool.map((item) => (
                <div key={item.id} className="rounded border border-neutral-800 bg-black px-3 py-2 text-sm">{item.title}</div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
            <h3 className="mb-3 text-lg font-semibold">Release Reminder Simulator</h3>
            <input value={releaseReminder} onChange={(e) => setReleaseReminder(e.target.value)} placeholder="Type any upcoming title..." className="w-full rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
            <div className="mt-4 rounded border border-neutral-800 bg-black p-3 text-sm text-neutral-200">
              {releaseReminder
                ? `Reminder set: "${releaseReminder}" alert enabled for ${preferredLanguage} profile.`
                : 'No reminder set yet.'}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-neutral-800 bg-black px-3 py-2">Offline Plan: 5 titles</div>
              <div className="rounded border border-neutral-800 bg-black px-3 py-2">Data Saver: {settings?.dataSaver ? 'On' : 'Off'}</div>
              <div className="rounded border border-neutral-800 bg-black px-3 py-2">Subtitle Lang: {settings?.subtitleLanguage || 'english'}</div>
              <div className="rounded border border-neutral-800 bg-black px-3 py-2">Playback: {settings?.playbackQuality || 'auto'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserExperienceHub;
