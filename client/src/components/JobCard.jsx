import { useState } from 'react';

function scoreBadgeClasses(score) {
  if (score >= 75) return 'bg-green-100 text-green-800 border border-green-300';
  if (score >= 50) return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
  return 'bg-red-100 text-red-800 border border-red-300';
}

function recommendationClasses(recommendation) {
  switch (recommendation) {
    case 'Apply':
      return 'bg-green-600 text-white';
    case 'Maybe':
      return 'bg-yellow-500 text-white';
    case 'Skip':
      return 'bg-red-500 text-white';
    default:
      return 'bg-slate-300 text-slate-700';
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function JobCard({ job, assessment, isAssessing, onAssess, onAddToTracker, isTracked, tierOverrideControl }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
            <p className="text-sm text-slate-500 capitalize">
              {job.company} &middot; {job.location?.name || 'Location unknown'}
              {job.locationStatus === 'ambiguous' && (
                <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 normal-case">
                  Needs review
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">Posted {formatDate(job.updated_at)}</p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {isTracked && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                Tracking
              </span>
            )}
            {assessment && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${scoreBadgeClasses(assessment.score)}`}>
                {assessment.score}
              </span>
            )}
            {assessment && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${recommendationClasses(assessment.recommendation)}`}>
                {assessment.recommendation}
              </span>
            )}
          </div>
        </div>

        {tierOverrideControl && (
          <div onClick={(e) => e.stopPropagation()} className="mt-3">
            {tierOverrideControl}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssess(job);
            }}
            disabled={isAssessing}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isAssessing ? 'Assessing…' : assessment ? 'Re-assess Fit' : 'Assess Fit'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToTracker(job);
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Add to Tracker
          </button>
          {job.absolute_url && (
            <a
              href={job.absolute_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium px-3 py-1.5 rounded-md text-indigo-600 hover:underline ml-auto"
            >
              View posting ↗
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 text-sm">
          {!assessment && (
            <p className="text-slate-500 italic">
              Not yet assessed. Click "Assess Fit" to generate a fit breakdown.
            </p>
          )}
          {assessment && (
            <div className="space-y-3">
              <p className="text-slate-700">{assessment.summary}</p>

              {assessment.reasoning && (
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Why: </span>
                  {assessment.reasoning}
                </p>
              )}

              <p className="text-slate-800 italic">"{assessment.one_line_pitch}"</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white rounded border border-slate-200 p-2">
                  <p className="text-slate-400">Skills match</p>
                  <p className="font-semibold text-slate-800">{assessment.breakdown?.skills_match}</p>
                </div>
                <div className="bg-white rounded border border-slate-200 p-2">
                  <p className="text-slate-400">Seniority match</p>
                  <p className="font-semibold text-slate-800">{assessment.breakdown?.seniority_match}</p>
                </div>
                <div className="bg-white rounded border border-slate-200 p-2">
                  <p className="text-slate-400">Comp likely met</p>
                  <p className="font-semibold text-slate-800">
                    {String(assessment.breakdown?.comp_likely_met)}
                  </p>
                </div>
                <div className="bg-white rounded border border-slate-200 p-2">
                  <p className="text-slate-400">Location OK</p>
                  <p className="font-semibold text-slate-800">
                    {String(assessment.breakdown?.location_ok)}
                  </p>
                </div>
                <div className="bg-white rounded border border-slate-200 p-2">
                  <p className="text-slate-400">Role type fit</p>
                  <p className="font-semibold text-slate-800">{assessment.breakdown?.role_type_fit}</p>
                </div>
              </div>

              {assessment.green_flags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                    Green flags
                  </p>
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {assessment.green_flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {assessment.red_flags?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
                    Red flags
                  </p>
                  <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                    {assessment.red_flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
