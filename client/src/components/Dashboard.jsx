import { useState } from 'react';
import { STATUS_CLASSES } from './ApplicationTracker.jsx';

function StatCard({ label, value, accent = 'text-slate-900', onClick, expandable }) {
  return (
    <div
      className={`bg-slate-50 rounded-md p-4 border border-slate-100 ${expandable ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
        {expandable && value > 0 && (
          <span className="text-xs text-slate-400">click to see</span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({
  newJobsToday = 0,
  newJobsList = [],
  tier1Count = 0,
  tier2Count = 0,
  recentStatusUpdates = [],
  onJobClick,
}) {
  const [showNewJobs, setShowNewJobs] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <StatCard
          label="New jobs today"
          value={newJobsToday}
          expandable={newJobsToday > 0}
          onClick={() => newJobsToday > 0 && setShowNewJobs((v) => !v)}
        />
        <StatCard label="Tier 1 roles" value={tier1Count} accent="text-green-700" />
        <StatCard label="Tier 2 roles" value={tier2Count} accent="text-yellow-700" />
      </div>

      {showNewJobs && newJobsList.length > 0 && (
        <div className="mb-4 border border-slate-100 rounded-md divide-y divide-slate-100">
          {newJobsList.map((job) => (
            <button
              key={`${job.company}-${job.id}`}
              onClick={() => { onJobClick?.(job); setShowNewJobs(false); }}
              className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <span className="text-sm font-medium text-slate-800">{job.title}</span>
                <span className="text-xs text-slate-400 ml-2">{job.company}</span>
              </div>
              <span className="text-xs text-indigo-500 ml-4 shrink-0">View assessment ↗</span>
            </button>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Recently updated applications
        </h3>
        {recentStatusUpdates.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No recent status updates.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recentStatusUpdates.map((update, i) => (
              <span
                key={`${update.company}-${update.role}-${i}`}
                className={`text-xs font-medium px-2 py-1 rounded-md ${
                  STATUS_CLASSES[update.status] || 'bg-slate-100 text-slate-700'
                }`}
              >
                {update.company} — {update.role}: {update.status}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
