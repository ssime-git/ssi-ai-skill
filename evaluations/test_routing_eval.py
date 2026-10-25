"""Provider usage must not hide cache consumption or failed runs."""
import json
from pathlib import Path
import tempfile
import unittest

from run_routing_eval import claude_result


class ClaudeResultTests(unittest.TestCase):
    def parse(self, events):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'events.jsonl'
            path.write_text('\n'.join(json.dumps(e) for e in events))
            return claude_result(path)

    def test_cache_fields_are_disjoint(self):
        _, usage, _, error = self.parse([{'type': 'result', 'result': 'done', 'is_error': False,
            'usage': {'input_tokens': 10, 'output_tokens': 3, 'cache_read_input_tokens': 20,
                      'cache_creation_input_tokens': 5}}])
        self.assertEqual(usage['total_tokens'], 38)
        self.assertFalse(error)

    def test_missing_result_is_not_success(self):
        _, usage, _, error = self.parse([{'type': 'system'}])
        self.assertIsNone(usage)
        self.assertTrue(error)

    def test_real_tool_calls_are_preserved(self):
        _, _, calls, _ = self.parse([{'type': 'assistant', 'message': {'content': [
            {'type': 'text', 'text': 'Checking'},
            {'type': 'tool_use', 'name': 'Skill', 'input': {'skill': 'ssi'}}]}}])
        self.assertEqual([c['name'] for c in calls], ['Skill'])


if __name__ == '__main__':
    unittest.main()
