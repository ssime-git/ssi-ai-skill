import { execFileSync } from 'node:child_process';
import { parseBlock } from './remote.mjs';

const json = (s) => JSON.parse(s || 'null');

export const makeGh = (cwd) => (args) =>
  execFileSync('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function findPr(gh, branch, known = null) {
  const rows = json(gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,isDraft,url,headRefOid,isCrossRepository', '--limit', '10'])) ?? [];
  const mine = rows.filter((r) => !r.isCrossRepository);
  const row = mine.find((r) => r.number === known && r.state === 'OPEN') ?? mine.find((r) => r.state === 'OPEN') ?? mine.find((r) => r.number === known);
  return row ? { number: row.number, state: row.state, isDraft: row.isDraft, url: row.url, headSha: row.headRefOid ?? null } : null;
}

export const whoami = (gh) => json(gh(['api', 'user']))?.login ?? null;

export const isTransient = (e) => /could not resolve|timed out|timeout|network|econn|enotfound|eai_again|connection|http 5\d\d/i.test(String(e?.message ?? e));

export function listComments(gh, n) {
  // --paginate alone prints one JSON array per page back to back; --slurp wraps them in one array.
  const pages = json(gh(['api', `repos/{owner}/{repo}/issues/${n}/comments`, '--paginate', '--slurp'])) ?? [];
  return Array.isArray(pages) ? pages.flat() : [];
}

export function readRemoteState(gh, n, login = null) {
  for (const c of listComments(gh, n)) {
    if (login && c.user?.login !== login) continue;
    const state = parseBlock(c.body);
    if (state) return { commentId: c.id, body: c.body, state };
  }
  return null;
}

export function upsertStateComment(gh, n, mergeFn, login = null) {
  const found = readRemoteState(gh, n, login);
  const body = mergeFn(found?.body ?? null);
  if (found) {
    if (found.body === body) return { commentId: found.commentId, changed: false };
    gh(['api', '-X', 'PATCH', `repos/{owner}/{repo}/issues/comments/${found.commentId}`, '-f', `body=${body}`]);
    return { commentId: found.commentId, changed: true };
  }
  const created = json(gh(['api', `repos/{owner}/{repo}/issues/${n}/comments`, '-f', `body=${body}`]));
  return { commentId: created?.id, changed: true };
}

// Every page, never a "latest 200": an old run's Issue must still be found, or a retry duplicates it.
const allPages = (gh, path) => {
  const pages = json(gh(['api', path, '--paginate', '--slurp'])) ?? [];
  return Array.isArray(pages) ? pages.flat() : [];
};

export function findIssueByKey(gh, key) {
  const rows = allPages(gh, 'repos/{owner}/{repo}/issues?state=all&per_page=100');
  return rows.find((r) => !r.pull_request && (r.body ?? '').includes(key))?.number ?? null;
}

export function createIssue(gh, { title, body, key }) {
  const existing = findIssueByKey(gh, key);
  if (existing) return { number: existing, created: false };
  const url = gh(['issue', 'create', '--title', title, '--body', `${body}\n\n<!-- ${key} -->`]).trim();
  return { number: Number(url.split('/').pop()), created: true };
}

// The REST "closed" state includes merged PRs, and every page is read.
export const closedPrNumbers = (gh) => allPages(gh, 'repos/{owner}/{repo}/pulls?state=closed&per_page=100').map((r) => r.number);
