#!/usr/bin/env python3
"""Start a macOS executable suspended, verify its dynamic identity, then resume it."""

import argparse
import ctypes
import os
import re
import signal
import subprocess
import sys

POSIX_SPAWN_START_SUSPENDED = 0x0080


def fail(message):
    raise RuntimeError(message)


def parse_args(argv):
    if "--" not in argv:
        fail("missing -- executable argument separator")
    separator = argv.index("--")
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--path", required=True)
    parser.add_argument("--cdhash", required=True)
    parser.add_argument("--requirement", required=True)
    parser.add_argument("--fixture-before-spawn")
    options = parser.parse_args(argv[:separator])
    if not os.path.isabs(options.path):
        fail("--path must be absolute")
    if not re.fullmatch(r"[a-f0-9]{40,64}", options.cdhash):
        fail("--cdhash must be lowercase hexadecimal")
    if options.fixture_before_spawn and os.environ.get("HARNESS_ATOMIC_SPAWN_FIXTURE") != "1":
        fail("--fixture-before-spawn requires HARNESS_ATOMIC_SPAWN_FIXTURE=1")
    return options, argv[separator + 1 :]


def spawn_suspended(executable, arguments):
    libc = ctypes.CDLL(None, use_errno=True)
    spawnattr = ctypes.c_void_p()
    pid = ctypes.c_int()
    libc.posix_spawnattr_init.restype = ctypes.c_int
    libc.posix_spawnattr_setflags.restype = ctypes.c_int
    libc.posix_spawnattr_destroy.restype = ctypes.c_int
    libc.posix_spawn.restype = ctypes.c_int

    result = libc.posix_spawnattr_init(ctypes.byref(spawnattr))
    if result != 0:
        raise OSError(result, os.strerror(result))
    try:
        result = libc.posix_spawnattr_setflags(
            ctypes.byref(spawnattr),
            ctypes.c_short(POSIX_SPAWN_START_SUSPENDED),
        )
        if result != 0:
            raise OSError(result, os.strerror(result))
        encoded_arguments = [os.fsencode(executable), *(os.fsencode(value) for value in arguments)]
        child_argv = (ctypes.c_char_p * (len(encoded_arguments) + 1))(
            *encoded_arguments,
            None,
        )
        encoded_environment = [os.fsencode(f"{key}={value}") for key, value in os.environ.items()]
        child_env = (ctypes.c_char_p * (len(encoded_environment) + 1))(
            *encoded_environment,
            None,
        )
        result = libc.posix_spawn(
            ctypes.byref(pid),
            os.fsencode(executable),
            None,
            ctypes.byref(spawnattr),
            child_argv,
            child_env,
        )
        if result != 0:
            raise OSError(result, os.strerror(result))
        return pid.value
    finally:
        libc.posix_spawnattr_destroy(ctypes.byref(spawnattr))


def verify_dynamic_identity(pid, requirement, expected_cdhash):
    verification = subprocess.run(
        [
            "/usr/bin/codesign",
            "--verify",
            "--deep",
            "--strict",
            "--requirement",
            requirement,
            str(pid),
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    details = subprocess.run(
        ["/usr/bin/codesign", "-dv", "--verbose=4", str(pid)],
        check=False,
        capture_output=True,
        text=True,
    )
    cdhashes = set(re.findall(r"^CDHash=([a-f0-9]+)$", details.stderr, re.MULTILINE))
    if verification.returncode != 0 or details.returncode != 0 or expected_cdhash not in cdhashes:
        fail("dynamic code identity mismatch")


def terminate_suspended(pid):
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass


def wait_status(pid):
    _, status = os.waitpid(pid, 0)
    if os.WIFEXITED(status):
        return os.WEXITSTATUS(status)
    if os.WIFSIGNALED(status):
        return 128 + os.WTERMSIG(status)
    return 1


def main(argv):
    if sys.platform != "darwin":
        fail("suspended dynamic verification requires macOS")
    options, child_arguments = parse_args(argv)
    if options.fixture_before_spawn:
        subprocess.run([options.fixture_before_spawn], check=True)
    pid = spawn_suspended(options.path, child_arguments)
    try:
        verify_dynamic_identity(pid, options.requirement, options.cdhash)
        os.kill(pid, signal.SIGCONT)
        return wait_status(pid)
    except BaseException:
        terminate_suspended(pid)
        raise


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except Exception as error:
        print(f"spawn-verified-executable: {error}", file=sys.stderr)
        sys.exit(1)
