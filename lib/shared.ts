// Directory-backed cross-step kv. Reads from $GITHUB_SHARED_DIR.

function dir(): string {
  return Deno.env.get("GITHUB_SHARED_DIR")
    ?? `${Deno.env.get("RUNNER_TEMP") ?? "/tmp"}/shared`;
}

export async function get(name: string): Promise<string | undefined> {
  try { return await Deno.readTextFile(`${dir()}/${name}`); }
  catch { return undefined; }
}

export async function set(name: string, value: string): Promise<void> {
  const d = dir();
  await Deno.mkdir(d, { recursive: true });
  await Deno.writeTextFile(`${d}/${name}`, value);
}

export async function list(): Promise<string[]> {
  try {
    const out: string[] = [];
    for await (const e of Deno.readDir(dir())) { if (e.isFile) out.push(e.name); }
    return out.sort();
  } catch { return []; }
}
