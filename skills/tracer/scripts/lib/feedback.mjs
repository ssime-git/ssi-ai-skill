// Feedback ledger: every review finding, visual/UI/UX observation and user decision gets an
// id and a status, and is rendered in the PR progress comment. Text can come from a reviewer
// or a user, so it is stored as data and neutralised before it is displayed.

export const STATUSES = ['open', 'fixed', 'rejected', 'deferred'];
const MAX = 80;

const clean = (s, n = 160) => String(s ?? '').replace(/[\r\n|`<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

export function addFeedback(state, entry) {
  state.feedback ??= [];
  const dupe = state.feedback.find((f) => f.source === entry.source && f.title === clean(entry.title) && f.file === (entry.file ?? null) && f.line === (entry.line ?? null) && f.status === 'open');
  if (dupe) return dupe.id;
  const id = (state.feedback.at(-1)?.id ?? 0) + 1;
  state.feedback.push({
    id,
    at: new Date().toISOString(),
    phase: entry.phase,
    source: clean(entry.source, 40),
    role: entry.role ? clean(entry.role, 20) : null,
    severity: entry.severity ?? null,
    title: clean(entry.title),
    file: entry.file ? clean(entry.file, 120) : null,
    line: Number.isInteger(entry.line_start ?? entry.line) ? (entry.line_start ?? entry.line) : null,
    status: entry.status ?? 'open',
    note: entry.note ? clean(entry.note) : null,
  });
  if (state.feedback.length > MAX) state.feedback.splice(0, state.feedback.length - MAX);
  return id;
}

export function fromReview(state, report, source) {
  for (const f of report?.findings ?? []) {
    addFeedback(state, { phase: 6, source, role: f.role ?? 'general', severity: f.severity, title: f.title ?? f.body, file: f.file, line: f.line_start });
  }
}

export function resolveFeedback(state, id, status, note) {
  const f = state.feedback?.find((x) => x.id === Number(id));
  if (!f) throw new Error(`There is no feedback item #${id}.`);
  if (!STATUSES.includes(status) || status === 'open') throw new Error('--status must be fixed, rejected or deferred.');
  if (status !== 'fixed' && !String(note ?? '').trim()) throw new Error(`A ${status} item needs --note with the evidence or the reason.`);
  f.status = status;
  f.note = clean(note) || f.note;
  f.resolved_at = new Date().toISOString();
  return f;
}

export function renderFeedback(state) {
  const list = state.feedback ?? [];
  if (!list.length) return '';
  const open = list.filter((f) => f.status === 'open').length;
  const rows = list.map((f) => {
    const where = f.file ? ` \`${clean(f.file, 80)}${f.line ? ':' + f.line : ''}\`` : '';
    const who = [f.source, f.role && f.role !== 'general' ? f.role : null].filter(Boolean).join('/');
    return `| ${f.id} | ${f.phase ?? ''} | ${who} | ${f.severity ?? ''} | ${f.title}${where} | ${f.status}${f.note ? ': ' + f.note : ''} |`;
  });
  return `**Feedback** (${open} open of ${list.length})\n\n| # | Phase | From | Severity | Item | Status |\n|---|---|---|---|---|---|\n${rows.join('\n')}`;
}
