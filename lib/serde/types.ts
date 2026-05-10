export type InnerFormat = "json" | "yaml" | "toml";

export type Format = InnerFormat
  | "frontmatter" | `frontmatter:${InnerFormat}`;

export type Deserializer = (content: string) => unknown;

export type Serializer = (value: unknown) => string;
