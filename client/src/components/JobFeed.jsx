import JobCard from './JobCard.jsx';

export default function JobFeed({
  jobs,
  assessments,
  assessing,
  loading,
  companyFilter,
  onAssess,
  onAddToTracker,
  jobKey,
  trackedKeys = new Set(),
}) {
  const filteredJobs =
    companyFilter === 'all' ? jobs : jobs.filter((job) => job.company === companyFilter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Job Feed</h2>
        <span className="text-sm text-slate-500">
          {filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'}
        </span>
      </div>

      {loading && <p className="text-slate-500 text-sm">Loading jobs…</p>}

      {!loading && filteredJobs.length === 0 && (
        <p className="text-slate-500 text-sm">No jobs found for this filter.</p>
      )}

      <div className="space-y-3">
        {filteredJobs.map((job) => {
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
  );
}
