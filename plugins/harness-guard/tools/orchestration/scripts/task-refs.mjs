// Inputs must already pass the Task schema. Compare declarations without fetching refs.
export function collectTaskRefs(task, add) {
  const declaredRefs = new Map();
  for (const [refs, path] of [
    [task.input_refs, '/task/input_refs'],
    [[task.source], '/task/source'],
    [task.verification.oracle_refs, '/task/verification/oracle_refs'],
  ]) {
    const seen = new Set();
    refs.forEach((ref, i) => {
      const location = path === '/task/source' ? path : `${path}/${i}`;
      if (seen.has(ref.uri)) add(location, 'duplicate-input-ref');
      if (declaredRefs.has(ref.uri) && declaredRefs.get(ref.uri) !== ref.revision) add(location, 'input-ref-mismatch');
      seen.add(ref.uri);
      declaredRefs.set(ref.uri, ref.revision);
    });
  }
  return declaredRefs;
}
