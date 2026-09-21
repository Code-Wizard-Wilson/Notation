import { spawn } from "node:child_process";

const children = [];

function run(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal) return;
    if ((code ?? 0) !== 0) shutdown(code ?? 1);
  });
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 300).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run(process.execPath, ["scripts/notation-backup-server.mjs"]);
const nextArgs = process.argv.includes("--turbo") ? ["next", "dev"] : ["next", "dev", "--webpack"];
run("npx", nextArgs, { NEXT_DIST_DIR: ".next-dev" });
