import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { access, mkdir, open, readFile, statfs, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "../src/build/php-wasm-copied-artifacts.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const [route, mode, attempt, producerCommit] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route));
assert.ok(["full", "result-only"].includes(mode));
assert.match(attempt ?? "", /^r[1-9][0-9]*$/);
assert.match(producerCommit ?? "", /^[a-f0-9]{40}$/);
const root = process.cwd();
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 ** 2 });
assert.equal(git(["rev-parse", "HEAD"]).trim(), producerCommit);
assert.equal(git(["diff", "HEAD", "--name-only"]).trim(), "");
assert.equal(git(["ls-files", "--others", "--exclude-standard", "--", "src", "scripts", "tests"]).trim(), "");
const paths = git(["ls-files", "-z", "--", "src", "scripts", "tests", "package.json", "package-lock.json", ".github/workflows/consumer-matrix.yml", ".github/workflows/checked-record-php-wasm.yml", "docs/type-surface.v1.json"]).split("\0").filter(Boolean).sort();
const sources = {};
for(const path of paths) sources[path] = sha256(await readFile(path));
const runnerSha256 = sha256(await readFile(import.meta.filename));
const runtime = { node: process.version, platform: process.platform, arch: process.arch };
const executable = await readFile(process.execPath);
const nodeExecutable = { path: process.execPath, bytes: executable.length, sha256: sha256(executable) };
const prefix = resolve(`build/vo1457-php-wasm-installed-${route}-${mode}-${attempt}-${producerCommit.slice(0, 7)}`);
await assert.rejects(access(prefix), { code: "ENOENT" }); await mkdir(prefix);
await writeFile(prefix + "/preflight.json", canonicalJson({ producerCommit, route, mode, attempt, runnerSha256, runtime, nodeExecutable, sources, started: new Date().toISOString() }), { flag: "wx" });
const resources = async () => {
  const disk = await statfs(root), memory = await readFile("/proc/meminfo", "utf8");
  return { freeMiB: Math.floor(disk.bavail * disk.bsize / 1048576), availableMiB: Math.floor(Number(memory.match(/^MemAvailable:\s+(\d+) kB$/m)[1]) / 1024), load: Number((await readFile("/proc/loadavg", "utf8")).split(" ")[0]) };
};
const guard = await waitNominalSubtypeDotnetResources(prefix, { notify: console.log });
const initial = await resources();
const overrides = { NO_COLOR: "1", LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
  , LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_TEST: "1"
  , LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_ROUTES: route, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_MODES: mode
  , LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_OUTPUT: prefix + "/records"
  , LEAN_BRIDGE_LEAN_PREFIX: resolve(".toolchains/elan/toolchains/leanprover--lean4---v4.32.2")
  , LEAN_BRIDGE_PHP: "/usr/bin/php", LEAN_BRIDGE_COMPOSER: "/usr/bin/composer"
  , LEAN_BRIDGE_PHP_SOURCE: resolve("build/php-wasm-sdk/php8.4-src")
  , LEAN_BRIDGE_PHP_EMSDK: resolve(".toolchains/emsdk-php-wasm")
  , LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: resolve("build/type-corpus/php-wasm-current-runtime")
  , LEAN_BRIDGE_PHP_WASM_HOST: resolve("build/php-wasm-host/node_modules/php-wasm")
  , PLAYWRIGHT_BROWSERS_PATH: resolve(".toolchains/playwright") };
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && !["NODE_TEST_CONTEXT", "CHROMIUM_PATH", "PLAYWRIGHT_BROWSERS_PATH"].includes(key)));
const browser = execFileSync(process.execPath, ["scripts/verify-playwright-browsers.mjs", "chromium"], { env: { ...inherited, ...overrides }, encoding: "utf8" });
assert.match(browser, /^chromium: \/[^\n]+\n$/); overrides.CHROMIUM_PATH = browser.slice("chromium: ".length).trim();
const environment = { ...inherited, ...overrides };
for(const path of [overrides.LEAN_BRIDGE_LEAN_PREFIX + "/bin/lean", overrides.LEAN_BRIDGE_PHP_SOURCE,
  overrides.LEAN_BRIDGE_PHP_EMSDK, overrides.LEAN_BRIDGE_PHP_WASM_HOST + "/package.json"]) await access(path);
