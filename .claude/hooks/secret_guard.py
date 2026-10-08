#!/usr/bin/env python3
"""ClinNote PreToolUse hook (H1/H2/H3): block secrets and model-weight downloads.

Read-only. Never modifies or deletes anything. Exit 2 blocks the tool call and
sends the reason (stderr) back to Claude; exit 0 allows it.
"""
import json
import re
import subprocess
import sys

SECRET_PATTERNS = [
    (r"AIza[0-9A-Za-z_\-]{35}", "Google API key"),
    (r"\bsk-(?:ant-|proj-)?[A-Za-z0-9_\-]{20,}", "OpenAI/Anthropic-style secret key"),
    (r"\bhf_[A-Za-z0-9]{30,}", "Hugging Face token"),
    (r"-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----", "private key block"),
    (r"\b(?:OPENAI|GEMINI|ASSEMBLYAI|DEEPGRAM|ANTHROPIC|NCBI|OPENFDA|NCI)_API_KEY\s*[=:]\s*['\"]?[A-Za-z0-9_\-]{16,}", "provider API key assignment"),
    (r"\bSUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*['\"]?[A-Za-z0-9_\-\.]{20,}", "Supabase service-role key assignment"),
]

MODEL_DOWNLOAD_PATTERNS = [
    r"\bpip3?\s+install\b[^\n]*\b(torch|torchaudio|tensorflow|whisper|openai-whisper|transformers|pyannote)\b",
    r"\bhuggingface-cli\s+download\b",
    r"\bhf\s+download\b",
    r"\b(wget|curl)\b[^\n]*\.(safetensors|gguf|ckpt|pt|onnx)\b",
    r"\bapt(-get)?\s+install\b[^\n]*\bcuda\b",
]


def find_secret(text):
    for pattern, label in SECRET_PATTERNS:
        if re.search(pattern, text or ""):
            return label
    return None


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0  # malformed input: do not block unrelated work
    tool = data.get("tool_name", "")
    ti = data.get("tool_input", {}) or {}

    if tool in ("Write", "Edit"):
        path = ti.get("file_path", "")
        text = ti.get("content", "") if tool == "Write" else ti.get("new_string", "")
        if re.search(r"(^|/)\.env(\.[^/]*)?$", path) and not path.endswith(".env.example"):
            print(f"BLOCKED by ClinNote secret guard: writing {path} is not allowed (.env files must never be created in the repo; use the backend secret store). See SECURITY.md §5.", file=sys.stderr)
            return 2
        label = find_secret(text)
        if label:
            print(f"BLOCKED by ClinNote secret guard: content contains a {label}. Secrets must never be written to files (SECURITY.md §4, CLAUDE.md §8).", file=sys.stderr)
            return 2

    if tool == "Bash":
        cmd = ti.get("command", "")
        for pattern in MODEL_DOWNLOAD_PATTERNS:
            if re.search(pattern, cmd, re.IGNORECASE):
                print("BLOCKED by ClinNote model-download guard: installing ML frameworks or downloading model weights is prohibited (ADR-003).", file=sys.stderr)
                return 2
        label = find_secret(cmd)
        if label:
            print(f"BLOCKED by ClinNote secret guard: command contains a {label}.", file=sys.stderr)
            return 2
        if re.search(r"\bgit\s+(commit|push)\b", cmd):
            try:
                staged = subprocess.run(["git", "diff", "--cached"], capture_output=True, text=True, timeout=20).stdout
            except Exception:
                staged = ""
            label = find_secret(staged)
            if label:
                print(f"BLOCKED by ClinNote secret guard: staged changes contain a {label}. Unstage it, revoke/rotate the credential if real (SECURITY.md §16).", file=sys.stderr)
                return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
