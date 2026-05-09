// GitHub Actions inputs accessor. Reads the action's `inputs:` values
// at runtime. GitHub delivers action inputs as INPUT_<NAME> env vars —
// this is the same mechanism @actions/core's getInput() uses internally.
//
// Usage:
//   const issue = inputs.get("issue-number");  // reads the action input
//   const all = inputs.list();                  // all declared input names

export function get(name: string): string | undefined {
  return Deno.env.get(`INPUT_${name.toUpperCase().replaceAll("-", "_")}`);
}

export function list(): string[] {
  const out: string[] = [];
  for (const key of Object.keys(Deno.env.toObject())) {
    if (key.startsWith("INPUT_")) {
      out.push(key.slice(6).toLowerCase().replaceAll("_", "-"));
    }
  }
  return out.sort();
}
