#!/usr/bin/env python3
"""Tests for ClinNote quality-gate hooks. Stdlib only. Run: python3 -I .claude/hooks/tests/test_hooks.py

Fake credentials are assembled at runtime so no secret-like literal is stored in the repository.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOKS = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FAKE_KEY = "OPENAI" + "_API_KEY=" + "x" * 8 + "Y" * 16          # synthetic, assembled at runtime
FAKE_SK = "sk" + "-" + "Z" * 24                                     # synthetic


def run(script, payload, env=None):
    p = subprocess.run([sys.executable, "-I", os.path.join(HOOKS, script)], input=json.dumps(payload),
                       capture_output=True, text=True, timeout=30, env=env)
    return p.returncode, p.stderr


HANDOFF_OK = """# Task Handoff
## Owner
qa-test-engineer
## Task
T-1 synthetic
## Tests
`npm test` — 42 passed, 0 failed (2026-10-08)
## Evidence
output excerpt
## Receiving Agent
chief-architect
Safety review: PASS (clinical-safety-engineer)
Security review: PASS (security-privacy-engineer)
"""


class SecretGuardTests(unittest.TestCase):
    def test_write_with_secret_blocked(self):
        code, err = run("secret_guard.py", {"tool_name": "Write", "tool_input": {"file_path": "/w/x.md", "content": "a " + FAKE_KEY}})
        self.assertEqual(code, 2, err)

    def test_edit_with_sk_key_blocked(self):
        code, _ = run("secret_guard.py", {"tool_name": "Edit", "tool_input": {"file_path": "/w/x.ts", "old_string": "a", "new_string": FAKE_SK}})
        self.assertEqual(code, 2)

    def test_env_file_blocked(self):
        code, _ = run("secret_guard.py", {"tool_name": "Write", "tool_input": {"file_path": "/w/.env", "content": "A=1"}})
        self.assertEqual(code, 2)

    def test_env_example_allowed(self):
        code, _ = run("secret_guard.py", {"tool_name": "Write", "tool_input": {"file_path": "/w/.env.example", "content": "GEMINI_API_KEY="}})
        self.assertEqual(code, 0)

    def test_doc_mentioning_variable_name_allowed(self):
        code, _ = run("secret_guard.py", {"tool_name": "Write", "tool_input": {"file_path": "/w/d.md", "content": "Set GEMINI_API_KEY in the backend secret store."}})
        self.assertEqual(code, 0)

    def test_model_download_blocked(self):
        for cmd in ["pip install torch", "huggingface-cli download some/model", "curl -O https://x/y.safetensors"]:
            code, _ = run("secret_guard.py", {"tool_name": "Bash", "tool_input": {"command": cmd}})
            self.assertEqual(code, 2, cmd)

    def test_normal_bash_allowed(self):
        code, _ = run("secret_guard.py", {"tool_name": "Bash", "tool_input": {"command": "git status"}})
        self.assertEqual(code, 0)


class TaskGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def handoff(self, text):
        path = os.path.join(self.tmp, "h.md")
        with open(path, "w") as f:
            f.write(text)
        return path

    def completed(self, desc):
        return run("task_gate.py", {"hook_event_name": "TaskCompleted", "task_subject": "T", "task_description": desc, "cwd": self.tmp})

    def test_created_without_owner_blocked(self):
        code, _ = run("task_gate.py", {"hook_event_name": "TaskCreated", "task_subject": "T", "task_description": "no owner"})
        self.assertEqual(code, 2)

    def test_created_with_unknown_owner_blocked(self):
        code, _ = run("task_gate.py", {"hook_event_name": "TaskCreated", "task_subject": "T", "task_description": "Owner: random-bot"})
        self.assertEqual(code, 2)

    def test_created_with_owner_allowed(self):
        code, _ = run("task_gate.py", {"hook_event_name": "TaskCreated", "task_subject": "T", "task_description": "Owner: qa-test-engineer"})
        self.assertEqual(code, 0)

    def test_relative_handoff_found_from_subdirectory_cwd(self):
        # The session cwd may be a subdirectory (docs/); repository-relative handoffs resolve via CLAUDE_PROJECT_DIR.
        os.makedirs(os.path.join(self.tmp, "docs", "agent-handoffs"))
        with open(os.path.join(self.tmp, "docs", "agent-handoffs", "h.md"), "w") as f:
            f.write(HANDOFF_OK)
        env = dict(os.environ, CLAUDE_PROJECT_DIR=self.tmp)
        payload = {"hook_event_name": "TaskCompleted", "task_subject": "T", "cwd": os.path.join(self.tmp, "docs"),
                   "task_description": "Owner: qa-test-engineer\nHandoff: docs/agent-handoffs/h.md\nTests-required: yes"}
        self.assertEqual(run("task_gate.py", payload, env=env)[0], 0)

    def test_untagged_completion_allowed(self):
        self.assertEqual(self.completed("Owner: qa-test-engineer")[0], 0)

    def test_missing_tests_not_release_complete(self):
        p = self.handoff(HANDOFF_OK.replace("`npm test` — 42 passed, 0 failed (2026-10-08)", "none"))
        code, err = self.completed(f"Owner: qa-test-engineer\nHandoff: {p}\nTests-required: yes")
        self.assertEqual(code, 2, err)
        self.assertIn("requires tests", err)

    def test_safety_sensitive_without_review_rejected(self):
        p = self.handoff(HANDOFF_OK.replace("Safety review: PASS (clinical-safety-engineer)", ""))
        code, err = self.completed(f"Owner: ai-clinical-engineer\nHandoff: {p}\nTests-required: yes\nSafety-sensitive: yes")
        self.assertEqual(code, 2, err)
        self.assertIn("safety-sensitive", err)

    def test_credential_exposure_fails_security(self):
        p = self.handoff(HANDOFF_OK + "\n" + FAKE_KEY + "\n")
        code, err = self.completed(f"Owner: backend-api-engineer\nHandoff: {p}\nSecurity-sensitive: yes")
        self.assertEqual(code, 2, err)
        self.assertIn("credential", err)

    def test_missing_handoff_file_blocked(self):
        code, _ = self.completed(f"Owner: qa-test-engineer\nHandoff: {self.tmp}/nope.md\nTests-required: yes")
        self.assertEqual(code, 2)

    def test_gated_without_handoff_blocked(self):
        self.assertEqual(self.completed("Owner: ai-clinical-engineer\nSafety-sensitive: yes")[0], 2)

    def test_compliant_task_allowed(self):
        p = self.handoff(HANDOFF_OK)
        code, err = self.completed(f"Owner: ai-clinical-engineer\nHandoff: {p}\nTests-required: yes\nSafety-sensitive: yes\nSecurity-sensitive: yes")
        self.assertEqual(code, 0, err)


class TaskDependencyTests(unittest.TestCase):
    """Native blockedBy does not stop an explicit TaskUpdate; the hook must (Stage A finding)."""

    def setUp(self):
        self.cfg = tempfile.mkdtemp()
        self.tdir = os.path.join(self.cfg, "tasks", "session-abcd1234")
        os.makedirs(self.tdir)
        self.env = dict(os.environ, CLAUDE_CONFIG_DIR=self.cfg)

    def task(self, tid, status, blocked_by=()):
        with open(os.path.join(self.tdir, f"{tid}.json"), "w") as f:
            json.dump({"id": tid, "status": status, "blockedBy": list(blocked_by)}, f)

    def complete(self, tid):
        payload = {"hook_event_name": "TaskCompleted", "session_id": "abcd1234-0000", "task_id": tid,
                   "task_subject": "D", "task_description": "Owner: chief-architect", "cwd": self.cfg}
        return run("task_gate.py", payload, env=self.env)

    def test_completion_blocked_while_blocker_open(self):
        self.task("1", "pending"); self.task("2", "completed"); self.task("4", "in_progress", ["1", "2"])
        code, err = self.complete("4")
        self.assertEqual(code, 2, err)
        self.assertIn("#1 (pending)", err)

    def test_completion_allowed_when_blockers_completed(self):
        self.task("1", "completed"); self.task("2", "completed"); self.task("4", "in_progress", ["1", "2"])
        self.assertEqual(self.complete("4")[0], 0)

    def test_deleted_blocker_does_not_block(self):
        self.task("4", "in_progress", ["9"])
        self.assertEqual(self.complete("4")[0], 0)

    def test_team_task_list_found_by_subject(self):
        # Team task lists can live in a directory unrelated to the session id (observed 2026-10-08).
        tdir = os.path.join(self.cfg, "tasks", "session-ff00ff00")
        os.makedirs(tdir)
        for tid, st, bb, subj in (("9", "pending", [], "blocker"), ("10", "in_progress", ["9"], "D")):
            with open(os.path.join(tdir, f"{tid}.json"), "w") as f:
                json.dump({"id": tid, "subject": subj, "status": st, "blockedBy": bb}, f)
        code, err = self.complete("10")
        self.assertEqual(code, 2, err)
        self.assertIn("#9 (pending)", err)

    def test_unknown_task_list_is_skipped(self):
        self.assertEqual(self.complete("99")[0], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
