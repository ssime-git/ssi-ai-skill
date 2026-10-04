const pub = ({ number, state, isDraft, url, sha, cross }) => ({ number, state, isDraft, url, headRefOid: sha, isCrossRepository: !!cross });

export function makeGhStub() {
  const s = { pr: null, comments: [], issues: [], offline: false, calls: [] };
  const gh = (args) => {
    s.calls.push(args);
    if (s.offline) throw new Error('network down');
    const [a, b] = args;
    if (a === 'api' && b === 'user') return JSON.stringify({ login: 'me' });
    if (a === 'pr' && b === 'list') {
      if (!args.includes('--head')) return JSON.stringify(s.pr ? [{ number: s.pr.number, state: s.pr.state }] : []);
      const head = args[args.indexOf('--head') + 1];
      return JSON.stringify(s.pr && s.pr.head === head ? [pub(s.pr)] : []);
    }
    if (a === 'api') {
      const path = args.find((x) => x.startsWith('repos/'));
      const pages = (arr) => JSON.stringify(args.includes('--slurp') ? [arr.slice(0, 100), arr.slice(100)].filter((p) => p.length) : arr);
      if (path?.includes('/pulls')) return pages(s.pr && s.pr.state !== 'OPEN' ? [{ number: s.pr.number, state: 'closed' }] : []);
      if (path?.includes('/issues?')) return pages(s.issues);
      const body = (args.find((x) => x.startsWith('body=')) ?? '').slice(5);
      if (args.includes('PATCH')) {
        s.comments.find((c) => c.id === Number(path.split('/').pop())).body = body;
        return '{}';
      }
      if (body) {
        const c = { id: s.comments.length + 1, body, user: { login: 'me' } };
        s.comments.push(c);
        return JSON.stringify(c);
      }
      return JSON.stringify(args.includes('--slurp') ? [s.comments] : s.comments);
    }
    if (a === 'issue' && b === 'list') {
      const limit = Number(args[args.indexOf('--limit') + 1]) || s.issues.length;
      return JSON.stringify(s.issues.slice(-limit));
    }
    if (a === 'issue' && b === 'create') {
      const n = s.issues.length + 1;
      s.issues.push({ number: n, body: args[args.indexOf('--body') + 1] });
      return `https://github.com/o/r/issues/${n}\n`;
    }
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
  gh.s = s;
  gh.openPr = (number, head, isDraft = true, sha = undefined) => {
    s.pr = { number, head, state: 'OPEN', isDraft, sha, url: `https://github.com/o/r/pull/${number}` };
  };
  return gh;
}
