"""Read only PEP621 data from stdin; never import the consumer's Python code."""
import json
import sys
import tomllib

try:
    if sys.argv[1:] == ["--filter-markers"]:
        from packaging.requirements import Requirement
        from packaging._parser import Variable
        def variables(node):
            if isinstance(node, Variable):
                return {str(node)}
            if isinstance(node, (list, tuple)):
                return set().union(*(variables(x) for x in node))
            return set()
        data = json.load(sys.stdin)
        environment = data.get("environment", {})
        active = []
        for text in data["dependencies"]:
            requirement = Requirement(text)
            needed = variables(requirement.marker._markers) if requirement.marker else set()
            if requirement.url or needed - environment.keys():
                raise ValueError("unsupported or undeclared marker context")
            if not requirement.marker or requirement.marker.evaluate(environment=environment):
                active.append(requirement.name + str(requirement.specifier))
        json.dump({"dependencies": active}, sys.stdout)
        sys.exit(0)
    data = tomllib.loads(sys.stdin.read())
    project = data.get("project", {})
    dependencies = project.get("dependencies", [])
    if not isinstance(project, dict) or not isinstance(dependencies, list) or not all(isinstance(x, str) for x in dependencies):
        raise ValueError("invalid PEP621 dependencies")
    json.dump({"dependencies": dependencies, "requiresPython": project.get("requires-python"),
               "dynamicDependencies": "dependencies" in project.get("dynamic", []),
               "unsupportedDependencyTable": bool(data.get("tool", {}).get("poetry", {}).get("dependencies"))}, sys.stdout)
except (ValueError, TypeError, AttributeError, KeyError, ImportError):
    # Do not echo dependency declarations, which can contain private URLs.
    print(json.dumps({"error": "invalid or unsupported dependency input/parser"}))
    sys.exit(1)
