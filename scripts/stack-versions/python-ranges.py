"""Use PyPA's parser; do not silently borrow the host's marker environment."""
import json
import sys
from packaging.requirements import Requirement
from packaging._parser import Variable
from packaging.version import Version

try:
    data = json.load(sys.stdin)
    requirement = Requirement("harness-probe" + data["range"])
    environment = data.get("environment", {})
    def variables(node):
        if isinstance(node, Variable):
            return {str(node)}
        if isinstance(node, (list, tuple)):
            return set().union(*(variables(x) for x in node))
        return set()
    needed = variables(requirement.marker._markers) if requirement.marker else set()
    if needed - environment.keys():
        raise ValueError("marker environment is not declared: " + ",".join(sorted(needed - environment.keys())))
    active = not requirement.marker or requirement.marker.evaluate(environment=environment)
    match = not active or requirement.specifier.contains(Version(data["version"]))
    print(json.dumps({"matches": match, "issues": []}))
except (ValueError, KeyError, TypeError) as error:
    print(json.dumps({"matches": False, "issues": [{"code": "INVALID_OR_UNRESOLVED_RANGE", "action": str(error)}]}))
    sys.exit(1)
