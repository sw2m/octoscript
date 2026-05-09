// Action inputs accessor. Reads INPUT_* env vars.

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
