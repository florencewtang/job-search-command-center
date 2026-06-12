import { useState } from 'react';
import JobCard from './JobCard.jsx';

const TIERS = [
  {
    key: 'tier1',
    label: 'Tier 1',
    description: 'Score 80+ — strong fits, prioritize applying',
    badgeClass: 'bg-green-100 text-green-800 border border-green-300',
  },
  {
    key: 'tier2',
    label: 'Tier 2',
    description: 'Score 50-79 — worth a closer look',
    badgeClass: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  },
  {
    key: 'passed',
    label: 'Passed',
    description: 'Score below 50 — not a fit',
    badgeClass: 'bg-red-100 text-red-800 border border-red-300',
  },
];

export default function TierBoard({
  jobs,
  assessments,
  assessing,
  loading,
  companyFilter,
  onAssess,
  onAddToTracker,
  jobKey,
  manualTiers = {},
  onSetManualTier,
  trackedKeys = new Set(),
}) {
  const filteredJobs =
    companyFilter === 'all' ? jobs : jobs.filter((job) => job.company === companyFilter);

  const [collapsed, setCollapsed] = useState({
    tier1: false,
    tier2: false,
    passed: true,
    needsReview: true,
  });

  const toggleCollapsed = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const grouped = { tier1: [], tier2: [], passed: [], unassessed: [], needsReview: [] };

  for (const job of filteredJobs) {
    const override = manualTiers[jobKey(job)];
    if (override) {
      grouped[override].push(job);
      continue;
    }
    if (job.locationStatus === 'ambiguous') {
      grouped.needsReview.push(job);
      continue;
    }
    const assessment = assessments[jobKey(job)];
    if (!assessment) {
      grouped.unassessed.push(job);
    } else if (assessment.score >= 80) {
      grouped.tier1.push(job);
    } else if (assessment.score >= 50) {
      grouped.tier2.push(job);
    } else {
      grouped.passed.push(job);
    }
  }

  for (const tier of Object.keys(grouped)) {
    grouped[tier].sort((a, b) => {
      const scoreA = assessments[jobKey(a)]?.score ?? -1;
      const scoreB = assessments[jobKey(b)]?.score ?? -1;
      return scoreB - scoreA;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Tiers</h2>
        <span className="text-sm text-slate-500">
          {filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'}
        </span>
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading jobs…</p>}

      {!loading && filteredJobs.length === 0 && (
        <p className="text-slate-500 text-sm">No jobs found for this filter.</p>
      )}

      {!loading && filteredJobs.length > 0 && (
        <div className="space-y-6">
          {TIERS.map((tier) => (
            <div key={tier.key}>
              <button
                onClick={() => toggleCollapsed(tier.key)}
                className="w-full flex items-center gap-2 mb-2 text-left"
              >
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${tier.badgeClass}`}>
                  {tier.label}
                </span>
                <p className="text-xs text-slate-500">{tier.description}</p>
                <span className="text-xs text-slate-400 ml-auto">
                  {grouped[tier.key].length}
                </span>
                <span className="text-xs text-slate-400">{collapsed[tier.key] ? '▸' : '▾'}</span>
              </button>

              {!collapsed[tier.key] &&
                (grouped[tier.key].length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No roles in this tier yet.</p>
                ) : (
                  <div className="space-y-3">
                    {grouped[tier.key].map((job) => {
                      const key = jobKey(job);
                      return (
                        <JobCard
                          key={key}
                          job={job}
                          assessment={assessments[key]}
                          isAssessing={!!assessing[key]}
                          onAssess={onAssess}
                          onAddToTracker={onAddToTracker}
                          isTracked={trackedKeys.has(`${job.company}-${job.title}`.toLowerCase())}
                        />
                      );
                    })}
                  </div>
                ))}
            </div>
          ))}

          {grouped.unassessed.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                  Unassessed
                </span>
                <p className="text-xs text-slate-500">Run "Assess Fit" to place these in a tier</p>
                <span className="text-xs text-slate-400 ml-auto">
                  {grouped.unassessed.length}
                </span>
              </div>
              <div className="space-y-3">
                {grouped.unassessed.map((job) => {
                  const key = jobKey(job);
                  return (
                    <JobCard
                      key={key}
                      job={job}
                      assessment={assessments[key]}
                      isAssessing={!!assessing[key]}
                      onAssess={onAssess}
                      onAddToTracker={onAddToTracker}
                      isTracked={trackedKeys.has(`${job.company}-${job.title}`.toLowerCase())}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {grouped.needsReview.length > 0 && (
            <div>
              <button
                onClick={() => toggleCollapsed('needsReview')}
                className="w-full flex items-center gap-2 mb-2 text-left"
              >
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                  Needs Review
                </span>
                <p className="text-xs text-slate-500">
                  Location is just a country name - unclear if remote/Toronto applies
                </p>
                <span className="text-xs text-slate-400 ml-auto">
                  {grouped.needsReview.length}
                </span>
                <span className="text-xs text-slate-400">
                  {collapsed.needsReview ? '▸' : '▾'}
                </span>
              </button>

              {!collapsed.needsReview && (
                <div className="space-y-3">
                  {grouped.needsReview.map((job) => {
                    const key = jobKey(job);
                    return (
                      <JobCard
                        key={key}
                        job={job}
                        assessment={assessments[key]}
                        isAssessing={!!assessing[key]}
                        onAssess={onAssess}
                        onAddToTracker={onAddToTracker}
                        isTracked={trackedKeys.has(`${job.company}-${job.title}`.toLowerCase())}
                        tierOverrideControl={
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500">Move to:</label>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) onSetManualTier(key, e.target.value);
                              }}
                              className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white"
                            >
                              <option value="" disabled>
                                Select tier
                              </option>
                              <option value="tier1">Tier 1</option>
                              <option value="tier2">Tier 2</option>
                              <option value="passed">Passed</option>
                            </select>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
