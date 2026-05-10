// serde — multi-format parse / serialize / query utility for octoscript.

import { parse as parseYaml, stringify as stringifyYaml } from "jsr:@std/yaml";
import { parse as parseToml, stringify as stringifyToml } from "jsr:@std/toml";
import { parse as parseJsonc } from "jsr:@std/jsonc";
import jsonata from "npm:jsonata";

export type Format = "json" | "yaml" | "toml";

function json(text: string): unknown {
  return parseJsonc(text);
}

function sniff(text: string): unknown {
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) {
    try { return json(text); } catch { /* not JSON */ }
  }
  try { return parseToml(text); } catch { /* not TOML */ }
  return parseYaml(text);
}

/** Deserialize a string. If `hint` is given, tries that format first;
 *  on failure falls through to sniffing. */
export function parse(content: string, hint?: Format): unknown {
  if (hint) {
    try {
      if (hint === "json") return json(content);
      if (hint === "toml") return parseToml(content);
      if (hint === "yaml") return parseYaml(content);
    } catch { /* hint failed — fall through */ }
  }
  return sniff(content);
}

/** Read a file and auto-deserialize. Format detected by extension
 *  first, then content sniffing. */
export async function load(path: string): Promise<unknown> {
  const text = await Deno.readTextFile(path);
  const ext = path.split(".").pop()?.toLowerCase();
  const hint: Format | undefined =
    ext === "json" || ext === "jsonc" ? "json" :
    ext === "toml" ? "toml" :
    ext === "yml" || ext === "yaml" ? "yaml" :
    undefined;
  return parse(text, hint);
}

/** Parse (if string) or use directly, then evaluate a jsonata expression.
 *  Returns undefined on missing path or error. */
export async function query(input: string | unknown, expr: string): Promise<unknown> {
  try {
    const data = typeof input === "string" ? parse(input) : input;
    return await jsonata(expr).evaluate(data);
  } catch {
    return undefined;
  }
}

/** Serialize a value to the given format. Default: JSON. */
export function dump(value: unknown, format: Format = "json"): string {
  if (format === "yaml") return stringifyYaml(value as Record<string, unknown>);
  if (format === "toml") return stringifyToml(value as Record<string, unknown>);
  return JSON.stringify(value, null, 2);
}
