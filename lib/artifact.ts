// Cross-job kv with dot-delimited namespacing, backed by GitHub Actions artifacts.
// Same interface as shared.ts but survives across job boundaries.
//
// Usage:
//   await artifact.set("prep", "diff", diffContent);     // uploads artifact "prep/diff"
//   await artifact.get("prep", "diff");                   // downloads + returns content
//   await artifact.list("prep");                          // ["diff", ...]
//
// Each (ns, name) pair maps to one artifact named `${ns}.${name}`.
// The artifact contains a single file with the value.

import {
  DefaultArtifactClient,
} from "npm:@actions/artifact@^2";

const client = new DefaultArtifactClient();

function artifactName(ns: string, name: string): string {
  return `${ns}.${name}`;
}

function tmpDir(): string {
  return Deno.env.get("RUNNER_TEMP") ?? "/tmp";
}

export async function set(ns: string, name: string, value: string): Promise<void> {
  const dir = `${tmpDir()}/artifact-stage/${ns}`;
  await Deno.mkdir(dir, { recursive: true });
  const file = `${dir}/${name}`;
  await Deno.writeTextFile(file, value);
  await client.uploadArtifact(artifactName(ns, name), [file], dir);
}

export async function get(ns: string, name: string): Promise<string | undefined> {
  const aName = artifactName(ns, name);
  try {
    const { artifact } = await client.getArtifact(aName);
    const dir = `${tmpDir()}/artifact-dl/${ns}`;
    await Deno.mkdir(dir, { recursive: true });
    await client.downloadArtifact(artifact.id, { path: dir });
    return await Deno.readTextFile(`${dir}/${name}`);
  } catch {
    return undefined;
  }
}

export async function list(ns: string): Promise<string[]> {
  try {
    const prefix = `${ns}.`;
    const { artifacts } = await client.listArtifacts();
    return artifacts
      .filter((a) => a.name.startsWith(prefix))
      .map((a) => a.name.slice(prefix.length))
      .sort();
  } catch {
    return [];
  }
}
