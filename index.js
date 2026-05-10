const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const script = process.env.INPUT_SCRIPT;
if (!script) {
  process.stderr.write("::error::INPUT_SCRIPT is required\n");
  process.exit(1);
}

if (!process.env.GITHUB_TOKEN && process.env.INPUT_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.INPUT_GITHUB_TOKEN;
}

// Ensure deno is available
try {
  execFileSync("deno", ["--version"], { stdio: "ignore" });
} catch {
  const ver = process.env.INPUT_DENO_VERSION || "v2.x";
  // Fallback: install via deno's install script
  try {
    execSync("curl -fsSL https://deno.land/install.sh | sh", {
      stdio: "inherit",
      env: { ...process.env, DENO_INSTALL: path.join(os.homedir(), ".deno") },
    });
    process.env.PATH = path.join(os.homedir(), ".deno", "bin") + path.delimiter + process.env.PATH;
  } catch (e) {
    process.stderr.write("::error::Failed to install deno: " + e.message + "\n");
    process.exit(1);
  }
}

// Ensure octoscript is installed
try {
  execFileSync("octoscript", ["--help"], { stdio: "ignore" });
} catch {
  try {
    execSync(
      'deno install --global --allow-all --name octoscript "https://raw.githubusercontent.com/sw2m/octoscript/main/runner.ts"',
      { stdio: "inherit", env: process.env }
    );
  } catch (e) {
    process.stderr.write("::error::Failed to install octoscript: " + e.message + "\n");
    process.exit(1);
  }
}

// Write script to temp file in workspace
const ws = process.env.GITHUB_WORKSPACE || process.cwd();
const tmp = path.join(ws, ".octoscript-action-" + process.pid + ".ts");
fs.writeFileSync(tmp, script);

try {
  execFileSync("octoscript", [tmp], {
    stdio: "inherit",
    env: process.env,
  });
} catch (e) {
  process.exit(e.status || 1);
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}
