#!/usr/bin/env python3
"""Compatibility no-op for obsolete Agent model hooks.

Native model selection and inheritance belong to Claude Code. Consume the old
hook input without changing tool_input, emitting overrides, or writing logs.
Remove old hook registrations through the normal plugin update.
"""
import sys

if __name__ == "__main__":
    sys.stdin.read()
