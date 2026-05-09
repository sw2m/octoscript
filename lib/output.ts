// Step output writer/reader for $GITHUB_OUTPUT.

function path(): string {
  const p = Deno.env.get("GITHUB_OUTPUT");
  if (!p) throw new Error("$GITHUB_OUTPUT is unset");
  return p;
}

export async function set(name: string, value: string | number | boolean): Promise<void> {
  const v = String(value);
  let line: string;
  if (v.includes("\n")) {
    const delim = `eof-${crypto.randomUUID().replaceAll("-", "")}`;
    line = `${name}<<${delim}\n${v}\n${delim}\n`;
  } else {
    line = `${name}=${v}\n`;
  }
  await Deno.writeTextFile(path(), line, { append: true });
}

export async function get(name: string): Promise<string | undefined> {
  let text: string;
  try { text = await Deno.readTextFile(path()); }
  catch { return undefined; }
  const lines = text.split("\n");
  let last: string | undefined;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const lt = line.indexOf("<<");
    const eq = line.indexOf("=");
    if (lt > 0 && line.slice(0, lt) === name) {
      const delim = line.slice(lt + 2);
      const buf: string[] = [];
      let j = i + 1;
      while (j < lines.length && lines[j] !== delim) { buf.push(lines[j]); j++; }
      last = buf.join("\n");
      i = j + 1;
      continue;
    }
    if (eq > 0 && line.slice(0, eq) === name) { last = line.slice(eq + 1); }
    i++;
  }
  return last;
}

export async function list(): Promise<string[]> {
  let text: string;
  try { text = await Deno.readTextFile(path()); }
  catch { return []; }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const lt = line.indexOf("<<");
    const eq = line.indexOf("=");
    let name: string | undefined;
    if (lt > 0) name = line.slice(0, lt);
    else if (eq > 0) name = line.slice(0, eq);
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}
