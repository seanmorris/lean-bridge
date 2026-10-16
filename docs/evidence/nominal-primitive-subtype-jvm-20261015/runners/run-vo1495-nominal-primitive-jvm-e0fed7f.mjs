import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { lstat, open, readdir, readFile, readlink, statfs, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// VO #1495: one serial installed primitive-base nominal JVM (Maven) selection at the frozen source revision,
// followed by the real controls against its original records.
// Usage: node run-vo1495-nominal-primitive-jvm-e0fed7f.mjs <ordinary|reviewed> <full|result-only> r<N> [--check]
const [route, mode, label, option] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route));
assert.ok(["full", "result-only"].includes(mode));
assert.match(label ?? "", /^r[1-9][0-9]*$/);
assert.ok(option === undefined || option === "--check");
const cwd = "/app/build/worktrees/nominal-primitive-jvm-run-e0fed7f";
const expectedRevision = "e0fed7f5f86d8c254a1064fc9eb1ad2e1b39ea0e";
const controlsRunner = "/app/build/run-vo1495-nominal-primitive-jvm-controls-e0fed7f.mjs";
const git = args => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const revision = git(["rev-parse", "HEAD"]);
assert.equal(revision, expectedRevision, "The producer worktree must be at the frozen source revision");
const prefix = `/app/build/vo1495-nominal-primitive-jvm-${route}-${mode}-${label}-${revision.slice(0, 7)}`;
// Versioned runner revision for #1495 at e0fed7f (board 2854): the integrated harness now takes an explicit
// MAX_LOAD selection, set to the shared ceiling 8. The 88cf601 runner pair is unmodified. Floors are unchanged.
const loadCeiling = 8;
const transition = { predecessorRevision: "88cf60117f2ea3bcef0213755c69a2e5d025f425"
  , predecessorRunners: { runner: { path: "/app/build/run-vo1495-nominal-primitive-jvm-88cf601.mjs", sha256: "334c918d6082cf5f3ca2638bc7c6bfd3eb4608e7c7bd1cf9afcaa8bc15be7dd1" }
    , controlsRunner: { path: "/app/build/run-vo1495-nominal-primitive-jvm-controls-88cf601.mjs", sha256: "cd7dbd381a16ca8d9f01ebafdc1f37a49e9583a8070830ee833c10b9e52fc325" } }
  , changes: ["producer revision 88cf601 -> e0fed7f (explicit JVM harness load ceiling)", "harness load selection 8 recorded in the environment"]
  , unchanged: ["initial 2048 MiB disk and memory floors", "live 768 MiB disk and memory floors", "runner admission ceiling 8", "wrapper, worktree policy"] };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
