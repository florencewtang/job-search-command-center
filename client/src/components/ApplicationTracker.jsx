import { useState } from 'react';

const STATUSES = ['Bookmarked', 'Applied', 'Screen', 'Interviewing', 'Offer', 'Passed', 'Closed'];

export const STATUS_CLASSES = {
  Bookmarked: 'bg-slate-100 text-slate-700',
  Applied: 'bg-blue-100 text-blue-700',
  Screen: 'bg-purple-100 text-purple-700',
  Interviewing: 'bg-indigo-100 text-indigo-700',
  Offer: 'bg-green-100 text-green-700',
  Passed: 'bg-amber-100 text-amber-700',
  Closed: 'bg-slate-200 text-slate-500',
};

function EditableCell({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent text-sm px-1 py-1 rounded focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
    />
  );
}

const CLOSED_STATUSES = new Set(['Closed', 'Passed']);

export default function ApplicationTracker({ rows, onAdd, onUpdate, onRemove, onSuggestNextAction }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedNotes, setExpandedNotes] = useState({});
  const [suggesting, setSuggesting] = useState({});
  const [collapsed, setCollapsed] = useState({ closed: true });

  const filteredRows = statusFilter === 'all' ? rows : rows.filter((row) => row.status === statusFilter);

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dateA = a.dateApplied ? new Date(a.dateApplied).getTime() : -Infinity;
    const dateB = b.dateApplied ? new Date(b.dateApplied).getTime() : -Infinity;
    return dateB - dateA;
  });

  const inProgressRows = sortedRows.filter((row) => !CLOSED_STATUSES.has(row.status));
  const closedRows = sortedRows.filter((row) => CLOSED_STATUSES.has(row.status));

  const toggleCollapsed = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSuggest = async (row) => {
    setSuggesting((prev) => ({ ...prev, [row.id]: true }));
    await onSuggestNextAction(row);
    setSuggesting((prev) => ({ ...prev, [row.id]: false }));
  };

  const renderRow = (row) => (
    <div key={row.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Company</label>
          <EditableCell
            value={row.company}
            placeholder="Company"
            onChange={(val) => onUpdate(row.id, 'company', val)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Role</label>
          <EditableCell
            value={row.role}
            placeholder="Role title"
            onChange={(val) => onUpdate(row.id, 'role', val)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Status</label>
          <select
            value={row.status}
            onChange={(e) => onUpdate(row.id, 'status', e.target.value)}
            className={`w-full text-sm rounded-md px-2 py-1 font-medium ${STATUS_CLASSES[row.status] || ''}`}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Date applied</label>
          <EditableCell
            type="date"
            value={row.dateApplied}
            onChange={(val) => onUpdate(row.id, 'dateApplied', val)}
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-xs text-slate-400 block mb-1">Next action</label>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm text-slate-700 italic">
            {row.nextAction || 'No suggestion yet.'}
          </p>
          <button
            onClick={() => handleSuggest(row)}
            disabled={suggesting[row.id]}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors shrink-0"
          >
            {suggesting[row.id] ? 'Thinking…' : 'Suggest Next Action'}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <button
          onClick={() => setExpandedNotes((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
          className="text-xs text-indigo-600 hover:underline"
        >
          {expandedNotes[row.id] ? 'Hide notes' : 'Notes'}
        </button>
        {expandedNotes[row.id] && (
          <textarea
            value={row.notes}
            onChange={(e) => onUpdate(row.id, 'notes', e.target.value)}
            rows={3}
            placeholder="Notes…"
            className="mt-2 w-full text-sm border border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-indigo-400 outline-none"
          />
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onRemove(row.id)}
          className="text-xs text-red-500 hover:underline"
        >
          Remove
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-900">Application Tracker</h2>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <button
            onClick={onAdd}
            className="text-sm font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            + Add Row
          </button>
        </div>
      </div>

      {filteredRows.length === 0 && (
        <p className="text-slate-500 text-sm">No applications tracked yet.</p>
      )}

      {filteredRows.length > 0 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
              In Progress ({inProgressRows.length})
            </h3>
            {inProgressRows.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No active applications.</p>
            ) : (
              <div className="space-y-3">{inProgressRows.map(renderRow)}</div>
            )}
          </div>

          {closedRows.length > 0 && (
            <div>
              <button
                onClick={() => toggleCollapsed('closed')}
                className="w-full flex items-center gap-2 mb-2 text-left"
              >
                <h3 className="text-xs uppercase tracking-wide text-slate-500">
                  Closed ({closedRows.length})
                </h3>
                <span className="text-xs text-slate-400 ml-auto">
                  {collapsed.closed ? '▸' : '▾'}
                </span>
              </button>
              {!collapsed.closed && (
                <div className="space-y-3">{closedRows.map(renderRow)}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
