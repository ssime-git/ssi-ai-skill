#!/usr/bin/env python3
"""Summarize paired trials without treating missing usage or failures as savings."""
import argparse
import json
from pathlib import Path
import statistics


def review_approved(trial):
    if trial['case'] != 'quote_pr':
        return True
    if not trial.get('reviews'):
        return False
    text = trial['reviews'][-1]['report'].strip()
    if text.startswith('```'):
        text = '\n'.join(text.splitlines()[1:-1])
    try:
        report = json.loads(text)
    except ValueError:
        return False
    return report.get('verdict') == 'approve' and not any(f.get('severity') in ('critical', 'high') for f in report.get('findings', []))


def summarize(trials):
    enriched = []
    for original in trials:
        trial = dict(original)
        trial['fresh_review_ok'] = review_approved(trial)
        trial['task_success'] = bool(trial['quality']['accepted'] and trial['fresh_review_ok']
                                     and trial['exit_code'] == 0 and not trial['timed_out'])
        trial['metered'] = bool(trial['usage_complete'] and trial['usage'] is not None)
        enriched.append(trial)
    arms = {}
    for arm in sorted({t['arm'] for t in enriched}):
        rows = [t for t in enriched if t['arm'] == arm]
        measured = [t for t in rows if t['metered']]
        arms[arm] = {
            'attempts':len(rows), 'successful_tasks':sum(t['task_success'] for t in rows),
            'metered_attempts':len(measured),
            'total_tokens':sum(t['usage']['total_tokens'] for t in measured),
            'uncached_input_tokens':sum(t['usage']['uncached_input_tokens'] for t in measured),
            'output_tokens':sum(t['usage']['output_tokens'] for t in measured),
            'cached_input_tokens':sum(t['usage']['cached_input_tokens'] for t in measured),
            'median_elapsed_seconds':round(statistics.median(t['elapsed_seconds'] for t in rows),3),
            'elapsed_seconds':round(sum(t['elapsed_seconds'] for t in rows),3),
            'unmetered_attempts':len(rows)-len(measured),
        }
    pairs = []
    by_key = {(t['case'],t['repeat'],t['arm']):t for t in enriched}
    for reference in ('codex','ssi02'):
        for case, repeat, arm in sorted(by_key):
            if arm != 'ssi03':
                continue
            current = by_key[(case,repeat,arm)]
            before = by_key.get((case,repeat,reference))
            if not before:
                continue
            valid = current['metered'] and before['metered'] and current['task_success'] and before['task_success']
            pair = {'case':case,'repeat':repeat,'reference':reference,'valid_success_pair':valid}
            if valid:
                for metric in ('total_tokens','uncached_input_tokens','output_tokens'):
                    old, new = before['usage'][metric], current['usage'][metric]
                    pair[metric+'_reduction_percent'] = round(100*(1-new/old),2) if old else None
                pair['elapsed_reduction_percent'] = round(100*(1-current['elapsed_seconds']/before['elapsed_seconds']),2)
            pairs.append(pair)
    return {'arms':arms,'pairs':pairs,'trials':enriched,
            'limitations':['Two repetitions per cell are exploratory, not statistically conclusive.',
                           'Cached input is included in total input; reasoning is included in output.',
                           'The model and tool environment are fixed; cache hits and service latency still vary.',
                           'Local SSI02 can stop before publication; workflow_done is not the same as task correctness.',
                           'GitHub and CI are simulated; acceptance tests and model reviews run for real.',
                           'No dollar-cost estimate or proof of universal readability improvement.']}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('trials',type=Path)
    parser.add_argument('--output',type=Path,required=True)
    options=parser.parse_args()
    data=summarize(json.loads(options.trials.read_text()))
    options.output.write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps({'arms':data['arms'],'pairs':data['pairs']},indent=2))


if __name__=='__main__':main()
