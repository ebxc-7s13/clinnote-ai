#!/usr/bin/env python3
"""ClinNote TaskCreated / TaskCompleted quality-gate hook (H6/H8).

Read-only. Exit 2 blocks the task creation/completion and sends the reason to the agent.

Task description tags (one per line, see docs/QUALITY-GATES.md "Task tags"):
  Owner: <agent-name>                 required on every task (TaskCreated)
  Handoff: docs/agent-handoffs/<f>.md required to complete when present
  Tests-required: yes|no              yes => handoff "## Tests" must contain real results
  Safety-sensitive: yes|no            yes => handoff must contain "Safety review: PASS"
  Security-sensitive: yes|no          yes => handoff must contain "Security review: PASS"
Every referenced handoff is also scanned for credentials (credential exposure fails security review).

Dependencies (TaskCompleted): Claude Code's `blockedBy` only stops teammates from *claiming* a task; an explicit
TaskUpdate can still complete it (observed 2026-10-08, Stage A). This hook therefore reads the session's task list
(read-only) at $CLAUDE_CONFIG_DIR/tasks/<team_name | session-<first 8 chars of session_id> | any list whose <id>.json has
the same subject>/<id>.json and blocks completion while any blocker exists with a status other than "completed".
If the task file cannot be found, the check is skipped.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from secret_guard import find_secret  # noqa: E402

AGENTS = {
    "chief-architect", "product-clinical-architect", "mobile-android-engineer", "backend-api-engineer",
    "speech-diarization-engineer", "ai-clinical-engineer", "evidence-research-engineer", "data-engineer",
    "security-privacy-engineer", "clinical-safety-engineer", "qa-test-engineer",
    "devops-android-release-engineer", "ux-accessibility-engineer", "integration-reviewer", "project-owner",
}


def tag(desc, name):
    m = re.search(rf"^\s*{re.escape(name)}\s*:\s*(.+?)\s*$", desc, re.IGNORECASE | re.MULTILINE)
    return m.group(1).strip() if m else None


def section(text, heading):
    m = re.search(rf"^##\s*{re.escape(heading)}\s*$(.*?)(?=^##\s|\Z)", text, re.MULTILINE | re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else None


def open_blockers(data):
    """Return [(id, status)] of blockers that are not completed, or [] if the task list cannot be read."""
    sid = data.get("session_id") or ""
    tid = str(data.get("task_id") or "")
    if not sid or not tid:
        return []
    root = os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")
    names = [f"session-{sid[:8]}"]
    if data.get("team_name"):
        names.insert(0, str(data["team_name"]))
    # When agent teammates are active, the shared task list can live in a team directory whose name matches neither
    # the session id nor the payload (observed 2026-10-08, Stage A resume). Fall back to any task list whose
    # <id>.json has the same subject, so the dependency check is not silently skipped.
    subject = data.get("task_subject") or ""
    tasks_root = os.path.join(root, "tasks")
    if subject and os.path.isdir(tasks_root):
        for name in sorted(os.listdir(tasks_root)):
            if name in names:
                continue
            cand = os.path.join(tasks_root, name, f"{tid}.json")
            try:
                if os.path.isfile(cand) and json.load(open(cand, encoding="utf-8")).get("subject") == subject:
                    names.append(name)
            except Exception:
                continue
    for name in names:
        tdir = os.path.join(root, "tasks", name)
        tfile = os.path.join(tdir, f"{tid}.json")
        if not os.path.isfile(tfile):
            continue
        try:
            task = json.load(open(tfile, encoding="utf-8"))
        except Exception:
            return []
        pending = []
        for bid in task.get("blockedBy") or []:
            bfile = os.path.join(tdir, f"{bid}.json")
            if not os.path.isfile(bfile):
                continue  # a deleted blocker no longer blocks
            try:
                status = json.load(open(bfile, encoding="utf-8")).get("status", "")
            except Exception:
                status = "unreadable"
            if status != "completed":
                pending.append((str(bid), status))
        return pending
    return []


def block(msg):
    print(f"BLOCKED by ClinNote quality gate: {msg} (docs/QUALITY-GATES.md)", file=sys.stderr)
    return 2


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    event = data.get("hook_event_name", "")
    desc = data.get("task_description") or ""
    subject = data.get("task_subject") or ""
    cwd = data.get("cwd") or os.getcwd()

    owner = tag(desc, "Owner")
    if event == "TaskCreated":
        if not owner:
            return block(f"task '{subject}' has no 'Owner: <agent-name>' line")
        if owner.split()[0] not in AGENTS:
            return block(f"task '{subject}' owner '{owner}' is not a ClinNote agent (docs/AGENT-OWNERSHIP.md)")
        return 0

    if event != "TaskCompleted":
        return 0

    pending = open_blockers(data)
    if pending:
        listed = ", ".join(f"#{b} ({st})" for b, st in pending)
        return block(f"task '{subject}' depends on unfinished task(s) {listed}; complete them first")

    handoff = tag(desc, "Handoff")
    tests_required = (tag(desc, "Tests-required") or "no").lower().startswith("y")
    safety = (tag(desc, "Safety-sensitive") or "no").lower().startswith("y")
    security = (tag(desc, "Security-sensitive") or "no").lower().startswith("y")

    if not handoff:
        if tests_required or safety or security:
            return block(f"task '{subject}' is gated (tests/safety/security) but declares no 'Handoff:' file")
        return 0

    # Relative handoff paths are repository-relative. A session's cwd may be a subdirectory (e.g. docs/),
    # so try the project root as well as the cwd.
    if os.path.isabs(handoff):
        path = handoff
    else:
        roots = [r for r in (os.environ.get("CLAUDE_PROJECT_DIR"), cwd) if r]
        path = next((os.path.join(r, handoff) for r in roots if os.path.isfile(os.path.join(r, handoff))),
                    os.path.join(cwd, handoff))
    if not os.path.isfile(path):
        return block(f"handoff file '{handoff}' for task '{subject}' does not exist")
    text = open(path, encoding="utf-8", errors="ignore").read()

    label = find_secret(text)
    if label:
        return block(f"handoff '{handoff}' contains a {label}; credential exposure fails security review (SECURITY.md §16)")

    for required in ("Tests", "Evidence", "Receiving Agent"):
        body = section(text, required)
        if not body:
            return block(f"handoff '{handoff}' is missing a non-empty '## {required}' section")

    if tests_required:
        tests = section(text, "Tests") or ""
        if re.match(r"^\s*(none|n/?a|todo|tbd|-)\b", tests, re.IGNORECASE) or not re.search(r"\d", tests):
            return block(f"task '{subject}' requires tests but the handoff '## Tests' section has no test command/result counts; it cannot be accepted as complete")

    if safety and not re.search(r"Safety review:\s*PASS", text, re.IGNORECASE):
        return block(f"task '{subject}' is safety-sensitive but has no 'Safety review: PASS' from clinical-safety-engineer")

    if security and not re.search(r"Security review:\s*PASS", text, re.IGNORECASE):
        return block(f"task '{subject}' is security-sensitive but has no 'Security review: PASS' from security-privacy-engineer")

    return 0


if __name__ == "__main__":
    sys.exit(main())
