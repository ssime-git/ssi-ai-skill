import { execFileSync } from 'node:child_process';
import { parseBlock } from './remote.mjs';

const json = (s) => JSON.parse(s || 'null');

export const makeGh = (cwd) => (args) =>
  execFileSync('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function findPr(gh, branch) {
  const rows = json(gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,isDraft,url', '--limit', '1']));
  return rows?.[0] ?? null;
}

export function listComments(gh, n) {
  return json(gh(['api', `repos/{owner}/{repo}/issues/${n}/comments`, '--paginate'])) ?? [];
}

export function readRemoteState(gh, n) {
  for (const c of listComments(gh, n)) {
    const state = parseBlock(c.body);
    if (state) return { commentId: c.id, body: c.body, state };
  }
  return null;
}

export function upsertStateComment(gh, n, mergeFn) {
  const found = readRemoteState(gh, n);
  const body = mergeFn(found?.body ?? null);
  if (found) {
    if (found.body === body) return { commentId: found.commentId, changed: false };
    gh(['api', '-X', 'PATCH', `repos/{owner}/{repo}/issues/comments/${found.commentId}`, '-f', `body=${body}`]);
    return { commentId: found.commentId, changed: true };
  }
  const created = json(gh(['api', `repos/{owner}/{repo}/issues/${n}/comments`, '-f', `body=${body}`]));
  return { commentId: created?.id, changed: true };
}

export function findIssueByKey(gh, key) {
  const rows = json(gh(['issue', 'list', '--state', 'all', '--json', 'number,body', '--limit', '200'])) ?? [];
  return rows.find((r) => (r.body ?? '').includes(key))?.number ?? null;
}

export function createIssue(gh, { title, body, key }) {
  const existing = findIssueByKey(gh, key);
  if (existing) return { number: existing, created: false };
  const url = gh(['issue', 'create', '--title', title, '--body', `${body}\n\n<!-- ${key} -->`]).trim();
  return { number: Number(url.split('/').pop()), created: true };
}

export const closedPrNumbers = (gh) =>
  (json(gh(['pr', 'list', '--state', 'closed', '--json', 'number', '--limit', '200'])) ?? []).map((r) => r.number);
