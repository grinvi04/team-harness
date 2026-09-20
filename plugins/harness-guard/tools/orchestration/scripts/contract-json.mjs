export function parseContractJson(text) {
  const value = JSON.parse(text);
  // JSON.parse establishes the grammar; this scan rejects last-key-wins ambiguity.
  const stack = [];
  for (const [token] of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/gu)) {
    if (token === '{' || token === '[') {
      stack.push({ keys: token === '{' ? new Set() : null, expectingKey: true });
    } else if (token === '}' || token === ']') {
      stack.pop();
    } else {
      const frame = stack.at(-1);
      if (token === ',' && frame?.keys) frame.expectingKey = true;
      if (token.startsWith('"') && frame?.keys && frame.expectingKey) {
        const key = JSON.parse(token);
        if (frame.keys.has(key)) throw Object.assign(new Error('Duplicate key'), { code: 'DUPLICATE_KEY' });
        frame.keys.add(key);
        frame.key = key;
        frame.expectingKey = false;
      }
      if ((frame?.key === 'epoch' || frame?.key === 'ownership_epoch') && /^-?\d/u.test(token) && !/^(0|[1-9]\d*)$/u.test(token)) {
        throw Object.assign(new Error('Noncanonical epoch'), { code: 'INVALID_EPOCH_LITERAL' });
      }
    }
  }
  return value;
}
