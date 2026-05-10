import type { InnerFormat, Format, Deserializer, Serializer } from "./types.ts";

const OPEN = "<!--";
const CLOSE = "-->";

export class Engine {
  #body: string;
  #pos = 0;
  #deser: Deserializer;
  #ser: Serializer;

  constructor(body: string, deser: Deserializer, ser: Serializer) {
    this.#body = body;
    this.#deser = deser;
    this.#ser = ser;
  }

  static hint(format: Format, fallback?: InnerFormat): InnerFormat | undefined {
    if (format === "frontmatter") return fallback;
    const m = (format as string).match(/^frontmatter:(.+)$/);
    if (m) return m[1] as InnerFormat;
    return fallback;
  }

  stringify(value: unknown): string {
    const content = this.#ser(value);
    const c = content.endsWith("\n") ? content : content + "\n";
    return OPEN + "\n" + c + CLOSE + "\n";
  }

  parse(): unknown[] {
    const blocks: unknown[] = [];
    while (this.#pos < this.#body.length) {
      const start = this.#body.indexOf(OPEN, this.#pos);
      if (start === -1) break;
      let end = this.#body.indexOf(CLOSE, start + OPEN.length);
      if (end === -1) end = this.#body.length;
      this.#pos = end + (end < this.#body.length ? CLOSE.length : 0);

      const value = this.#content(this.#body.slice(start + OPEN.length, end));
      if (value !== null && value !== undefined) blocks.push(value);
    }
    return blocks;
  }

  marks(): Array<{ value: unknown; start: number; end: number }> {
    const out: Array<{ value: unknown; start: number; end: number }> = [];
    while (this.#pos < this.#body.length) {
      const start = this.#body.indexOf(OPEN, this.#pos);
      if (start === -1) break;
      let closeIdx = this.#body.indexOf(CLOSE, start + OPEN.length);
      if (closeIdx === -1) closeIdx = this.#body.length;
      const end = closeIdx + (closeIdx < this.#body.length ? CLOSE.length : 0);
      this.#pos = end;

      const value = this.#content(this.#body.slice(start + OPEN.length, closeIdx));
      if (value !== null && value !== undefined) out.push({ value, start, end });
    }
    return out;
  }

  #content(raw: string): unknown {
    if (!raw.includes("\n")) {
      const trimmed = raw.trim();
      return trimmed === "" ? null : this.#deser(trimmed);
    }

    const head = raw.indexOf("\n");
    const tail = raw.lastIndexOf("\n");
    if (head >= tail) return null;
    if (raw.slice(0, head).trim() !== "") return null;
    if (raw.slice(tail + 1).trim() !== "") return null;

    const dedented = Engine.dedent(raw.slice(head + 1, tail));
    return dedented === "" ? null : this.#deser(dedented);
  }

  static dedent(block: string): string {
    const lines = block.split("\n");

    let indent = -1;
    for (const line of lines) {
      if (line.trim() === "") continue;
      indent = Engine.leading(line);
      break;
    }
    if (indent === -1) return "";

    return lines.map((line) => {
      if (line.trim() === "") return "";
      const n = Engine.leading(line);
      if (n < indent) {
        throw new Error(
          "frontmatter: line \"" + line + "\" has " + n +
          " leading whitespace chars; first non-blank line had " + indent,
        );
      }
      return line.slice(indent);
    }).join("\n");
  }

  static leading(line: string): number {
    let n = 0;
    while (n < line.length && (line[n] === " " || line[n] === "\t")) n++;
    return n;
  }
}
