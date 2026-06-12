import { STATUS_CLASSES } from './ApplicationTracker.jsx';

function StatCard({ label, value, accent = 'text-slate-900' }) {
  return (
    <div className="bg-slate-50 rounded-md p-4 border border-slate-100">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}

export default function Dashboard({
  newJobsToday = 0,
  tier1Count = 0,
  tier2Count = 0,
  recentStatusUpdates = [],
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold text-slate-900 mb-4">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <StatCard label="New jobs today" value={newJobsToday} />
        <StatCard label="Tier 1 roles" value={tier1Count} accent="text-green-700" />
        <StatCard label="Tier 2 roles" value={tier2Count} accent="text-yellow-700" />
      </div>

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
