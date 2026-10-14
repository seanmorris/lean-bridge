import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const [route, mode, attempt, foundationAttempt] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route));
assert.ok(["full", "result-only"].includes(mode));
assert.match(attempt ?? "", /^r[1-9][0-9]*$/);
assert.match(foundationAttempt ?? "", /^r[1-9][0-9]*$/);
const git = args => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 ** 2 });
const head = git(["rev-parse", "HEAD"]).trim();
const foundation = JSON.parse(await readFile("build/vo1469-browser-foundation-postcommit-" + foundationAttempt + ".json"));
assert.equal(head, foundation.head);
assert.equal(git(["diff", "HEAD", "--name-only"]).trim(), "");
assert.equal(git(["ls-files", "--others", "--exclude-standard", "--", "src", "scripts", "tests", "schema", "site", ".github/workflows", "docs/type-surface.v1.json", "package.json", "package-lock.json"]).trim(), "");
const output = resolve(`build/vo1469-browser-installed-${route}-${mode}-${attempt}`);
await mkdir(output);
const runnerSha256 = sha256(await readFile(import.meta.filename));
const sources = {};
const trackedPaths = () => git(["ls-files", "-z", "--", "src", "scripts", "tests", "schema", "site", "package.json", "package-lock.json", ".github/workflows", "docs/type-surface.v1.json"]).split("\0").filter(Boolean).sort();
const paths = trackedPaths();
for (const path of paths) sources[path] = sha256(await readFile(path));
const runtimeRoot = resolve("build/lean-link-spike/lazy");
const runtime = {};
for (const path of await nativeArtifactPaths(runtimeRoot)) runtime[path] = sha256(await readFile(resolve(runtimeRoot, path)));
assert.ok(Object.keys(runtime).length > 3);
const environment = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && key !== "NODE_TEST_CONTEXT")),
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST: "1",
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST: "1",
  LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium,firefox,webkit",
  PLAYWRIGHT_BROWSERS_PATH: resolve(".toolchains/playwright"),
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_ROUTES: route,
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_MODES: mode,
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_OUTPUT: output + "/selections",
  LEAN_BRIDGE_LAKE_RUNTIME_ROOT: runtimeRoot,
  LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1", EMCC_CORES: "1",
  CMAKE_BUILD_PARALLEL_LEVEL: "1", NO_COLOR: "1", BASH_ENV: "/dev/null"
};
if (process.env.LEAN_BRIDGE_LAKE_ENGINE) environment.LEAN_BRIDGE_LAKE_ENGINE = process.env.LEAN_BRIDGE_LAKE_ENGINE;
const args = ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-npm-installed-tests.mjs"];
const resources = await waitNominalSubtypeDotnetResources(output, { notify: console.log });
const browserProbe = execFileSync(process.execPath, ["scripts/verify-playwright-browsers.mjs", "chromium", "firefox", "webkit"], { env: environment, encoding: "utf8", maxBuffer: 4 * 1024 ** 2 });
const hostRuntime = { node: process.version, platform: process.platform, arch: process.arch };
const nodeExecutable = { path: process.execPath, sha256: sha256(await readFile(process.execPath)) };
await writeFile(output + "/start.json", canonicalJson({ head, route, mode, runnerSha256, sources, runtimeRoot, runtime, args, resources, hostRuntime, nodeExecutable, browserProbe,
  selectedEnvironment: Object.fromEntries(Object.entries(environment).filter(([key]) => key.startsWith("LEAN_BRIDGE_") || key.startsWith("LEAN_WASM_") || key === "PLAYWRIGHT_BROWSERS_PATH" || ["ELAN_HOME", "EMSDK", "EMCC_CORES", "LEAN_NUM_THREADS", "MAKEFLAGS"].includes(key))),
  started: new Date().toISOString() }), { flag: "wx" });
console.log(JSON.stringify({ output, head, route, mode, sources: paths.length, runtimeFiles: Object.keys(runtime).length, started: new Date().toISOString() }));
const handle = await open(output + "/run.tap", "wx");
let outcome;
try {
  outcome = await new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { env: environment, stdio: ["ignore", handle.fd, handle.fd] });
    child.once("error", fail); child.once("close", (code, signal) => done({ code, signal }));
  });
} finally { await handle.close(); }
const bytes = await readFile(output + "/run.tap"), changed = [];
for (const [path, digest] of Object.entries(sources)) if (sha256(await readFile(path)) !== digest) changed.push(path);
const runtimeChanged = [];
for (const [path, digest] of Object.entries(runtime)) if (sha256(await readFile(resolve(runtimeRoot, path))) !== digest) runtimeChanged.push(path);
const tests = {};
for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
  const matches = [...bytes.toString().matchAll(new RegExp(`^# ${key} ([0-9]+)$`, "gm"))];
  if (matches.length === 1) tests[key] = Number(matches[0][1]);
}
const result = { head, route, mode, ...outcome, tests, bytes: bytes.length, tapSha256: sha256(bytes), changed, runtimeChanged,
  pathsUnchanged: canonicalJson(paths) === canonicalJson(trackedPaths()), headUnchanged: git(["rev-parse", "HEAD"]).trim() === head,
  runnerUnchanged: sha256(await readFile(import.meta.filename)) === runnerSha256,
  nodeExecutableUnchanged: sha256(await readFile(process.execPath)) === nodeExecutable.sha256,
  runtimePathsUnchanged: canonicalJson(Object.keys(runtime).sort()) === canonicalJson((await nativeArtifactPaths(runtimeRoot)).sort()),
  finished: new Date().toISOString() };
await writeFile(output + "/outcome.json", canonicalJson(result), { flag: "wx" });
console.log(JSON.stringify(result)); console.log(bytes.toString().slice(-6000));
assert.equal(result.code, 0); assert.equal(result.signal, null);
assert.deepEqual(tests, { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
assert.deepEqual(changed, []); assert.deepEqual(runtimeChanged, []);
assert.ok(result.pathsUnchanged && result.headUnchanged && result.runnerUnchanged && result.runtimePathsUnchanged && result.nodeExecutableUnchanged);
await writeFile(output + "/complete.json", canonicalJson(result), { flag: "wx" });
