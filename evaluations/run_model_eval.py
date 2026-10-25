#!/usr/bin/env python3
"""Paired Codex trials. Records real CLI usage, held-out correctness and wall time.

No API keys are read by this harness. Uses the already-authenticated installed CLI.
GitHub is a local simulator. Model reviews use a file rendezvous so the orchestrator,
not a sandboxed tool, opens the authenticated model connection.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import subprocess
import sys
import time

REPO = Path(__file__).resolve().parents[1]
ARMS = ['codex', 'ssi02', 'ssi03']
CASES = {
    'mean_local': {
        'target': 'local', 'scope': 'small',
        'request': 'Add mean(values) to src/stats.cjs. Reuse sum(values). An empty array returns null; otherwise return the arithmetic mean. Accept only arrays of finite numbers, rejecting other inputs with TypeError. Do not mutate the input. Preserve sum behavior. Add meaningful tests and run them. Deliver a verified LOCAL change; no PR, Issue or publication is wanted.',
        'files': {
            'src/stats.cjs': 'function sum(values) { return values.reduce((a, b) => a + b, 0); }\nmodule.exports = { sum };\n',
            'test/stats.test.cjs': "const test=require('node:test'); const assert=require('node:assert/strict'); const {sum}=require('../src/stats.cjs');\ntest('sum',()=>assert.equal(sum([1,2,3]),6));\n",
        },
        'assertions': [
            'assert.equal(api.mean([]), null)', 'assert.equal(api.mean([1, 2, 6]), 3)',
            'assert.equal(api.mean([-5, 5]), 0)', 'assert.equal(api.mean([2.5, 3.5]), 3)',
            'for (const bad of [null, "12", {}, [1, "2"], [NaN], [Infinity]]) assert.throws(()=>api.mean(bad), TypeError)',
            'const xs=[3,1,2]; api.mean(xs); assert.deepEqual(xs,[3,1,2])', 'assert.equal(api.sum([2, 4]), 6)',
        ], 'module': 'stats.cjs',
    },
    'discount_local': {
        'target': 'local', 'scope': 'small',
        'request': 'Fix totalCents(items, discountPercent=0) in src/pricing.cjs: discountPercent is a percentage of the whole subtotal, not a flat number of cents. Return Math.round(subtotal * (1 - discountPercent / 100)). Accept only finite numeric discounts from 0 through 100; otherwise throw RangeError. Retain subtotalCents validation and exports, and never mutate items. Add a regression test that fails before the fix, then run the tests. Deliver a verified LOCAL fix; do not create an Issue or PR.',
        'files': {
            'src/pricing.cjs': "function subtotalCents(items) { if (!Array.isArray(items)) throw new TypeError('items'); return items.reduce((sum, item) => { if (!Number.isInteger(item.unitCents) || item.unitCents < 0 || !Number.isInteger(item.quantity) || item.quantity < 0) throw new RangeError('item'); return sum + item.unitCents * item.quantity; }, 0); }\nfunction totalCents(items, discountPercent=0) { return Math.round(subtotalCents(items) - discountPercent); }\nmodule.exports = { subtotalCents, totalCents };\n",
            'test/pricing.test.cjs': "const test=require('node:test'); const assert=require('node:assert/strict'); const {totalCents}=require('../src/pricing.cjs');\ntest('no discount',()=>assert.equal(totalCents([{unitCents:100,quantity:2}]),200));\n",
        },
        'assertions': [
            'assert.equal(api.totalCents([{unitCents:1000,quantity:2}],20),1600)',
            'assert.equal(api.totalCents([{unitCents:105,quantity:1}],50),53)',
            'assert.equal(api.totalCents([{unitCents:399,quantity:3}],100),0)',
            'assert.equal(api.totalCents([],25),0)',
            'for(const bad of [-1,101,NaN,Infinity,"20",null]) assert.throws(()=>api.totalCents([],bad),RangeError)',
            'assert.throws(()=>api.totalCents([{unitCents:10,quantity:-1}],0),RangeError)',
            'const xs=[{unitCents:500,quantity:2}]; api.totalCents(xs,10); assert.deepEqual(xs,[{unitCents:500,quantity:2}])',
            'assert.equal(api.subtotalCents([{unitCents:20,quantity:3}]),60)',
        ], 'module': 'pricing.cjs',
    },
    'quote_pr': {
        'target': 'pr', 'scope': 'standard',
        'request': 'Prepare a reviewed DRAFT PR adding quote(items, zone, discountPercent=0) in src/quote.cjs. Reuse subtotalCents and discountedCents from pricing.cjs and shippingCents from shipping.cjs; preserve existing exports. Return {goodsCents, shippingCents, totalCents}. Shipping uses the DISCOUNTED goods total: domestic costs 500 cents but is free at 10000 cents or above; international always costs 1500 cents. Reject unknown zones with RangeError, including for empty carts. Preserve existing validation. Add boundary and integration tests. Use a short plan, run tests, obtain one fresh review through the supplied review helper, and leave a draft PR in the LOCAL GitHub simulator. The named interface additions and their tests are already authorized. No deployment or real remote changes.',
        'files': {
            'src/pricing.cjs': "function subtotalCents(items) { if (!Array.isArray(items)) throw new TypeError('items'); return items.reduce((sum, i) => { if (!Number.isInteger(i.unitCents)||i.unitCents<0||!Number.isInteger(i.quantity)||i.quantity<0) throw new RangeError('item'); return sum+i.unitCents*i.quantity; },0); }\nfunction discountedCents(cents, percent=0) { if (typeof percent!=='number'||!Number.isFinite(percent)||percent<0||percent>100) throw new RangeError('discount'); return Math.round(cents*(1-percent/100)); }\nmodule.exports={subtotalCents,discountedCents};\n",
            'src/shipping.cjs': "function shippingCents(zone, goodsCents) { if(zone==='domestic') return goodsCents>=10000?0:500; if(zone==='international') return 1500; throw new RangeError('zone'); }\nmodule.exports={shippingCents};\n",
            'src/quote.cjs': "const {subtotalCents}=require('./pricing.cjs');\nmodule.exports={subtotalCents};\n",
            'test/quote.test.cjs': "const test=require('node:test'); const assert=require('node:assert/strict'); const {subtotalCents}=require('../src/quote.cjs');\ntest('existing export',()=>assert.equal(subtotalCents([{unitCents:10,quantity:2}]),20));\n",
        },
        'assertions': [
            "assert.deepEqual(api.quote([{unitCents:10000,quantity:1}],'domestic',0),{goodsCents:10000,shippingCents:0,totalCents:10000})",
            "assert.deepEqual(api.quote([{unitCents:10000,quantity:1}],'domestic',10),{goodsCents:9000,shippingCents:500,totalCents:9500})",
            "assert.deepEqual(api.quote([{unitCents:12500,quantity:1}],'domestic',20),{goodsCents:10000,shippingCents:0,totalCents:10000})",
            "assert.deepEqual(api.quote([],'international'),{goodsCents:0,shippingCents:1500,totalCents:1500})",
            "assert.deepEqual(api.quote([{unitCents:105,quantity:1}],'domestic',50),{goodsCents:53,shippingCents:500,totalCents:553})",
            "assert.throws(()=>api.quote([],'unknown'),RangeError)",
            "assert.throws(()=>api.quote([],'domestic',101),RangeError)",
            "assert.throws(()=>api.quote([{unitCents:-1,quantity:1}],'domestic'),RangeError)",
            "assert.equal(api.subtotalCents([{unitCents:10,quantity:3}]),30)",
        ], 'module': 'quote.cjs',
    },
}


def run(args, cwd, **kwargs):
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, **kwargs)


def usage_from_events(path):
    usages, errors, tool_calls = [], [], 0
    for line in path.read_text().splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get('type') == 'turn.completed':
            usages.append(event.get('usage'))
        if event.get('type') in ('turn.failed', 'error'):
            errors.append(event)
        if event.get('type') == 'item.completed' and event.get('item', {}).get('type') in ('command_execution', 'mcp_tool_call', 'web_search'):
            tool_calls += 1
    if not usages or any(not isinstance(u, dict) for u in usages):
        return None, errors, tool_calls
    # Cached input is a subset of input; reasoning is a subset of output.
    keys = ['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens']
    totals = {k: sum(u.get(k, 0) for u in usages) for k in keys}
    totals['total_tokens'] = totals['input_tokens'] + totals['output_tokens']
    totals['uncached_input_tokens'] = totals['input_tokens'] - totals['cached_input_tokens']
    return totals, errors, tool_calls


def cli_command(options, directory, final, review=False):
    return [options.codex, 'exec', '--ignore-user-config', '--ephemeral', '--json',
            '--disable', 'plugins', '--disable', 'remote_plugin', '--disable', 'multi_agent',
            '--enable', 'skip_host_skill_discovery', '-m', options.model,
            '-c', 'model_reasoning_effort="medium"', '-c', 'approval_policy="never"',
            '--sandbox', 'read-only' if review else 'workspace-write',
            '--add-dir', str(directory / '.git'), '-C', str(directory), '-o', str(final)]


GH_SIMULATOR = r'''#!/usr/bin/env python3
import json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[2]
f=root/'.bench/github.json'
s=json.loads(f.read_text()) if f.exists() else {'pr':None,'comments':[],'issues':[],'calls':[]}
a=sys.argv[1:];s['calls'].append(a)
def flag(k,default=None):
 return a[a.index(k)+1] if k in a and a.index(k)+1<len(a) else default
def head(): return subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
def emit(x):
 f.write_text(json.dumps(s));print(x if isinstance(x,str) else json.dumps(x));sys.exit(0)
if a[:2]==['api','user']:emit({'login':'benchmark'})
if a[:2]==['pr','create']:
 s['pr']={'number':1,'state':'OPEN','isDraft':'--draft' in a,'url':'https://example.invalid/benchmark/pull/1','headRefOid':head(),'isCrossRepository':False,'body':flag('--body','')};emit(s['pr']['url'])
if a[:2]==['pr','list']:
 if s['pr']:s['pr']['headRefOid']=head()
 emit([s['pr']] if s['pr'] else [])
if a[:2]==['pr','view']:
 if not s['pr']:emit({})
 s['pr']['headRefOid']=head();emit({**s['pr'],'statusCheckRollup':[{'__typename':'CheckRun','name':'simulated CI (held-out acceptance is checked separately)','status':'COMPLETED','conclusion':'SUCCESS'}]})
if a[:2]==['pr','checks']:emit('simulated checks pass')
if a[:2]==['pr','edit']:
 if s['pr'] and '--body' in a:s['pr']['body']=flag('--body')
 emit('updated')
if a[:2]==['pr','ready']:raise SystemExit('Mark-ready is not part of this benchmark')
if a[:2]==['issue','create']:
 n=len(s['issues'])+1;s['issues'].append({'number':n,'body':flag('--body','')});emit(f'https://example.invalid/benchmark/issues/{n}')
if a[:2]==['issue','list']:emit(s['issues'])
if a and a[0]=='api':
 path=next((x for x in a[1:] if x.startswith('repos/')),'')
 body=next((x[5:] for x in a if x.startswith('body=')),None)
 if '/issues?' in path:emit([s['issues']] if '--slurp' in a else s['issues'])
 if '/pulls' in path:emit([])
 if body is not None:
  if 'PATCH' in a:
   n=int(path.split('/')[-1]);next(c for c in s['comments'] if c['id']==n)['body']=body;emit({})
  c={'id':len(s['comments'])+1,'user':{'login':'benchmark'},'body':body};s['comments'].append(c);emit(c)
 emit([s['comments']] if '--slurp' in a else s['comments'])
emit({})
'''

REVIEW_RENDEZVOUS = r'''#!/usr/bin/env python3
import json,time
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'.bench'
request=root/'review.request'
result=root/'review.result'
if result.exists(): result.unlink()
request.write_text('review requested')
for i in range(1200):
 if result.exists():
  print(result.read_text());break
 time.sleep(.2)
else: raise SystemExit('review timed out')
'''


def prepare(options, case_name, arm, repeat):
    directory = options.output / 'workspaces' / f'{case_name}-{arm}-{repeat}'
    directory.mkdir(parents=True)
    case = CASES[case_name]
    for name, content in case['files'].items():
        path = directory / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
    (directory / 'package.json').write_text(json.dumps({'name': 'ssi-eval-fixture', 'private': True, 'scripts': {'test': 'node --test test/*.test.cjs'}}))
    (directory / '.gitignore').write_text('.bench/\n.ssi/\nWORKFLOW.md\n')
    tools = directory / '.bench/bin'
    tools.mkdir(parents=True)
    for name, text in [('gh', GH_SIMULATOR), ('review', REVIEW_RENDEZVOUS)]:
        path = tools / name
        path.write_text(text)
        path.chmod(0o755)
    (directory / 'AGENTS.md').write_text(f'''This is an isolated, fully specified benchmark task. Work only in this repository. Do not install packages, access secrets, change tests to weaken requirements, or contact external services.
Read TASK.md. If WORKFLOW.md exists, apply it; its skill directory is {directory}/.bench/ssi. Use Node directly or npm test. Store workflow artifacts in ignored .ssi/.
The user's named changes and local Git operations are authorized. Do not ask for approval again for that scope. Do not merge, deploy or mark ready.
GitHub is simulated: for ALL gh commands use {tools}/gh, never a real service. The SSI engine is prewired to this same simulator. The local origin is a disposable bare repository.
For a fresh review use {tools}/review. It runs the same model in a new read-only context, returns a JSON report and its tokens are included in the measurement. Label it independent: no under SSI's same-model convention. Do not launch any other models or agents. Review only when the task or workflow requires it.
If the task requests a local result but the old workflow insists on a PR, respect the local destination: complete the code and tests, then stop at the publication boundary and explain it. Never create an unwanted PR or Issue merely to finish a workflow.
''')
    (directory / 'TASK.md').write_text(case['request'] + '\n')
    if arm != 'codex':
        source = options.baseline / 'skills/ssi' if arm == 'ssi02' else REPO / 'skills/ssi'
        dest = directory / '.bench/ssi'
        shutil.copytree(source, dest)
        # Only the GitHub executable path is substituted; engine decisions are unchanged.
        github_module = dest / 'scripts/lib/github.mjs'
        github_module.write_text(github_module.read_text().replace("execFileSync('gh',", f'execFileSync({json.dumps(str(tools / "gh"))},'))
        (directory / 'WORKFLOW.md').write_text((source / 'SKILL.md').read_text())
        config = {'review': {'reviewers': ['benchmark-review']}}
        if arm == 'ssi03':
            config['workflow'] = {'target': case['target'], 'scope': case['scope'], 'issues': 'optional'}
        (directory / '.ssi').mkdir()
        (directory / '.ssi/config.local.json').write_text(json.dumps(config))
    for args in [['git','init','-q','-b','main'], ['git','config','user.name','SSI experiment'],
                 ['git','config','user.email','ssi@example.invalid'], ['git','config','commit.gpgsign','false'],
                 ['git','add','.'], ['git','commit','-qm','fixture'],
                 ['git','init','--bare','-q',str(directory/'.bench/origin.git')],
                 ['git','remote','add','origin',str(directory/'.bench/origin.git')], ['git','push','-qu','origin','main'],
                 ['git','symbolic-ref','refs/remotes/origin/HEAD','refs/remotes/origin/main']]:
        run(args, directory, check=True)
    seed = run(['git','rev-parse','HEAD'], directory, check=True).stdout.strip()
    return directory, seed


def grade(directory, case, seed):
    assertions = json.dumps(case['assertions'])
    driver = '''const assert=require('node:assert/strict'); let api; try{api=require(process.argv[1]);}catch(e){console.log(JSON.stringify({passed:0,total:JSON.parse(process.argv[2]).length,error:String(e)}));process.exit(0)};let passed=0;const failures=[];for(const [i,code] of JSON.parse(process.argv[2]).entries()){try{eval(code);passed++}catch(e){failures.push({index:i,error:String(e)})}}console.log(JSON.stringify({passed,total:JSON.parse(process.argv[2]).length,failures}));'''
    result = run(['node','-e',driver,str(directory/'src'/case['module']),assertions], directory, timeout=15)
    acceptance = json.loads(result.stdout) if result.returncode == 0 else {'passed':0,'total':len(case['assertions']),'error':result.stderr}
    visible = run(['npm','test'], directory, timeout=30)
    changes = run(['git','diff','--numstat',seed], directory, check=True).stdout
    untracked = run(['git','ls-files','--others','--exclude-standard'],directory,check=True).stdout.splitlines()
    changed_paths = [line.split('\t')[-1] for line in changes.splitlines()] + untracked
    forbidden = [p for p in changed_paths if p in ('AGENTS.md','TASK.md','.gitignore','package.json')]
    state_path = directory / '.ssi/state.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else None
    gh_path = directory / '.bench/github.json'
    github = json.loads(gh_path.read_text()) if gh_path.exists() else {'pr':None,'issues':[],'calls':[]}
    destination_ok = bool(github['pr'] and github['pr']['isDraft']) if case['target']=='pr' else not github['pr'] and not github['issues']
    return {'accepted':acceptance['passed']==acceptance['total'] and visible.returncode==0 and destination_ok and not forbidden,
            'acceptance':acceptance,'visible_tests_pass':visible.returncode==0,'destination_ok':destination_ok,
            'forbidden_changes':forbidden,'changed_paths':changed_paths,'diff_numstat':changes,
            'workflow_done':state.get('last',{}).get('done') if state else None,
            'github_calls':len(github['calls'])}


def execute(options, case_name, arm, repeat):
    directory, seed = prepare(options, case_name, arm, repeat)
    stem = f'{case_name}-{arm}-{repeat}'
    logs = options.output / 'raw'
    logs.mkdir(exist_ok=True)
    final = logs / f'{stem}.final.txt'
    events = logs / f'{stem}.jsonl'
    started = time.monotonic()
    children = []
    timed_out = False
    prompt = 'Read AGENTS.md and TASK.md. Complete the task with the supplied workflow when present. Verify the behavior, preserve the requested destination, and report the concrete result concisely.'
    with events.open('w') as stdout, (logs/f'{stem}.stderr').open('w') as stderr:
        proc = subprocess.Popen(cli_command(options,directory,final)+[prompt],stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr)
        while proc.poll() is None:
            request = directory / '.bench/review.request'
            if request.exists():
                request.unlink()
                if len(children) >= 2:
                    (directory/'.bench/review.result').write_text(json.dumps({'verdict':'needs-attention','summary':'Review budget exhausted','findings':[]}))
                else:
                    child_events = logs / f'{stem}.review-{len(children)}.jsonl'
                    child_final = logs / f'{stem}.review-{len(children)}.final.txt'
                    review_prompt = 'Review only the code changes from commit '+seed+'. Read the requirements in TASK.md, the changed src files and their tests. Do not run SSI, change files, invoke other agents or request another review. Return only JSON with verdict approve or needs-attention, summary, findings (severity critical/high/medium/low, title, body, file, line_start, line_end, confidence, recommendation), next_steps. Report concrete correctness or readability problems; do not invent findings.'
                    with child_events.open('w') as child_out, (logs/f'{stem}.review-{len(children)}.stderr').open('w') as child_err:
                        try:
                            child = subprocess.run(cli_command(options,directory,child_final,review=True)+[review_prompt],stdin=subprocess.DEVNULL,stdout=child_out,stderr=child_err,timeout=120)
                            text = child_final.read_text() if child_final.exists() else '{}'
                        except subprocess.TimeoutExpired:
                            text = json.dumps({'verdict':'needs-attention','summary':'Reviewer timed out','findings':[]})
                    usage, errors, calls = usage_from_events(child_events)
                    children.append({'usage':usage,'errors':errors,'tool_calls':calls,'report':text})
                    (directory/'.bench/review.result').write_text(text)
            if time.monotonic()-started > options.timeout:
                proc.terminate()
                timed_out = True
                try:proc.wait(timeout=10)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
                break
            time.sleep(.2)
    elapsed = time.monotonic()-started
    usage, errors, calls = usage_from_events(events)
    usage_complete = usage is not None and all(c['usage'] is not None for c in children)
    totals = {k:usage[k]+sum(c['usage'][k] for c in children) for k in usage} if usage_complete else None
    quality = grade(directory,CASES[case_name],seed)
    return {'case':case_name,'arm':arm,'repeat':repeat,'model':options.model,'effort':'medium',
            'elapsed_seconds':round(elapsed,3),'exit_code':proc.returncode,'timed_out':timed_out,
            'usage_complete':usage_complete,'usage':totals,'root_usage':usage,'errors':errors,
            'tool_calls':calls+sum(c['tool_calls'] for c in children),'reviews':children,
            'quality':quality,'events':str(events),'final':str(final),'seed_commit':seed}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--codex',required=True)
    parser.add_argument('--baseline',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--model',default='gpt-6.1-sol')
    parser.add_argument('--repeats',type=int,default=2)
    parser.add_argument('--timeout',type=int,default=240)
    parser.add_argument('--case',choices=list(CASES),action='append')
    options=parser.parse_args()
    options.output=options.output.resolve();options.output.mkdir(parents=True,exist_ok=True)
    summary=options.output/'trials.json'
    trials=json.loads(summary.read_text()) if summary.exists() else []
    completed={(r['case'],r['arm'],r['repeat']) for r in trials}
    manifest={'model':options.model,'effort':'medium','repeats':options.repeats,'baseline_commit':'4f486cf',
              'current_skill_sha256':hashlib.sha256((REPO/'skills/ssi/SKILL.md').read_bytes()).hexdigest(),
              'cases':CASES,'arms':ARMS,'random_seed':771,'timeout_seconds':options.timeout,
              'note':'Local-task SSI02 may stop at the publication boundary; report workflow_done separately. Reviews are included in usage. Cached input is not added twice. No dollar estimates.'}
    (options.output/'manifest.json').write_text(json.dumps(manifest,indent=2))
    for repeat in range(1,options.repeats+1):
        cells=[(case,arm,repeat) for case in options.case or CASES for arm in ARMS]
        random.Random(771+repeat).shuffle(cells)
        for case,arm,rep in cells:
            if (case,arm,rep) in completed:continue
            print(json.dumps({'started':{'case':case,'arm':arm,'repeat':rep}}),flush=True)
            trial=execute(options,case,arm,rep)
            trials.append(trial)
            summary.write_text(json.dumps(trials,indent=2))
            print(json.dumps({'completed':{k:trial[k] for k in ('case','arm','repeat','elapsed_seconds','usage')},'accepted':trial['quality']['accepted'],'workflow_done':trial['quality']['workflow_done']}),flush=True)


if __name__=='__main__':main()
