// octoscript runner — GitHub Actions shell powered by Deno + Octokit.
//
// Usage as shell:
//   shell: octoscript {0}
//
// Install:
//   deno install --allow-all --name octoscript \
//     https://raw.githubusercontent.com/sw2m/octoscript/main/runner.ts
//
// Globals injected into user scripts:
//   github, octokit, context, core, exec, glob, io, require,
//   Mustache, template, git, inputs, shared, output

import { context, getOctokit as raw } from "npm:@actions/github@^6";
import * as core from "npm:@actions/core@^1";
import * as exec from "npm:@actions/exec@^1";
import * as glob from "npm:@actions/glob@^0.5";
import * as io from "npm:@actions/io@^1";
import { retry } from "npm:@octokit/plugin-retry@^7";
import { requestLog } from "npm:@octokit/plugin-request-log@^5";
import { createRequire } from "node:module";
import Mustache from "npm:mustache@^4";
// deno-lint-ignore no-explicit-any
const simpleGit = (await import("npm:simple-git@^3")).default as any;

import * as inputs from "./lib/inputs.ts";
import * as shared from "./lib/shared.ts";
import * as output from "./lib/output.ts";

globalThis.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  console.error(e.reason);
  core.setFailed(`Unhandled error: ${e.reason}`);
  Deno.exit(1);
});

const path = Deno.args[0];
if (!path) {
  core.setFailed("usage: octoscript <script-file>");
  Deno.exit(2);
}

const token = Deno.env.get("INPUT_GITHUB_TOKEN") || Deno.env.get("GITHUB_TOKEN");
if (!token) {
  core.setFailed("GITHUB_TOKEN is required (set as env var or INPUT_GITHUB_TOKEN).");
  Deno.exit(2);
}

const debug = Deno.env.get("INPUT_DEBUG") === "true" || Deno.env.get("RUNNER_DEBUG") === "1";
const userAgent = Deno.env.get("INPUT_USER_AGENT") || "octoscript";
const previews = Deno.env.get("INPUT_PREVIEWS") || "";
const baseUrl = Deno.env.get("INPUT_BASE_URL") || "";
const retries = parseInt(Deno.env.get("INPUT_RETRIES") || "0", 10) || 0;
const doNotRetry = (Deno.env.get("INPUT_RETRY_EXEMPT_STATUS_CODES") || "")
  .split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
const encoding = Deno.env.get("INPUT_RESULT_ENCODING") || "json";

function agent(base: string): string {
  const id = Deno.env.get("ACTIONS_ORCHESTRATION_ID");
  if (!id) return base;
  return `${base} actions_orchestration_id/${id.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}

type OctokitOpts = {
  log?: Console;
  userAgent?: string;
  previews?: string[];
  baseUrl?: string;
  request?: { retries?: number; doNotRetry?: number[] };
};

const opts: OctokitOpts = {
  log: debug ? console : undefined,
  userAgent: agent(userAgent),
};
if (previews) opts.previews = previews.split(",").map((s) => s.trim());
if (baseUrl) opts.baseUrl = baseUrl;
if (retries > 0) opts.request = { retries, doNotRetry };

// @ts-ignore — plugin type mismatch is pre-existing
function getOctokit(tk: string, o?: OctokitOpts) {
  const additional = o ?? {};
  return raw(
    tk,
    { ...opts, ...additional, request: { ...(opts.request ?? {}), ...(additional.request ?? {}) } },
    retry,
    requestLog,
  );
}
const github = getOctokit(token);
const require = createRequire(`file://${Deno.env.get("GITHUB_WORKSPACE") ?? Deno.cwd()}/`);

async function template(path: string | URL, data: Record<string, unknown>): Promise<string> {
  return Mustache.render(await Deno.readTextFile(path), data);
}

// Read script, handle both pre-wrapped modules and raw scripts
const script = await Deno.readTextFile(path);
let userFn: Function;

try {
  const mod = await import(path.endsWith(".ts") ? path : `file://${await Deno.realPath(path)}`);
  if (typeof mod.default === "function") {
    userFn = mod.default;
  } else {
    throw new Error("not a module");
  }
} catch {
  const wrapped = [
    "export default async function(_g: any) {",
    "  const { github, octokit, getOctokit, context, core, exec, glob, io, require, Mustache, template, git, inputs, shared, output } = _g;",
    script,
    "}",
  ].join("\n");
  const wsDir = Deno.env.get("GITHUB_WORKSPACE") ?? Deno.cwd();
  const tmpBase = await Deno.makeTempFile({ dir: wsDir, prefix: ".octoscript-" });
  const tmpTs = tmpBase + ".ts";
  await Deno.rename(tmpBase, tmpTs);
  await Deno.writeTextFile(tmpTs, wrapped);
  try {
    const mod = await import(`file://${await Deno.realPath(tmpTs)}`);
    userFn = mod.default;
  } finally {
    await Deno.remove(tmpTs).catch(() => {});
  }
}

try {
  const result = await userFn({
    github, octokit: github, getOctokit, context, core, exec, glob, io, require,
    Mustache, template, git: simpleGit(), inputs, shared, output,
  });
  if (result !== undefined) {
    const out = encoding === "json" ? JSON.stringify(result) : String(result);
    core.setOutput("result", out);
  }
} catch (err) {
  core.setFailed(err instanceof Error ? err.message : String(err));
  Deno.exit(1);
}
