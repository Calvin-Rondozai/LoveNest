// Only for running dev tooling (Better Auth CLI) on Node 20, which lacks Object.groupBy.
// Node 22+ has it natively; this file does nothing there.
if (typeof Object.groupBy !== 'function') {
  Object.groupBy = (items, keyFn) => {
    const out = Object.create(null);
    let i = 0;
    for (const item of items) {
      const key = keyFn(item, i++);
      (out[key] ??= []).push(item);
    }
    return out;
  };
}
if (typeof Map.groupBy !== 'function') {
  Map.groupBy = (items, keyFn) => {
    const out = new Map();
    let i = 0;
    for (const item of items) {
      const key = keyFn(item, i++);
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(item);
    }
    return out;
  };
}
