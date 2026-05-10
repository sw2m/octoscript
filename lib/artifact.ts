// Cross-job kv with dot-delimited namespacing, backed by GitHub Actions artifacts.
// Same interface as shared.ts but survives across job boundaries.
//
// set() requires ACTIONS_RUNTIME_TOKEN (only available in uses: node20 actions).
// get()/list() use the REST API and work from any step with GITHUB_TOKEN.

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(name + " not set");
  return v;
}

function artifactName(ns: string, name: string): string {
  return ns + "." + name;
}

function tmpDir(): string {
  return Deno.env.get("RUNNER_TEMP") ?? "/tmp";
}

// ---- set: uses @actions/artifact (needs ACTIONS_RUNTIME_TOKEN) ----

export async function set(ns: string, name: string, value: string): Promise<void> {
  const { DefaultArtifactClient } = await import("npm:@actions/artifact@^2");
  const client = new DefaultArtifactClient();
  const dir = tmpDir() + "/artifact-stage/" + ns;
  await Deno.mkdir(dir, { recursive: true });
  const file = dir + "/" + name;
  await Deno.writeTextFile(file, value);
  await client.uploadArtifact(artifactName(ns, name), [file], dir);
}

// ---- get/list: REST API (needs GITHUB_TOKEN only) ----

function headers(): Record<string, string> {
  return {
    Authorization: "Bearer " + env("GITHUB_TOKEN"),
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function api(): string {
  return Deno.env.get("GITHUB_API_URL") ?? "https://api.github.com";
}

export async function get(ns: string, name: string): Promise<string | undefined> {
  const aName = artifactName(ns, name);
  try {
    const listRes = await fetch(
      api() + "/repos/" + env("GITHUB_REPOSITORY") + "/actions/runs/" +
        env("GITHUB_RUN_ID") + "/artifacts?name=" + encodeURIComponent(aName),
      { headers: headers() },
    );
    if (!listRes.ok) return undefined;
    const data = await listRes.json();
    if (!data.artifacts?.length) return undefined;

    const art = data.artifacts[0];
    const dlRes = await fetch(
      api() + "/repos/" + env("GITHUB_REPOSITORY") +
        "/actions/artifacts/" + art.id + "/zip",
      { headers: headers(), redirect: "follow" },
    );
    if (!dlRes.ok) return undefined;

    const zipBytes = new Uint8Array(await dlRes.arrayBuffer());
    const dir = tmpDir() + "/artifact-dl/" + ns;
    await Deno.mkdir(dir, { recursive: true });
    const zipPath = dir + "/" + name + ".zip";
    await Deno.writeFile(zipPath, zipBytes);
    const proc = new Deno.Command("unzip", {
      args: ["-o", zipPath, "-d", dir],
      stdout: "null",
      stderr: "null",
    }).spawn();
    await proc.status;
    return await Deno.readTextFile(dir + "/" + name);
  } catch {
    return undefined;
  }
}

export async function list(ns: string): Promise<string[]> {
  try {
    const prefix = ns + ".";
    const res = await fetch(
      api() + "/repos/" + env("GITHUB_REPOSITORY") + "/actions/runs/" +
        env("GITHUB_RUN_ID") + "/artifacts?per_page=100",
      { headers: headers() },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.artifacts ?? [])
      .filter((a: { name: string }) => a.name.startsWith(prefix))
      .map((a: { name: string }) => a.name.slice(prefix.length))
      .sort();
  } catch {
    return [];
  }
}
