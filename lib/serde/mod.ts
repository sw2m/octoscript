// serde — multi-format parse / serialize / query utility for octoscript.
// Supports: json, yaml, toml, frontmatter, frontmatter:json/yaml/toml

import { parse as parseYaml, stringify as stringifyYaml } from "jsr:@std/yaml";
import { parse as parseToml, stringify as stringifyToml } from "jsr:@std/toml";
import { parse as parseJsonc } from "jsr:@std/jsonc";
import jsonata from "npm:jsonata";
import { Engine } from "./frontmatter.ts";
import type { Format, InnerFormat, Deserializer, Serializer } from "./types.ts";

export type { Format, InnerFormat } from "./types.ts";
export { Engine } from "./frontmatter.ts";

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

function deser(fmt?: InnerFormat): Deserializer {
  if (fmt === "json") return json;
  if (fmt === "toml") return parseToml;
  if (fmt === "yaml") return parseYaml;
  return sniff;
}

function ser(fmt?: InnerFormat): Serializer {
  if (fmt === "yaml") return (v) => stringifyYaml(v as Record<string, unknown>);
  if (fmt === "toml") return (v) => stringifyToml(v as Record<string, unknown>);
  if (fmt === "json") return (v) => JSON.stringify(v, null, 2);
  return (v) => JSON.stringify(v, null, 2);
}

function engine(content: string, format: Format): Engine {
  const inner = Engine.hint(format, undefined);
  return new Engine(content, deser(inner), ser(inner ?? "yaml"));
}

/** Deserialize a string. Frontmatter formats always return unknown[]. */
export function parse(content: string, hint?: Format): unknown {
  if (hint && (hint as string).startsWith("frontmatter")) {
    return engine(content, hint).parse();
  }
  return deser(hint as InnerFormat | undefined)(content);
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

/** Serialize a value. Frontmatter wraps in <!-- -->. Default: json.
 *  Frontmatter default inner format: yaml. */
export function dump(value: unknown, format: Format = "json"): string {
  if ((format as string).startsWith("frontmatter")) {
    const inner = Engine.hint(format, "yaml");
    return new Engine("", deser(inner), ser(inner)).stringify(value);
  }
  return ser(format as InnerFormat)(value);
}

/** Parse frontmatter blocks with position info.
 *  Returns {value, start, end}[] for slicing between markers. */
export function marks(
  body: string,
  inner?: InnerFormat,
): Array<{ value: unknown; start: number; end: number }> {
  return new Engine(body, deser(inner), ser(inner ?? "yaml")).marks();
}
