// File purpose: Application logic for this Netflix Clone module.
import { useEffect, useMemo, useState } from 'react';

function Settings({
  user,
  settings,
  onSave,
  onUserUpdate,
  onUpdateProfile,
  onUpdatePassword,
}) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
      avatar: user?.avatar || '',
    });
  }, [user]);

  const update = (key, value) => {
    const next = { ...draft, [key]: value };
    setSaved(false);
    setDraft(next);
    onSave(next);
  };

  const hasProfileChanges = useMemo(
    () =>
      (profileForm.name || '').trim() !== (user?.name || '').trim() ||
      (profileForm.email || '').trim().toLowerCase() !== (user?.email || '').trim().toLowerCase() ||
      (profileForm.avatar || '').trim() !== (user?.avatar || '').trim(),
    [profileForm, user]
  );

  const onSubmitProfile = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!user?.id) {
      setError('User session missing. Please login again.');
      return;
    }

    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      setError('Name and email are required.');
      return;
    }

    setProfileSaving(true);
    try {
      const updated = await onUpdateProfile({
        userId: user.id,
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        avatar: profileForm.avatar.trim(),
      });
      onUserUpdate(updated);
      setMessage('Profile updated successfully.');
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const onSubmitPassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!user?.id) {
      setError('User session missing. Please login again.');
      return;
    }

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('Fill all password fields.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await onUpdatePassword({
        userId: user.id,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password updated successfully.');
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto mt-16 w-full max-w-3xl rounded-lg border border-neutral-800 bg-neutral-900 p-8 shadow-lg">
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="mt-2 text-sm text-neutral-400">Everything below is functional and saved.</p>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Profile</h3>
          <form onSubmit={onSubmitProfile} className="mt-4 space-y-4">
            <input
              type="text"
              value={profileForm.name}
              onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Display name"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <input
              type="email"
              value={profileForm.email}
              onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <input
              type="url"
              value={profileForm.avatar}
              onChange={(event) => setProfileForm((current) => ({ ...current, avatar: event.target.value }))}
              placeholder="Avatar URL (optional)"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <button
              type="submit"
              disabled={!hasProfileChanges || profileSaving}
              className="w-full rounded bg-red-600 py-2 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileSaving ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </section>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Password</h3>
          <form onSubmit={onSubmitPassword} className="mt-4 space-y-4">
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              placeholder="Current password"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              placeholder="New password"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              placeholder="Confirm new password"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full rounded bg-red-600 py-2 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Theme</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => update('theme', 'dark')}
              className={`rounded border px-4 py-3 text-left transition ${
                draft.theme === 'dark' ? 'border-white bg-neutral-800' : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
              }`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => update('theme', 'light')}
              className={`rounded border px-4 py-3 text-left transition ${
                draft.theme === 'light' ? 'border-white bg-neutral-800' : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
              }`}
            >
              Light
            </button>
          </div>
        </section>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Playback</h3>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Autoplay next episode</span>
              <input
                type="checkbox"
                checked={draft.autoplay}
                onChange={(event) => update('autoplay', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Autoplay previews</span>
              <input
                type="checkbox"
                checked={draft.autoplayPreview}
                onChange={(event) => update('autoplayPreview', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Data saver mode</span>
              <input
                type="checkbox"
                checked={draft.dataSaver}
                onChange={(event) => update('dataSaver', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
            <div>
              <label className="mb-2 block text-sm text-neutral-300">Playback Quality</label>
              <select
                value={draft.playbackQuality}
                onChange={(event) => update('playbackQuality', event.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
              >
                <option value="auto">Auto</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="data-saver">Data Saver</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Preferences</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-neutral-300">Display Language</label>
              <select
                value={draft.language}
                onChange={(event) => update('language', event.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
              >
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="spanish">Spanish</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-neutral-300">Subtitle Language</label>
              <select
                value={draft.subtitleLanguage}
                onChange={(event) => update('subtitleLanguage', event.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
              >
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="spanish">Spanish</option>
                <option value="french">French</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-neutral-300">Maturity Rating</label>
              <select
                value={draft.maturityLevel}
                onChange={(event) => update('maturityLevel', event.target.value)}
                className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
              >
                <option value="7+">7+</option>
                <option value="13+">13+</option>
                <option value="16+">16+</option>
                <option value="18+">18+</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Privacy & Security</h3>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Profile Visibility</span>
              <select
                value={draft.profileVisibility}
                onChange={(event) => update('profileVisibility', event.target.value)}
                className="rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm"
              >
                <option value="private">Private</option>
                <option value="friends">Friends</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Two-factor authentication</span>
              <input
                type="checkbox"
                checked={draft.twoFactor}
                onChange={(event) => update('twoFactor', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Email login alerts</span>
              <input
                type="checkbox"
                checked={draft.loginAlerts}
                onChange={(event) => update('loginAlerts', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Profile lock with PIN</span>
              <input
                type="checkbox"
                checked={draft.profileLock}
                onChange={(event) => update('profileLock', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
            <label className="flex items-center justify-between rounded border border-neutral-800 bg-neutral-800/60 px-4 py-3">
              <span className="text-sm">Download only on Wi-Fi</span>
              <input
                type="checkbox"
                checked={draft.downloadOnWifiOnly}
                onChange={(event) => update('downloadOnWifiOnly', event.target.checked)}
                className="h-4 w-4 accent-red-600"
              />
            </label>
          </div>
        </section>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              setSaved(true);
              setMessage('Settings saved.');
            }}
            className="flex-1 rounded bg-red-600 py-3 font-semibold transition hover:bg-red-500"
          >
            Save Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(settings);
              onSave(settings);
              setSaved(false);
              setMessage('Changes reset.');
            }}
            className="rounded border border-neutral-600 px-4 py-3 font-semibold text-neutral-200 hover:border-white"
          >
            Reset
          </button>
        </div>
        {saved && <p className="mt-3 text-center text-sm text-green-400">Settings saved successfully.</p>}
        {message && <p className="mt-2 text-center text-sm text-neutral-300">{message}</p>}
        {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export default Settings;
