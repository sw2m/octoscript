const { execFileSync } = require("child_process");
const path = require("path");

const script = process.argv[2];
if (!script) {
  console.error("usage: octoscript <script-file>");
  process.exit(2);
}

// Resolve runner.ts relative to this file (works whether installed
// locally or from node_modules)
const runner = path.join(__dirname, "runner.ts");

execFileSync("deno", ["run", "--allow-all", runner, script], {
  stdio: "inherit",
  env: process.env,
});
