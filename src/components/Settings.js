// File purpose: Application logic for this Netflix Clone module.
import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_NETFLIX_PROFILE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Netflix_2015_N_logo.svg';
const CUSTOM_PROFILE_AVATAR_URL = 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Cdefs%3E%3ClinearGradient id=%22bg%22 x1=%220%22 y1=%220%22 x2=%221%22 y2=%221%22%3E%3Cstop offset=%220%25%22 stop-color=%22%230b0b0b%22/%3E%3Cstop offset=%22100%25%22 stop-color=%22%23202020%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%22200%22 height=%22200%22 rx=%2224%22 fill=%22url(%23bg)%22/%3E%3Ccircle cx=%22100%22 cy=%2284%22 r=%2235%22 fill=%22%23e50914%22/%3E%3Crect x=%2248%22 y=%22128%22 width=%22104%22 height=%2244%22 rx=%2222%22 fill=%22%23e50914%22/%3E%3C/svg%3E';
const MAX_AVATAR_DIMENSION = 1024;
const MAX_AVATAR_BYTES = 7 * 1024 * 1024;
const CROP_PREVIEW_SIZE = 320;
const CROP_OUTPUT_SIZE = 512;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read this image. Try another file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not process this image. Try another file.'));
    image.src = dataUrl;
  });
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = (dataUrl.split(',')[1] || '').trim();
  return Math.ceil((base64.length * 3) / 4);
}

async function optimizeAvatarFromFile(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);

  const longestEdge = Math.max(image.width, image.height);
  const scale = longestEdge > MAX_AVATAR_DIMENSION ? MAX_AVATAR_DIMENSION / longestEdge : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return originalDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = 0.92;
  let optimized = canvas.toDataURL('image/jpeg', quality);

  while (estimateDataUrlBytes(optimized) > MAX_AVATAR_BYTES && quality > 0.45) {
    quality -= 0.08;
    optimized = canvas.toDataURL('image/jpeg', quality);
  }

  return optimized;
}

