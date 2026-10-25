import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('model_eval', Path(__file__).with_name('run_model_eval.py'))
eval_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(eval_module)


class UsageTests(unittest.TestCase):
    def parse(self, events):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'events.jsonl'
            path.write_text('\n'.join(json.dumps(event) for event in events))
            return eval_module.usage_from_events(path)

    def test_cache_and_reasoning_are_subsets_not_additional_tokens(self):
        usage, errors, calls = self.parse([
            {'type':'turn.completed','usage':{'input_tokens':100,'cached_input_tokens':70,'output_tokens':20,'reasoning_output_tokens':8}},
            {'type':'turn.completed','usage':{'input_tokens':200,'cached_input_tokens':150,'output_tokens':30,'reasoning_output_tokens':10}},
        ])
        self.assertEqual(usage['total_tokens'],350)
        self.assertEqual(usage['uncached_input_tokens'],80)
        self.assertEqual(usage['reasoning_output_tokens'],18)
        self.assertEqual(errors,[])
        self.assertEqual(calls,0)

    def test_missing_usage_is_unknown_not_zero(self):
        usage, errors, _ = self.parse([{'type':'turn.failed','error':{'message':'disconnected'}}])
        self.assertIsNone(usage)
        self.assertEqual(len(errors),1)

    def test_counts_only_completed_tool_items(self):
        usage, _, calls = self.parse([
            {'type':'item.started','item':{'type':'command_execution'}},
            {'type':'item.completed','item':{'type':'command_execution'}},
            {'type':'item.completed','item':{'type':'agent_message'}},
            {'type':'turn.completed','usage':{'input_tokens':10,'output_tokens':2}},
        ])
        self.assertEqual(calls,1)
        self.assertEqual(usage['total_tokens'],12)


summary_spec = importlib.util.spec_from_file_location('summary_eval', Path(__file__).with_name('summarize_model_eval.py'))
summary_module = importlib.util.module_from_spec(summary_spec)
summary_spec.loader.exec_module(summary_module)


class SummaryTests(unittest.TestCase):
    def row(self, arm, *, metered=True, accepted=True, case='mean_local'):
        usage={'input_tokens':90,'cached_input_tokens':60,'uncached_input_tokens':30,'output_tokens':10,'total_tokens':100}
        return {'case':case,'arm':arm,'repeat':1,'reviews':[],
                'quality':{'accepted':accepted},'exit_code':0,'timed_out':False,
                'usage_complete':metered,'usage':usage if metered else None,'elapsed_seconds':2}

    def test_missing_usage_cannot_be_a_zero_token_saving(self):
        result=summary_module.summarize([self.row('codex'),self.row('ssi03',metered=False)])
        self.assertFalse(result['pairs'][0]['valid_success_pair'])
        self.assertEqual(result['arms']['ssi03']['unmetered_attempts'],1)

    def test_reviewed_pr_needs_a_real_approving_review(self):
        trial=self.row('ssi03',case='quote_pr')
        self.assertFalse(summary_module.summarize([trial])['trials'][0]['task_success'])
        trial['reviews']=[{'report':json.dumps({'verdict':'approve','findings':[]})}]
        self.assertTrue(summary_module.summarize([trial])['trials'][0]['task_success'])

    def test_failure_is_reported_and_not_a_successful_pair(self):
        result=summary_module.summarize([self.row('codex'),self.row('ssi03',accepted=False)])
        self.assertFalse(result['pairs'][0]['valid_success_pair'])
        self.assertEqual(result['arms']['ssi03']['successful_tasks'],0)
        self.assertEqual(result['arms']['ssi03']['total_tokens'],100)


if __name__ == '__main__':
    unittest.main()
