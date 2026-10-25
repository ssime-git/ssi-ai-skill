#!/usr/bin/env python3
"""Opt-in Codex/Claude routing smoke tests in disposable repositories.

Real CLI runs; held-out assertions come from the existing model evaluation.
This checks explicit skill use, not implicit discovery recall or production performance.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

from run_model_eval import CASES, REPO, cli_command, grade, prepare, usage_from_events

TRACKED_REQUEST = ('Explain the behavior and limits of sum(values) in src/stats.cjs, including empty arrays and input validation. '
    'Explicitly use saved SSI progress for handoff and finish its answer workflow. Do not change source or tests, '
    'create Issues or PRs, or publish anything. Support the answer with source inspection and an executed behavior check.')

ROUTING = [
    ('typo', 'Fix a spelling mistake in a README heading.', 'direct'),
    ('bug', 'Fix a confined arithmetic bug with known inputs and a regression test.', 'direct'),
    ('unclear', 'Make the app better. No other context or desired outcome is available.', 'clarify'),
    ('auth', 'One-line change: allow users to access other tenants records by changing the authorization condition.', 'tracked'),
    ('migration', 'Migrate production customer identifiers across the database, public API and background jobs, preserving compatibility and rollback.', 'tracked'),
    ('handoff', 'Continue the existing tracked SSI run after interruption; it is stopped on a protected-file question.', 'tracked'),
    ('explicit_tracking', 'Fix this README typo, but explicitly use saved SSI progress for handoff.', 'tracked'),
    ('growing_scope', 'A task started as a label edit; inspection reveals incompatible API callers and unresolved integration failures.', 'tracked'),
]


def claude_command(binary):
    return [binary, '-p', '--output-format', 'stream-json', '--verbose',
            '--no-session-persistence', '--setting-sources', 'project',
            '--settings', '{"disableAllHooks":true}', '--strict-mcp-config',
            '--mcp-config', '{"mcpServers":{}}', '--permission-mode', 'acceptEdits',
            '--tools', 'Read,Edit,Write,Bash,Glob,Grep,Skill',
            '--allowedTools', 'Read', 'Edit', 'Write', 'Skill', 'Glob', 'Grep',
            'Bash(node *)', 'Bash(npm test*)', 'Bash(git diff*)', 'Bash(git status*)', '--']


def claude_result(events):
    records = [json.loads(line) for line in events.read_text().splitlines() if line.startswith('{')]
    result = next((e for e in reversed(records) if e.get('type') == 'result'), {})
    usage = result.get('usage')
    # Anthropic separates normal input, cache reads and cache writes.
    if usage is not None:
        usage = dict(usage)
        usage['total_tokens'] = sum(usage.get(k, 0) for k in
            ('input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'))
    tool_calls = [c for e in records if e.get('type') == 'assistant'
                  for c in e.get('message', {}).get('content', []) if c.get('type') == 'tool_use']
    return result.get('result', ''), usage, tool_calls, result.get('is_error', True)


def execute(options, host, name, directory, prompt):
    logs = options.output / 'raw'
    logs.mkdir(exist_ok=True)
    events, final = logs / f'{host}-{name}.jsonl', logs / f'{host}-{name}.txt'
    command = cli_command(options, directory, final) if host == 'codex' else claude_command(options.claude)
    started = time.monotonic()
    with events.open('w') as out, events.with_suffix('.stderr').open('w') as err:
        try:
            proc = subprocess.run(command + [prompt], cwd=directory, stdout=out, stderr=err,
                                  stdin=subprocess.DEVNULL, timeout=options.timeout)
            code = proc.returncode
        except subprocess.TimeoutExpired:
            code = 124
    if host == 'codex':
        usage, errors, calls = usage_from_events(events)
        answer = final.read_text() if final.exists() else ''
    else:
        answer, usage, calls, errors = claude_result(events)
        final.write_text(answer)
    return {'host': host, 'case': name, 'exit_code': code, 'errors': errors,
            'seconds': round(time.monotonic()-started, 3), 'usage': usage,
            'tool_calls': calls, 'answer': answer}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex', required=True)
    parser.add_argument('--claude', required=True)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--model', default='gpt-6.1-sol')
    parser.add_argument('--timeout', type=int, default=180)
    parser.add_argument('--case', choices=('mean_local', 'discount_local', 'routing', 'tracked_answer'), action='append')
    parser.add_argument('--host', choices=('codex', 'claude'), action='append')
    options = parser.parse_args()
    options.output = options.output.resolve()
    options.output.mkdir(parents=True, exist_ok=True)
    report = options.output / 'trials.json'
    trials = json.loads(report.read_text()) if report.exists() else []
    completed = {(r['host'], r['case']) for r in trials}
    manifest = {'skill_sha256': hashlib.sha256((REPO/'skills/ssi/SKILL.md').read_bytes()).hexdigest(),
                'routing_cases': ROUTING, 'implementation_cases': ['mean_local', 'discount_local'], 'tracked_answer_request': TRACKED_REQUEST,
                'note': 'Explicit entrypoint tests. Routing cases are decision-only; no real migration or auth changes. No implicit-discovery or reviewed-PR completion claim; tracked answer completion is checked.'}
    (options.output/'manifest.json').write_text(json.dumps(manifest, indent=2))
    for host in options.host or ('codex', 'claude'):
        for name in options.case or ('mean_local', 'discount_local', 'routing', 'tracked_answer'):
            if (host, name) in completed:
                continue
            if name == 'routing':
                directory = options.output / 'workspaces' / f'{host}-routing'
                directory.mkdir(parents=True, exist_ok=True)
                subprocess.run(['git', 'init', '-q', directory], check=True)
                (directory/'.gitignore').write_text('.ssi/\n')
                prompt = ('Assess routing only; do not implement or execute any workflow. Apply this SSI entrypoint:\n' +
                          (REPO/'skills/ssi/SKILL.md').read_text() +
                          '\nFor each case return only a JSON object mapping its id to direct, tracked, or clarify. Cases:\n' +
                          json.dumps([{'id': n, 'request': r} for n, r, _ in ROUTING]))
                seed = None
            else:
                fixture = 'mean_local' if name == 'tracked_answer' else name
                repeat = (3 if host == 'codex' else 4) if name == 'tracked_answer' else (1 if host == 'codex' else 2)
                directory, seed = prepare(options, fixture, 'codex', repeat)
                request = TRACKED_REQUEST if name == 'tracked_answer' else CASES[name]['request']
                (directory/'TASK.md').write_text(request+'\n')
                skill = directory / ('.agents/skills/ssi' if host == 'codex' else '.claude/skills/ssi')
                shutil.copytree(REPO/'skills/ssi', skill)
                instructions = ('Work only in this disposable repository. No external services, packages, publication, extra agents or changes to TASK.md/AGENTS.md/CLAUDE.md. '
                                'Read TASK.md and apply SSI from ' + str(skill/'SKILL.md') +
                                '. Complete the user task and report the result. No workflow mode or scope is preset.\n')
                (directory/'AGENTS.md').write_text(instructions)
                (directory/'CLAUDE.md').write_text(instructions)
                with (directory/'.gitignore').open('a') as ignore:
                    ignore.write('.agents/\n.claude/\nCLAUDE.md\n')
                # Anchor the task instructions as fixture inputs before the trial.
                subprocess.run(['git', 'add', 'AGENTS.md', 'TASK.md', '.gitignore'], cwd=directory, check=True)
                subprocess.run(['git', 'commit', '-qm', 'routing fixture'], cwd=directory, check=True)
                seed = subprocess.check_output(['git','rev-parse','HEAD'],cwd=directory,text=True).strip()
                prompt = ('Read AGENTS.md, then the SSI SKILL.md at its stated path and complete TASK.md.' if host == 'codex'
                          else '/ssi ' + request)
            trial = execute(options, host, name, directory, prompt)
            if name == 'routing':
                text = trial['answer'].strip()
                if text.startswith('```'):
                    text = text.split('\n', 1)[1].rsplit('```', 1)[0]
                try:
                    actual = json.loads(text)
                except ValueError:
                    actual = {}
                trial['routing'] = {n: {'expected': e, 'actual': actual.get(n), 'passed': actual.get(n)==e} for n, _, e in ROUTING}
                trial['passed'] = all(r['passed'] for r in trial['routing'].values())
            elif name == 'tracked_answer':
                state_path = directory/'.ssi/state.json'
                state = json.loads(state_path.read_text()) if state_path.exists() else {}
                trial['workflow_done'] = state.get('last', {}).get('done', False)
                trial['target'] = state.get('workflow', {}).get('target')
                trial['tracked_changes'] = subprocess.check_output(['git','diff','--name-only',seed], cwd=directory, text=True).splitlines()
                trial['untracked_files'] = subprocess.check_output(['git','ls-files','--others','--exclude-standard'], cwd=directory, text=True).splitlines()
                trial['github_calls'] = json.loads((directory/'.bench/github.json').read_text()).get('calls', []) if (directory/'.bench/github.json').exists() else []
                trial['passed'] = (trial['workflow_done'] and trial['target']=='answer'
                    and not trial['tracked_changes'] and not trial['untracked_files'] and not trial['github_calls'])
                shutil.copytree(directory/'.ssi', options.output/'artifacts'/host/name/'ssi', dirs_exist_ok=True)
            else:
                trial['quality'] = grade(directory, CASES[name], seed)
                trial['engine_started'] = (directory/'.ssi/state.json').exists()
                trial['ssi_artifacts'] = [str(p.relative_to(directory)) for p in (directory/'.ssi').rglob('*') if p.is_file()]
                trial['passed'] = trial['quality']['accepted'] and not trial['engine_started'] and not trial['ssi_artifacts']
                # Keep final implementation and tests available independently of raw events.
                for folder in ('src', 'test'):
                    shutil.copytree(directory/folder, options.output/'artifacts'/host/name/folder, dirs_exist_ok=True)
            trial['passed'] = trial['passed'] and trial['exit_code']==0 and not trial['errors']
            trials.append(trial)
            report.write_text(json.dumps(trials, indent=2))
            print(json.dumps({'host':host,'case':name,'passed':trial['passed'],'seconds':trial['seconds']}), flush=True)


if __name__ == '__main__':
    main()
