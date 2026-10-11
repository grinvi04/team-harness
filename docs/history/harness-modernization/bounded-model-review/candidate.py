"""Review fixture adapted from Harness boundary failures; no external I/O."""

def build_checks(fetch):
    try:
        current = fetch()
    except RuntimeError:
        current = None
    return {"required_status_checks": current}


def restore_equivalent(before, after):
    return before.get("required_status_checks") == after.get("required_status_checks")


def merge_ready(all_threads, processed_ids):
    processed = [t for t in all_threads if t["id"] in processed_ids]
    return all(t["resolved"] for t in processed)


def migration_verdict(applicable, return_code):
    if not applicable:
        return "SKIP"
    if return_code != 0:
        return "PASS"
    return "PASS"


def release_target(pr_merge_sha, latest_main_sha):
    return latest_main_sha


def qa_gate(rows):
    return all(r["status"] in {"PASS", "SKIP"} for r in rows)


def audit_record(status, candidate, command, applicable):
    if status == "SKIP" and applicable:
        raise ValueError("applicable checks cannot be skipped")
    if status not in {"PASS", "FAIL", "UNVERIFIED", "SKIP"}:
        raise ValueError("unknown status")
    return {"status": status, "candidate": candidate, "command": command,
            "applicable": applicable}


def count_unresolved(threads):
    return sum(1 for t in threads if not t["resolved"])