// The worktree is sparse and carries exactly one ignored symlink to the shared read-only module tree.
// Every tool is selected by absolute path below, so no toolchain link is needed.
const expectedLinks = { node_modules: "/app/node_modules" };
const expectedStatus = "?? node_modules";
const worktreeLinks = async () => {
  const links = {};
  for(const entry of await readdir(cwd)) if(entry !== ".git" && (await lstat(`${cwd}/${entry}`)).isSymbolicLink()) links[entry] = await readlink(`${cwd}/${entry}`);
  assert.deepEqual(links, expectedLinks, "worktree symlinks");
  return links;
};
const runnerFiles = { runner: import.meta.filename, controlsRunner };
const runnerHashes = async () => Object.fromEntries(await Promise.all(Object.entries(runnerFiles).map(async ([key, path]) => [key, hash(await readFile(path))])));
// Both untracked runner files and the worktree stay frozen through the whole run.
const frozen = async (phase, expected) => {
  assert.equal(git(["rev-parse", "HEAD"]), revision, phase);
  assert.equal(git(["diff", "HEAD", "--name-only"]), "", phase);
  // Every untracked entry, ignored ones included, must be the enumerated symlink.
  assert.equal(git(["status", "--porcelain", "--untracked-files=all", "--ignored"]), expectedStatus, `${phase}: untracked entries`);
  assert.deepEqual(await runnerHashes(), expected, `${phase}: both runner files must stay frozen`);
  await worktreeLinks();
};
const resources = async () => {
  const fs = await statfs("/app");
  const memory = await readFile("/proc/meminfo", "utf8");
  return { freeMiB: Math.floor(fs.bavail * fs.bsize / 1048576)
    , availableMiB: Math.floor(Number(memory.match(/^MemAvailable:\s+(\d+) kB$/m)[1]) / 1024)
    , load: Number((await readFile("/proc/loadavg", "utf8")).split(" ")[0]) };
};
const environment = {
  NO_COLOR: "1"
  , LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_TEST: "1"
  , LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_ROUTES: route
  , LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MODES: mode
  , LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_OUTPUT: prefix + "-records"
  , LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_JVM_MAX_LOAD: "8"
  , LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
  , LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
  , LEAN_BRIDGE_JAVA: "/app/.toolchains/jdk22/bin/java"
  , LEAN_BRIDGE_JAVAC: "/app/.toolchains/jdk22/bin/javac"
  , LEAN_BRIDGE_KOTLINC: "/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc"
  , LEAN_BRIDGE_MAVEN: "/app/.toolchains/apache-maven-3.9.11/bin/mvn"
  , LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1", CMAKE_BUILD_PARALLEL_LEVEL: "1"
};
const wrapper = ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3", process.execPath];
const command = "/usr/bin/nice";
const args = [...wrapper, "--max-old-space-size=3072", "--test", "--test-concurrency=1", "tests/helpers/nominal-primitive-subtype-jvm-installed-tests.mjs"];
const controlsArgs = [...wrapper, controlsRunner, route, mode, prefix];
const { runner: runnerSha256, controlsRunner: controlsRunnerSha256 } = await runnerHashes();
const expectedHashes = { runner: runnerSha256, controlsRunner: controlsRunnerSha256 };
await frozen("before launch", expectedHashes);
const links = await worktreeLinks();
const initial = await resources();
if(option === "--check") {
  console.log(JSON.stringify({ preparedOnly: true, revision, cwd, prefix, runnerSha256, controlsRunnerSha256, links, command, args, controlsArgs, environment, initial
    , loadCeiling, transition, guards: { initial: { freeMiB: 2048, availableMiB: 2048, load: loadCeiling }, live: { freeMiB: 768, availableMiB: 768 } } }, null, 2));
  process.exit(0);
}
assert.ok(initial.freeMiB >= 2048 && initial.availableMiB >= 2048 && initial.load < loadCeiling, JSON.stringify(initial));
await writeFile(prefix + ".start.json", JSON.stringify({ revision, route, mode, started: new Date().toISOString()
  , runnerSha256, controlsRunnerSha256, links, command, args, controlsArgs, environment, initial, loadCeiling, transition
  , guards: { initial: { freeMiB: 2048, availableMiB: 2048, load: loadCeiling }, live: { freeMiB: 768, availableMiB: 768 } } }, null, 2) + "\n", { flag: "wx" });
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "FORCE_COLOR" && !["CLASSPATH", "JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "JDK_JAVAC_OPTIONS", "_JAVA_OPTIONS", "JAVA_OPTS", "KOTLIN_OPTS", "KOTLIN_RUNNER"].includes(key)));
const guarded = async (name, spawnArgs, env) => {
  const log = await open(`${prefix}.${name}`, "wx");
  const child = spawn(command, spawnArgs, { cwd, env, stdio: ["ignore", log.fd, log.fd], detached: true });
  console.log(JSON.stringify({ phase: name, pid: child.pid, prefix }));
  let stopReason = null, samples = 0, killTimer;
  const minimum = { freeMiB: Infinity, availableMiB: Infinity };
  const timer = setInterval(async () => {
    try {
      const current = await resources();
      minimum.freeMiB = Math.min(minimum.freeMiB, current.freeMiB);
      minimum.availableMiB = Math.min(minimum.availableMiB, current.availableMiB);
      if((current.freeMiB < 768 || current.availableMiB < 768) && !stopReason) {
        stopReason = current.freeMiB < 768 ? "disk-floor" : "memory-floor";
        process.kill(-child.pid, "SIGTERM");
        killTimer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 5000);
      }
      if(++samples % 6 === 0) console.log(JSON.stringify({ phase: name, pid: child.pid, ...current, stopReason }));
    } catch(error) { console.error(error); }
  }, 5000);
  const end = await new Promise(resolve => {
    child.once("error", error => resolve({ code: null, signal: null, error: String(error) }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  clearInterval(timer); clearTimeout(killTimer); await log.close();
  const current = await resources();
  minimum.freeMiB = Math.min(minimum.freeMiB, current.freeMiB); minimum.availableMiB = Math.min(minimum.availableMiB, current.availableMiB);
  return { ...end, finished: new Date().toISOString(), minimum, final: current, stopReason, tapSha256: hash(await readFile(`${prefix}.${name}`)) };
};
const producer = await guarded("tap", args, { ...inherited, ...environment });
await writeFile(prefix + ".end.json", JSON.stringify(producer, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ phase: "producer", ...producer }));
await frozen("after producer", expectedHashes);
if(producer.code !== 0 || producer.stopReason) { process.exitCode = 1; }
else {
  // The real controls run only after a successful producer, against its original records.
  const controls = await guarded("controls.log", controlsArgs, { ...inherited, NO_COLOR: "1" });
  await writeFile(prefix + ".controls.end.json", JSON.stringify(controls, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ phase: "controls", ...controls }));
  await frozen("after controls", expectedHashes);
  process.exitCode = controls.code === 0 && !controls.stopReason ? 0 : 1;
}