function AvatarCropperModal({
  source,
  zoom,
  panX,
  panY,
  onZoomChange,
  onPanXChange,
  onPanYChange,
  onCancel,
  onApply,
}) {
  if (!source) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-xl rounded-xl border border-white/20 bg-neutral-900/70 p-5">
        <h4 className="text-lg font-semibold text-white">Crop Profile Photo</h4>
        <p className="mt-1 text-sm text-neutral-300">Adjust and save the exact profile area.</p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative overflow-hidden rounded-lg border border-white/20 bg-black"
            style={{ width: CROP_PREVIEW_SIZE, height: CROP_PREVIEW_SIZE }}
          >
            <img
              src={source}
              alt="Crop source"
              className="h-full w-full object-cover"
              style={{
                transform: `scale(${zoom}) translate(${panX}%, ${panY}%)`,
                transformOrigin: 'center center',
              }}
            />
            <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm text-neutral-300">
            Zoom
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => onZoomChange(Number(event.target.value))}
              className="mt-1 w-full accent-red-600"
            />
          </label>
          <label className="block text-sm text-neutral-300">
            Horizontal Position
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={panX}
              onChange={(event) => onPanXChange(Number(event.target.value))}
              className="mt-1 w-full accent-red-600"
            />
          </label>
          <label className="block text-sm text-neutral-300">
            Vertical Position
            <input
              type="range"
              min="-100"
              max="100"
              step="1"
              value={panY}
              onChange={(event) => onPanYChange(Number(event.target.value))}
              className="mt-1 w-full accent-red-600"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded bg-red-600 py-2 font-semibold text-white hover:bg-red-500"
          >
            Apply Crop
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-neutral-500 px-4 py-2 text-sm font-semibold text-white hover:border-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

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
    profileId: user?.profileId || '',
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
  const avatarInputRef = useRef(null);
  const [cropSource, setCropSource] = useState('');
  const [cropZoom, setCropZoom] = useState(1.2);
  const [cropPanX, setCropPanX] = useState(0);
  const [cropPanY, setCropPanY] = useState(0);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setProfileForm({
      profileId: user?.profileId || '',
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
      (profileForm.profileId || '').trim().toLowerCase() !== (user?.profileId || '').trim().toLowerCase() ||
      (profileForm.avatar || '').trim() !== (user?.avatar || '').trim(),
    [profileForm, user]
  );

  const onSelectAvatarFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for avatar.');
      event.target.value = '';
      return;
    }

    setError('');
    setMessage('Processing image...');
    try {
      const result = await optimizeAvatarFromFile(file);
      if (result) {
        setCropSource(result);
        setCropZoom(1.2);
        setCropPanX(0);
        setCropPanY(0);
        setMessage('Image loaded. Adjust crop and apply.');
      } else {
        setMessage('');
        setError('Could not process this image. Try another file.');
      }
    } catch (uploadError) {
      setMessage('');
      setError(uploadError.message || 'Could not process this image. Try another file.');
    } finally {
      event.target.value = '';
    }
  };

  const onApplyCrop = async () => {
    try {
      const image = await loadImage(cropSource);
      const canvas = document.createElement('canvas');
      canvas.width = CROP_OUTPUT_SIZE;
      canvas.height = CROP_OUTPUT_SIZE;
      const context = canvas.getContext('2d');
      if (!context) {
        setError('Could not finalize crop. Please try again.');
        return;
      }

      const baseScale = Math.max(CROP_OUTPUT_SIZE / image.width, CROP_OUTPUT_SIZE / image.height);
      const scaledWidth = image.width * baseScale * cropZoom;
      const scaledHeight = image.height * baseScale * cropZoom;
      const maxPanX = Math.max(0, (scaledWidth - CROP_OUTPUT_SIZE) / 2);
      const maxPanY = Math.max(0, (scaledHeight - CROP_OUTPUT_SIZE) / 2);
      const offsetX = (CROP_OUTPUT_SIZE - scaledWidth) / 2 + (cropPanX / 100) * maxPanX;
      const offsetY = (CROP_OUTPUT_SIZE - scaledHeight) / 2 + (cropPanY / 100) * maxPanY;

      context.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
      const cropped = canvas.toDataURL('image/jpeg', 0.9);
      setProfileForm((current) => ({ ...current, avatar: cropped }));
      setCropSource('');
      setMessage('Cropped image ready. Click Update Profile to save.');
      setError('');
    } catch {
      setError('Could not finalize crop. Please try another image.');
    }
  };

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
        profileId: profileForm.profileId.trim(),
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
    <div className="settings-shell min-h-screen bg-black px-4 py-10 text-white">
      <div className="settings-panel glass-panel mx-auto mt-16 w-full max-w-3xl rounded-lg border border-neutral-800 bg-neutral-900 p-8 shadow-lg">
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="mt-2 text-sm text-neutral-400">Everything below is functional and saved.</p>

        <section className="settings-section mt-8 border-t border-neutral-800 pt-6">
          <h3 className="text-xl font-semibold">Profile</h3>
          <form onSubmit={onSubmitProfile} className="mt-4 space-y-4">
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/15 bg-black/30 p-5">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="group relative h-36 w-36 overflow-hidden rounded-full border-2 border-white/30 bg-black/40 ring-2 ring-red-500/20 focus:outline-none sm:h-40 sm:w-40"
                aria-label="Open profile photo picker"
              >
                <img
                  src={profileForm.avatar || DEFAULT_NETFLIX_PROFILE_URL}
                  alt="Profile photo"
                  className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold tracking-wide text-white opacity-0 transition group-hover:opacity-100">
                  Change Photo
                </span>
              </button>
              <p className="text-xs text-neutral-300">Tap the big profile icon to choose and crop a photo.</p>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="rounded border border-neutral-500 px-4 py-2 text-sm font-semibold hover:border-white"
              >
                Choose From Device
              </button>
            </div>
            <input
              type="text"
              value={profileForm.profileId}
              onChange={(event) => setProfileForm((current) => ({ ...current, profileId: event.target.value }))}
              placeholder="Profile ID (e.g. john_doe)"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-2"
            />
            <p className="text-xs text-neutral-400">Profile ID is your editable account handle (3-24 chars).</p>
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
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onSelectAvatarFile}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProfileForm((current) => ({ ...current, avatar: DEFAULT_NETFLIX_PROFILE_URL }))}
                className="rounded border border-neutral-600 px-3 py-1.5 text-xs hover:border-white"
              >
                Use Netflix Avatar
              </button>
              <button
                type="button"
                onClick={() => setProfileForm((current) => ({ ...current, avatar: CUSTOM_PROFILE_AVATAR_URL }))}
                className="rounded border border-neutral-600 px-3 py-1.5 text-xs hover:border-white"
              >
                Use Custom Avatar
              </button>
            </div>
            <button
              type="submit"
              disabled={!hasProfileChanges || profileSaving}
              className="w-full rounded bg-red-600 py-2 font-semibold transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {profileSaving ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </section>

        <section className="settings-section mt-8 border-t border-neutral-800 pt-6">
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

        <section className="settings-section mt-8 border-t border-neutral-800 pt-6">
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

        <section className="settings-section mt-8 border-t border-neutral-800 pt-6">
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

        <section className="settings-section mt-8 border-t border-neutral-800 pt-6">
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

        <section className="settings-section mt-8 border-t border-neutral-800 pt-6">
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
      <AvatarCropperModal
        source={cropSource}
        zoom={cropZoom}
        panX={cropPanX}
        panY={cropPanY}
        onZoomChange={setCropZoom}
        onPanXChange={setCropPanX}
        onPanYChange={setCropPanY}
        onCancel={() => {
          setCropSource('');
          setMessage('Crop canceled.');
        }}
        onApply={onApplyCrop}
      />
    </div>
  );
}

export default Settings;