const sharedRuntime = await readVerifiedPhpWasmCopiedRuntime(overrides.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME);
await writeFile(prefix + "/independent-runtime.json", canonicalJson(sharedRuntime), { flag: "wx" });
const toolIdentities = {};
for(const [name, path] of Object.entries({ php: overrides.LEAN_BRIDGE_PHP, composer: overrides.LEAN_BRIDGE_COMPOSER, chromium: overrides.CHROMIUM_PATH })) {
  const bytes = await readFile(path); toolIdentities[name] = { path, bytes: bytes.length, sha256: sha256(bytes) };
}
const command = "/usr/bin/nice", args = ["-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3", process.execPath,
  "--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-subtype-php-wasm-installed-tests.mjs"];
await writeFile(prefix + "/start.json", canonicalJson({ producerCommit, route, mode, attempt, runnerSha256, runtime, nodeExecutable, toolIdentities,
  command, args, environment: overrides, inheritedEnvironmentSha256: sha256(canonicalJson(environment)), sharedRuntimeIdentity: sharedRuntime.identity,
  sources, initial, guard, started: new Date().toISOString() }), { flag: "wx" });
const handle = await open(prefix + "/run.tap", "wx");
const child = spawn(command, args, { cwd: root, env: environment, stdio: ["ignore", handle.fd, handle.fd], detached: true });
console.log(JSON.stringify({ pid: child.pid, prefix, route, mode, producerCommit, initial }));
let stopReason = null, samples = 0, killTimer, sampling;
const minimum = { freeMiB: initial.freeMiB, availableMiB: initial.availableMiB };
const stop = reason => {
  if(stopReason) return;
  stopReason = reason;
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  killTimer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 5000);
};
const timer = setInterval(() => {
  if(sampling) return;
  sampling = (async () => {
    const current = await resources();
    minimum.freeMiB = Math.min(minimum.freeMiB, current.freeMiB); minimum.availableMiB = Math.min(minimum.availableMiB, current.availableMiB);
    if(current.freeMiB < 768) stop("disk-floor");
    if(current.availableMiB < 768) stop("memory-floor");
    if(++samples % 6 === 0) console.log(JSON.stringify({ pid: child.pid, ...current, stopReason }));
  })().catch(error => { stop("resource-observer-failed"); console.error(String(error)); }).finally(() => { sampling = null; });
}, 5000);
const outcome = await new Promise(done => {
  child.once("error", error => done({ code: null, signal: null, error: String(error) }));
  child.once("close", (code, signal) => done({ code, signal }));
});
clearInterval(timer); if(sampling) await sampling; clearTimeout(killTimer); await handle.close();
const changed = [];
for(const [path, digest] of Object.entries(sources)) if(sha256(await readFile(path)) !== digest) changed.push(path);
let runtimeUnchanged = false, runtimeError = null;
try { runtimeUnchanged = canonicalJson(await readVerifiedPhpWasmCopiedRuntime(overrides.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME)) === canonicalJson(sharedRuntime); }
catch(error) { runtimeError = String(error); }
const toolsChanged = [];
for(const [name, entry] of Object.entries(toolIdentities)) if(sha256(await readFile(entry.path)) !== entry.sha256) toolsChanged.push(name);
const bytes = await readFile(prefix + "/run.tap");
const end = { ...outcome, finished: new Date().toISOString(), minimum, final: await resources(), stopReason,
  tapSha256: sha256(bytes), sourcesChecked: paths.length, changed, runtimeUnchanged, runtimeError, toolsChanged,
  runnerUnchanged: sha256(await readFile(import.meta.filename)) === runnerSha256,
  headUnchanged: git(["rev-parse", "HEAD"]).trim() === producerCommit, trackedClean: git(["diff", "HEAD", "--name-only"]).trim() === "" };
await writeFile(prefix + "/end.json", canonicalJson(end), { flag: "wx" });
console.log(JSON.stringify(end)); console.log(bytes.toString().slice(-5000));
assert.deepEqual(changed, []); assert.deepEqual(toolsChanged, []); assert.ok(runtimeUnchanged && !runtimeError);
assert.ok(end.runnerUnchanged && end.headUnchanged && end.trackedClean);
assert.equal(end.code, 0); assert.equal(end.signal, null); assert.equal(stopReason, null);
for(const [name, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 })) {
  const matches = [...bytes.toString().matchAll(new RegExp(`^# ${name} ([0-9]+)$`, "gm"))];
  assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), expected);
}
