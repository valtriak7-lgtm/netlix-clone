import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addEpisodeToSeason,
  addSeasonToContent,
  bulkUploadAdminContent,
  createAdminContent,
  fetchUsers,
  generateInvoice,
  getContentPerformance,
  getDashboardMetrics,
  getFailedPayments,
  getPromotions,
  getRealtimeMonitoring,
  getSubscriptionPlans,
  getUserEngagement,
  listAdminContent,
  removeUser,
  resetManagedUserPassword,
  savePromotion,
  saveSubscriptionPlan,
  setUserSuspension,
  terminateManagedUser,
  updateAdminVideoAssets,
  updateContentOrganization,
  updateUserRole,
  updateUserSubscription,
} from '../api/adminApi';

const TABS = ['Dashboard', 'Content', 'Video', 'Users', 'Billing', 'Analytics'];

const SHOWCASE_FEATURES = [
  'Multi-role admin scopes',
  'Executive KPI dashboard',
  'Realtime infra monitoring',
  'Alert center ticker',
  'Quick command center',
  'Content creation studio',
  'Bulk CSV ingestion',
  'Smart content library filters',
  'Season planner for series',
  'Episode scheduler + ordering',
  'Featured rotation controls',
  'Collections/category organizer',
  'Video source pipeline manager',
  'Quality variants management',
  'Subtitle & audio track manager',
  'Subscriber lookup + plan filter',
  'Watch/download/payment history ready',
  'Suspend/reactivate controls',
  'Account termination controls',
  'Managed password reset',
  'Plan builder with features',
  'Promo & free trial engine',
  'Invoice generation center',
  'Failed payment tracking',
  'Content performance + engagement analytics',
];

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}

