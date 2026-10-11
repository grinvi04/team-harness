"""Read only PEP621 data from stdin; never import the consumer's Python code."""
import json
import sys
import tomllib

try:
    data = tomllib.loads(sys.stdin.read())
    project = data.get("project", {})
    dependencies = project.get("dependencies", [])
    if not isinstance(project, dict) or not isinstance(dependencies, list) or not all(isinstance(x, str) for x in dependencies):
        raise ValueError("invalid PEP621 dependencies")
    json.dump({"dependencies": dependencies, "requiresPython": project.get("requires-python"),
               "dynamicDependencies": "dependencies" in project.get("dynamic", []),
               "unsupportedDependencyTable": bool(data.get("tool", {}).get("poetry", {}).get("dependencies"))}, sys.stdout)
except (ValueError, TypeError, AttributeError) as error:
    print(json.dumps({"error": str(error)}))
    sys.exit(1)
