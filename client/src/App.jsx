import { useEffect, useState, useCallback } from 'react';
import JobFeed from './components/JobFeed.jsx';
import TierBoard from './components/TierBoard.jsx';
import ApplicationTracker from './components/ApplicationTracker.jsx';
import Dashboard from './components/Dashboard.jsx';

const COMPANIES = ['stripe', 'doordash', 'dropbox', 'squarespace', 'asana'];

function jobKey(job) {
  return `${job.company}-${job.id}`;
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [assessments, setAssessments] = useState({});
  const [assessing, setAssessing] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState([]);
  const [companyFilter, setCompanyFilter] = useState('all');
  const [assessAllRunning, setAssessAllRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('tiers');
  const [lastRefresh, setLastRefresh] = useState(() => {
    const stored = localStorage.getItem('jobSearchLastRefresh');
    return stored ? new Date(stored) : null;
  });
  const [urlInput, setUrlInput] = useState('');
  const [assessingUrl, setAssessingUrl] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [seenJobKeys, setSeenJobKeys] = useState(() => {
    const stored = localStorage.getItem('jobSearchSeenJobs');
    return stored ? JSON.parse(stored) : {};
  });
  const [newJobsToday, setNewJobsToday] = useState(0);
  const [recentStatusUpdates, setRecentStatusUpdates] = useState(() => {
    const stored = localStorage.getItem('jobSearchRecentUpdates');
    return stored ? JSON.parse(stored) : [];
  });

  const [trackerRows, setTrackerRows] = useState([]);
  const [manualTiers, setManualTiers] = useState({});

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const results = await Promise.allSettled(
      COMPANIES.map(async (company) => {
        const res = await fetch(`/api/jobs/${company}`);
        if (!res.ok) throw new Error(`${company}: ${res.status}`);
        const data = await res.json();
        return data.map((job) => ({ ...job, company }));
      })
    );

    const allJobs = [];
    const newErrors = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allJobs.push(...result.value);
      } else {
        newErrors.push(`Failed to load jobs for ${COMPANIES[i]}`);
      }
    });

    setJobs(allJobs);
    setErrors(newErrors);
    setLoading(false);

    const today = new Date().toDateString();
    setSeenJobKeys((prev) => {
      const next = { ...prev };
      for (const job of allJobs) {
        const key = jobKey(job);
        if (!next[key]) {
          next[key] = today;
        }
      }
      const newCount = allJobs.filter((job) => next[jobKey(job)] === today).length;
      setNewJobsToday(newCount);
      localStorage.setItem('jobSearchSeenJobs', JSON.stringify(next));
      return next;
    });

    const now = new Date();
    setLastRefresh(now);
    localStorage.setItem('jobSearchLastRefresh', now.toISOString());
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Auto-refresh once per day at/after 9am.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const lastDate = lastRefresh ? lastRefresh.toDateString() : null;
      if (now.getHours() >= 9 && lastDate !== now.toDateString()) {
        loadJobs();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [lastRefresh, loadJobs]);

  const assessJob = useCallback(async (job) => {
    const key = jobKey(job);
    setAssessing((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: job.title,
          jobDescription: job.content,
          company: job.company,
        }),
      });
      if (!res.ok) throw new Error('Assessment failed');
      const assessment = await res.json();
      setAssessments((prev) => ({ ...prev, [key]: assessment }));
    } catch (err) {
      console.error(`Failed to assess ${job.title}:`, err);
    } finally {
      setAssessing((prev) => ({ ...prev, [key]: false }));
    }
  }, []);

  const assessUrlJob = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;

    setAssessingUrl(true);
    setUrlError(null);
    try {
      const res = await fetch('/api/assess-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to assess this URL');
      }
      const data = await res.json();
      const job = {
        id: `manual-${Date.now()}`,
        title: data.jobTitle,
        company: data.company,
        location: { name: 'Manually added' },
        absolute_url: data.url,
        updated_at: new Date().toISOString(),
        content: '',
      };
      setJobs((prev) => [job, ...prev]);
      setAssessments((prev) => ({ ...prev, [jobKey(job)]: data.assessment }));
      setUrlInput('');
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setAssessingUrl(false);
    }
  }, [urlInput]);

  const assessAll = useCallback(async (company = 'all') => {
    setAssessAllRunning(true);
    const unassessed = jobs.filter(
      (job) => !assessments[jobKey(job)] && (company === 'all' || job.company === company)
    );
    for (const job of unassessed) {
      await assessJob(job);
    }
    setAssessAllRunning(false);
  }, [jobs, assessments, assessJob]);

  const addTrackerRow = useCallback(() => {
    setTrackerRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        company: '',
        role: '',
        status: 'Bookmarked',
        dateApplied: '',
        nextAction: '',
        notes: '',
      },
    ]);
  }, []);

  const updateTrackerRow = useCallback((id, field, value) => {
    setTrackerRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === 'status' && value !== row.status) {
          setRecentStatusUpdates((updates) => {
            const next = [{ company: row.company, role: row.role, status: value }, ...updates].slice(0, 5);
            localStorage.setItem('jobSearchRecentUpdates', JSON.stringify(next));
            return next;
          });
        }
        return { ...row, [field]: value };
      })
    );
  }, []);

  const removeTrackerRow = useCallback((id) => {
    setTrackerRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const suggestNextAction = useCallback(async (row) => {
    try {
      const res = await fetch('/api/next-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: row.company,
          role: row.role,
          status: row.status,
          notes: row.notes,
        }),
      });
      if (!res.ok) throw new Error('Next action failed');
      const data = await res.json();
      updateTrackerRow(row.id, 'nextAction', data.nextAction);
    } catch (err) {
      console.error('Failed to suggest next action:', err);
    }
  }, [updateTrackerRow]);

  const setManualTier = useCallback((key, tier) => {
    setManualTiers((prev) => ({ ...prev, [key]: tier }));
  }, []);

  const trackedKeys = new Set(
    trackerRows.map((row) => `${row.company}-${row.role}`.toLowerCase())
  );

  let tier1Count = 0;
  let tier2Count = 0;
  for (const job of jobs) {
    const key = jobKey(job);
    const override = manualTiers[key];
    if (override === 'tier1') {
      tier1Count++;
      continue;
    }
    if (override === 'tier2') {
      tier2Count++;
      continue;
    }
    if (override) continue;
    if (job.locationStatus === 'ambiguous') continue;
    const assessment = assessments[key];
    if (!assessment) continue;
    if (assessment.score >= 80) tier1Count++;
    else if (assessment.score >= 50) tier2Count++;
  }

  const addToTracker = useCallback((job) => {
    setTrackerRows((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        company: job.company,
        role: job.title,
        status: 'Bookmarked',
        dateApplied: '',
        nextAction: '',
        notes: '',
      },
    ]);
  }, []);

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      <aside className="w-64 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-lg font-semibold text-white">Job Search Dashboard</h1>
        </div>

        <nav className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Companies</h2>
            <button
              onClick={() => setCompanyFilter('all')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 transition-colors ${
                companyFilter === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              All companies
            </button>
            {COMPANIES.map((company) => (
              <button
                key={company}
                onClick={() => setCompanyFilter(company)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 capitalize transition-colors ${
                  companyFilter === company
                    ? 'bg-slate-700 text-white'
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                {company}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Actions</h2>
            <button
              onClick={loadJobs}
              disabled={loading}
              className="w-full text-left px-3 py-2 rounded-md text-sm mb-1 hover:bg-slate-800 text-slate-300 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh jobs'}
            </button>
            <button
              onClick={() => assessAll(companyFilter)}
              disabled={assessAllRunning || loading || jobs.length === 0}
              className="w-full text-left px-3 py-2 rounded-md text-sm mb-1 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors capitalize"
            >
              {assessAllRunning
                ? 'Assessing…'
                : companyFilter === 'all'
                ? 'Assess new jobs'
                : `Assess new ${companyFilter} jobs`}
            </button>

            <div className="mt-3">
              <p className="text-xs text-slate-400 px-1 mb-1">Assess a new role</p>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste job posting URL"
                className="w-full text-sm rounded-md px-2 py-1.5 mb-2 bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                onClick={assessUrlJob}
                disabled={assessingUrl || !urlInput.trim()}
                className="w-full text-left px-3 py-2 rounded-md text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors"
              >
                {assessingUrl ? 'Assessing…' : 'Assess'}
              </button>
              {urlError && <p className="text-xs text-red-400 mt-1 px-1">{urlError}</p>}
            </div>
          </div>

          <div className="text-xs text-slate-500 px-3">
            <p>{jobs.length} jobs loaded</p>
            <p>{Object.keys(assessments).length} assessed</p>
            <p>{trackerRows.length} tracked applications</p>
            <p className="mt-1 text-slate-600">
              Last refresh:{' '}
              {lastRefresh
                ? lastRefresh.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
                : 'never'}
            </p>
          </div>

          {errors.length > 0 && (
            <div className="mt-4 px-3 text-xs text-red-400">
              {errors.map((err) => (
                <p key={err}>{err}</p>
              ))}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 pb-0">
          <Dashboard
            newJobsToday={newJobsToday}
            tier1Count={tier1Count}
            tier2Count={tier2Count}
            recentStatusUpdates={recentStatusUpdates}
          />
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <section className="flex-1 lg:max-w-[55%] overflow-y-auto border-r border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('tiers')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'tiers'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Tiers
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'feed'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Job Feed
            </button>
          </div>

          {activeTab === 'tiers' ? (
            <TierBoard
              jobs={jobs}
              assessments={assessments}
              assessing={assessing}
              loading={loading}
              companyFilter={companyFilter}
              onAssess={assessJob}
              onAddToTracker={addToTracker}
              jobKey={jobKey}
              manualTiers={manualTiers}
              onSetManualTier={setManualTier}
              trackedKeys={trackedKeys}
            />
          ) : (
            <JobFeed
              jobs={jobs}
              assessments={assessments}
              assessing={assessing}
              loading={loading}
              companyFilter={companyFilter}
              onAssess={assessJob}
              onAddToTracker={addToTracker}
              jobKey={jobKey}
              trackedKeys={trackedKeys}
            />
          )}
        </section>

        <section className="flex-1 overflow-y-auto p-6">
          <ApplicationTracker
            rows={trackerRows}
            onAdd={addTrackerRow}
            onUpdate={updateTrackerRow}
            onRemove={removeTrackerRow}
            onSuggestNextAction={suggestNextAction}
          />
        </section>
        </div>
      </main>
    </div>
  );
}