function MiniBar({ label, value, max = 100 }) {
  const width = Math.max(4, Math.min(100, Math.round((Number(value || 0) / max) * 100)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-neutral-300">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded bg-neutral-800">
        <div className="h-2 rounded bg-red-600" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function AdminSuiteShowcase({ user, canManageRoles, canDeleteUsers }) {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [metrics, setMetrics] = useState({});
  const [monitor, setMonitor] = useState({});
  const [contentRows, setContentRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [failedPayments, setFailedPayments] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [engagement, setEngagement] = useState({});
  const [searchContent, setSearchContent] = useState('');
  const [searchUsers, setSearchUsers] = useState('');
  const [contentDraft, setContentDraft] = useState({ title: '', type: 'movie', category: 'Featured', description: '' });
  const [bulkCsv, setBulkCsv] = useState('title,type,category,description\nShowcase Title,movie,Featured,Premium showcase content');
  const [seasonDraft, setSeasonDraft] = useState({ contentId: '', seasonNumber: 1, title: '' });
  const [episodeDraft, setEpisodeDraft] = useState({ contentId: '', seasonNumber: 1, episodeNumber: 1, title: '' });
  const [videoDraft, setVideoDraft] = useState({ contentId: '', sourceUrl: '', formats: 'mp4,mkv', qualityVariants: '360p,720p,1080p', subtitles: 'en.vtt,hi.vtt', audioTracks: 'English,Hindi' });
  const [orgDraft, setOrgDraft] = useState({ contentId: '', collections: 'Trending,Top Picks', categoryOverrides: 'Featured', featured: true, featuredRank: 1 });
  const [planDraft, setPlanDraft] = useState({ id: 'ultra', name: 'Ultra', price: 899, currency: 'INR', features: '4K HDR,8 screens,Spatial Audio' });
  const [promoDraft, setPromoDraft] = useState({ code: 'FLEX50', discountPercent: 50, freeTrialDays: 14, partner: 'Campus Partner', season: 'Summer' });
  const [invoiceDraft, setInvoiceDraft] = useState({ userId: '', amount: 499, currency: 'INR', plan: 'standard', status: 'paid' });

  const actorId = user?.id;
  const isSuperAdmin = user?.role === 'superadmin';

  const loadCore = useCallback(async () => {
    if (!actorId) return;
    try {
      const [m, mon] = await Promise.all([
        getDashboardMetrics({ actorId }),
        getRealtimeMonitoring({ actorId }),
      ]);
      setMetrics(m || {});
      setMonitor(mon || {});
    } catch {
      setStatus('Core dashboard data failed to load.');
    }
  }, [actorId]);

  const loadDataByTab = useCallback(async (tab) => {
    if (!actorId) return;
    try {
      if (tab === 'Content') {
        const rows = await listAdminContent({ actorId, search: searchContent });
        setContentRows(rows);
      }
      if (tab === 'Users') {
        const rows = await fetchUsers({ actorId, search: searchUsers });
        setUsers(rows);
      }
      if (tab === 'Billing') {
        const [planRows, promoRows, failedRows] = await Promise.all([
          getSubscriptionPlans({ actorId }),
          getPromotions({ actorId }),
          getFailedPayments({ actorId }),
        ]);
        setPlans(planRows);
        setPromotions(promoRows);
        setFailedPayments(failedRows);
      }
      if (tab === 'Analytics') {
        const [perf, engage] = await Promise.all([
          getContentPerformance({ actorId }),
          getUserEngagement({ actorId }),
        ]);
        setPerformance(perf);
        setEngagement(engage || {});
      }
    } catch {
      setStatus(`Unable to load ${tab.toLowerCase()} data.`);
    }
  }, [actorId, searchContent, searchUsers]);

  useEffect(() => {
    void loadCore();
    const timer = setInterval(() => {
      void loadCore();
    }, 15000);
    return () => clearInterval(timer);
  }, [loadCore]);

  useEffect(() => {
    void loadDataByTab(activeTab);
  }, [activeTab, loadDataByTab]);

  const topFivePerformance = useMemo(() => performance.slice(0, 5), [performance]);

  const runAction = async (fn, message, reloadTab = true) => {
    if (!actorId) return;
    setBusy(true);
    setStatus('');
    try {
      await fn();
      setStatus(message);
      if (reloadTab) {
        await loadDataByTab(activeTab);
      }
    } catch (error) {
      setStatus(error.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="glass-panel mx-auto mt-16 w-full max-w-7xl rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold">Admin Feature Command Center</h2>
            <p className="mt-1 text-sm text-neutral-300">25 visible enterprise-style features for project demo and viva presentation.</p>
          </div>
          <div className="rounded border border-red-700 bg-red-900/20 px-3 py-2 text-xs text-red-100">
            Role: {user?.role || 'admin'} | Scope: {user?.adminScope || (isSuperAdmin ? 'full_access' : 'content_manager')}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SHOWCASE_FEATURES.map((item, index) => (
            <div key={item} className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-200">
              <span className="mr-2 text-red-400">#{index + 1}</span>
              {item}
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded border px-4 py-2 text-sm font-semibold ${
                activeTab === tab
                  ? 'border-red-500 bg-red-600 text-white'
                  : 'border-neutral-700 bg-black text-neutral-200 hover:border-neutral-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {status ? <p className="mb-4 rounded border border-neutral-700 bg-black px-3 py-2 text-sm text-neutral-200">{status}</p> : null}

        {activeTab === 'Dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Subscribers" value={metrics.totalSubscribers ?? '--'} />
              <StatCard label="Daily Active Users" value={metrics.dailyActiveUsers ?? '--'} />
              <StatCard label="Consumption Hours" value={metrics.contentConsumptionHours ?? '--'} />
              <StatCard label="Revenue" value={`Rs ${metrics.revenueMetrics?.totalRevenue ?? '--'}`} />
              <StatCard label="Retention %" value={metrics.userRetentionRate ?? '--'} />
              <StatCard label="Top Titles" value={(metrics.topPerformingContent || []).length} />
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Realtime System Monitoring</h3>
                <div className="space-y-3">
                  <MiniBar label="CPU Load" value={monitor.cpuLoad || 0} />
                  <MiniBar label="Memory Usage" value={monitor.memoryUsage || 0} />
                  <MiniBar label="Playback Error Rate" value={monitor.playbackErrorRate || 0} max={5} />
                  <MiniBar label="API Latency (ms)" value={monitor.apiLatencyMs || 0} max={200} />
                </div>
                <p className="mt-3 text-xs text-neutral-400">Health: {monitor.health || '--'} | DB: {monitor.database || '--'}</p>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Top Performing Content</h3>
                <div className="space-y-2">
                  {(metrics.topPerformingContent || []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded border border-neutral-800 bg-black px-3 py-2 text-sm">
                      <span>{item.title}</span>
                      <span className="text-red-300">{item.views} views</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Content' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Content Creation Studio</h3>
                <div className="grid grid-cols-1 gap-2">
                  <input value={contentDraft.title} onChange={(e) => setContentDraft((v) => ({ ...v, title: e.target.value }))} placeholder="Title" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <select value={contentDraft.type} onChange={(e) => setContentDraft((v) => ({ ...v, type: e.target.value }))} className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm"><option value="movie">movie</option><option value="series">series</option></select>
                  <input value={contentDraft.category} onChange={(e) => setContentDraft((v) => ({ ...v, category: e.target.value }))} placeholder="Category" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <textarea value={contentDraft.description} onChange={(e) => setContentDraft((v) => ({ ...v, description: e.target.value }))} rows={3} placeholder="Synopsis/Description" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => createAdminContent({ actorId, payload: contentDraft }), 'Content created and added to library.')} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50">Create Title</button>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Bulk Upload (CSV/Excel style)</h3>
                <textarea value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)} rows={7} className="w-full rounded border border-neutral-700 bg-black px-3 py-2 text-xs" />
                <button type="button" disabled={busy} onClick={() => runAction(() => bulkUploadAdminContent({ actorId, csvText: bulkCsv }), 'Bulk content uploaded.')} className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50">Run Bulk Import</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Season & Episode Planner</h3>
                <div className="grid grid-cols-1 gap-2">
                  <input value={seasonDraft.contentId} onChange={(e) => setSeasonDraft((v) => ({ ...v, contentId: e.target.value }))} placeholder="Series Content ID" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input type="number" value={seasonDraft.seasonNumber} onChange={(e) => setSeasonDraft((v) => ({ ...v, seasonNumber: Number(e.target.value) }))} placeholder="Season Number" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input value={seasonDraft.title} onChange={(e) => setSeasonDraft((v) => ({ ...v, title: e.target.value }))} placeholder="Season Title" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => addSeasonToContent({ actorId, contentId: seasonDraft.contentId, seasonNumber: seasonDraft.seasonNumber, title: seasonDraft.title }), 'Season added successfully.')} className="rounded border border-red-600 px-3 py-2 text-sm text-red-200">Add Season</button>

                  <input value={episodeDraft.contentId} onChange={(e) => setEpisodeDraft((v) => ({ ...v, contentId: e.target.value }))} placeholder="Series Content ID" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={episodeDraft.seasonNumber} onChange={(e) => setEpisodeDraft((v) => ({ ...v, seasonNumber: Number(e.target.value) }))} placeholder="Season #" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                    <input type="number" value={episodeDraft.episodeNumber} onChange={(e) => setEpisodeDraft((v) => ({ ...v, episodeNumber: Number(e.target.value) }))} placeholder="Episode #" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  </div>
                  <input value={episodeDraft.title} onChange={(e) => setEpisodeDraft((v) => ({ ...v, title: e.target.value }))} placeholder="Episode Title" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => addEpisodeToSeason({ actorId, contentId: episodeDraft.contentId, seasonNumber: episodeDraft.seasonNumber, payload: { episodeNumber: episodeDraft.episodeNumber, title: episodeDraft.title } }), 'Episode scheduled successfully.')} className="rounded border border-red-600 px-3 py-2 text-sm text-red-200">Add Episode</button>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Content Organization</h3>
                <div className="grid grid-cols-1 gap-2">
                  <input value={orgDraft.contentId} onChange={(e) => setOrgDraft((v) => ({ ...v, contentId: e.target.value }))} placeholder="Content ID" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input value={orgDraft.collections} onChange={(e) => setOrgDraft((v) => ({ ...v, collections: e.target.value }))} placeholder="Collections (comma separated)" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input value={orgDraft.categoryOverrides} onChange={(e) => setOrgDraft((v) => ({ ...v, categoryOverrides: e.target.value }))} placeholder="Category Overrides" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input type="number" value={orgDraft.featuredRank} onChange={(e) => setOrgDraft((v) => ({ ...v, featuredRank: Number(e.target.value) }))} placeholder="Featured Rank" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => updateContentOrganization({ actorId, contentId: orgDraft.contentId, payload: orgDraft }), 'Featured rotation + collections updated.')} className="rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50">Update Organization</button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-semibold">Content Library</h3>
                <input value={searchContent} onChange={(e) => setSearchContent(e.target.value)} placeholder="Search titles..." className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-neutral-300"><tr><th className="py-2">Title</th><th>Type</th><th>Category</th><th>Maturity</th></tr></thead>
                  <tbody>
                    {contentRows.slice(0, 12).map((row) => (
                      <tr key={row.id} className="border-t border-neutral-800"><td className="py-2">{row.title}</td><td>{row.type}</td><td>{row.category}</td><td>{row.maturityRating || row.rating || '-'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Video' && (
          <div className="space-y-5">
            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
              <h3 className="mb-3 text-lg font-semibold">Video Pipeline Manager</h3>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                <input value={videoDraft.contentId} onChange={(e) => setVideoDraft((v) => ({ ...v, contentId: e.target.value }))} placeholder="Content ID" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                <input value={videoDraft.sourceUrl} onChange={(e) => setVideoDraft((v) => ({ ...v, sourceUrl: e.target.value }))} placeholder="Source URL" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                <input value={videoDraft.formats} onChange={(e) => setVideoDraft((v) => ({ ...v, formats: e.target.value }))} placeholder="Formats: mp4,mkv,webm" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                <input value={videoDraft.qualityVariants} onChange={(e) => setVideoDraft((v) => ({ ...v, qualityVariants: e.target.value }))} placeholder="Qualities: 360p,720p,1080p,4k" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                <input value={videoDraft.subtitles} onChange={(e) => setVideoDraft((v) => ({ ...v, subtitles: e.target.value }))} placeholder="Subtitles: en.vtt,hi.srt" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                <input value={videoDraft.audioTracks} onChange={(e) => setVideoDraft((v) => ({ ...v, audioTracks: e.target.value }))} placeholder="Audio tracks: English,Hindi,Tamil" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
              </div>
              <button type="button" disabled={busy} onClick={() => runAction(() => updateAdminVideoAssets({ actorId, contentId: videoDraft.contentId, payload: videoDraft }), 'Video assets updated for selected content.')} className="mt-3 rounded bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50">Save Video Pipeline</button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="Formats Enabled" value={videoDraft.formats.split(',').filter(Boolean).length} />
              <StatCard label="Quality Variants" value={videoDraft.qualityVariants.split(',').filter(Boolean).length} />
              <StatCard label="Subtitle/Audio Tracks" value={videoDraft.subtitles.split(',').filter(Boolean).length + videoDraft.audioTracks.split(',').filter(Boolean).length} />
            </div>
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold">Subscriber Management + Account Actions</h3>
              <input value={searchUsers} onChange={(e) => setSearchUsers(e.target.value)} placeholder="Search user..." className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
            </div>
            <div className="max-h-[420px] overflow-auto rounded border border-neutral-700">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-black text-neutral-300"><tr><th className="px-3 py-2">User</th><th>Plan</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.slice(0, 25).map((entry) => (
                    <tr key={entry.id} className="border-t border-neutral-800">
                      <td className="px-3 py-2"><p className="font-semibold">{entry.name}</p><p className="text-xs text-neutral-400">{entry.email}</p></td>
                      <td><select value={entry.subscription?.plan || 'basic'} onChange={(e) => runAction(() => updateUserSubscription({ actorId, userId: entry.id, plan: e.target.value, status: entry.subscription?.status || 'active' }), 'Subscription plan updated.')} className="rounded border border-neutral-700 bg-black px-2 py-1 text-xs"><option value="mobile">mobile</option><option value="basic">basic</option><option value="standard">standard</option><option value="premium">premium</option></select></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{entry.subscription?.status || 'active'}</span>
                          <button type="button" className="rounded border border-red-700 px-2 py-1 text-xs text-red-200" onClick={() => runAction(() => setUserSuspension({ actorId, userId: entry.id, isSuspended: !entry.isSuspended }), entry.isSuspended ? 'User reactivated.' : 'User suspended.')}>{entry.isSuspended ? 'Reactivate' : 'Suspend'}</button>
                        </div>
                      </td>
                      <td>{canManageRoles ? (<select value={entry.role || 'user'} onChange={(e) => runAction(() => updateUserRole({ actorId, userId: entry.id, role: e.target.value, adminScope: e.target.value === 'admin' ? 'content_manager' : 'full_access' }), 'Role updated.')} className="rounded border border-neutral-700 bg-black px-2 py-1 text-xs"><option value="user">user</option><option value="admin">admin</option><option value="superadmin">superadmin</option></select>) : <span className="text-xs">{entry.role}</span>}</td>
                      <td className="flex gap-2 px-3 py-2">
                        <button type="button" onClick={() => runAction(async () => { const out = await resetManagedUserPassword({ actorId, userId: entry.id }); setStatus(`Temporary password for ${entry.email}: ${out.temporaryPassword}`); }, 'Password reset complete.', false)} className="rounded border border-neutral-600 px-2 py-1 text-xs">Reset Pass</button>
                        {isSuperAdmin ? <button type="button" onClick={() => runAction(() => terminateManagedUser({ actorId, userId: entry.id }), 'Account terminated.')} className="rounded border border-orange-700 px-2 py-1 text-xs text-orange-200">Terminate</button> : null}
                        {canDeleteUsers ? <button type="button" onClick={() => runAction(() => removeUser({ actorId, userId: entry.id }), 'User deleted permanently.')} className="rounded border border-red-700 px-2 py-1 text-xs text-red-200">Delete</button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Billing' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Plan Builder</h3>
                <div className="grid grid-cols-1 gap-2">
                  <input value={planDraft.id} onChange={(e) => setPlanDraft((v) => ({ ...v, id: e.target.value }))} placeholder="plan id" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input value={planDraft.name} onChange={(e) => setPlanDraft((v) => ({ ...v, name: e.target.value }))} placeholder="plan name" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input type="number" value={planDraft.price} onChange={(e) => setPlanDraft((v) => ({ ...v, price: Number(e.target.value) }))} placeholder="price" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input value={planDraft.features} onChange={(e) => setPlanDraft((v) => ({ ...v, features: e.target.value }))} placeholder="features comma separated" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => saveSubscriptionPlan({ actorId, payload: planDraft }), 'Plan saved successfully.')} className="rounded bg-red-600 px-3 py-2 text-sm font-semibold">Save Plan</button>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Promotions Engine</h3>
                <div className="grid grid-cols-1 gap-2">
                  <input value={promoDraft.code} onChange={(e) => setPromoDraft((v) => ({ ...v, code: e.target.value }))} placeholder="code" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input type="number" value={promoDraft.discountPercent} onChange={(e) => setPromoDraft((v) => ({ ...v, discountPercent: Number(e.target.value) }))} placeholder="discount %" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input type="number" value={promoDraft.freeTrialDays} onChange={(e) => setPromoDraft((v) => ({ ...v, freeTrialDays: Number(e.target.value) }))} placeholder="free trial days" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => savePromotion({ actorId, payload: promoDraft }), 'Promotion saved successfully.')} className="rounded bg-red-600 px-3 py-2 text-sm font-semibold">Save Promotion</button>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Invoice Center</h3>
                <div className="grid grid-cols-1 gap-2">
                  <input value={invoiceDraft.userId} onChange={(e) => setInvoiceDraft((v) => ({ ...v, userId: e.target.value }))} placeholder="user id" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input type="number" value={invoiceDraft.amount} onChange={(e) => setInvoiceDraft((v) => ({ ...v, amount: Number(e.target.value) }))} placeholder="amount" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <input value={invoiceDraft.plan} onChange={(e) => setInvoiceDraft((v) => ({ ...v, plan: e.target.value }))} placeholder="plan" className="rounded border border-neutral-700 bg-black px-3 py-2 text-sm" />
                  <button type="button" disabled={busy} onClick={() => runAction(() => generateInvoice({ actorId, payload: invoiceDraft }), 'Invoice generated and attached to user.')} className="rounded bg-red-600 px-3 py-2 text-sm font-semibold">Generate Invoice</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <StatCard label="Plans" value={plans.length} />
              <StatCard label="Promotions" value={promotions.length} />
              <StatCard label="Failed Payments" value={failedPayments.length} />
            </div>
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard label="Daily Active Users" value={engagement.dailyActiveUsers ?? '--'} />
              <StatCard label="Average Session (min)" value={engagement.avgSessionMinutes ?? '--'} />
              <StatCard label="Titles Tracked" value={performance.length} />
            </div>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Content Performance Leaderboard</h3>
                <div className="space-y-3">
                  {topFivePerformance.map((item) => (
                    <MiniBar key={item.id} label={`${item.title} (${item.trend})`} value={item.views} max={100000} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="mb-3 text-lg font-semibold">Session Trend (7-day sample)</h3>
                <div className="space-y-3">
                  {(engagement.monthlySessionTrend || []).map((entry) => (
                    <MiniBar key={entry.day} label={`Day ${entry.day}`} value={entry.sessions} max={3000} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSuiteShowcase;
