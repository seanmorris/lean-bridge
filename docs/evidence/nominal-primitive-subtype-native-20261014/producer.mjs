import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, open, readFile, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const [route, mode, attempt, foundationAttempt] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
for (const value of [attempt, foundationAttempt]) assert.match(value ?? "", /^r[1-9][0-9]*$/);
const git = args => execFileSync("git", args, {encoding: "utf8", maxBuffer: 32 * 1024 ** 2});
const head = git(["rev-parse", "HEAD"]).trim();
const foundation = JSON.parse(await readFile(`build/vo1469-native-foundation-committed-audit-${foundationAttempt}.json`));
const postcommit = JSON.parse(await readFile(`build/vo1469-native-foundation-postcommit-${foundationAttempt}.json`));
assert.equal(head, foundation.head); assert.equal(head, postcommit.head); assert.equal(postcommit.row.code, 0);
assert.equal(git(["diff", "HEAD", "--name-only"]).trim(), "");
const selections = ["src", "scripts", "tests", "schema", "package.json", "package-lock.json", ".github/workflows", "docs/type-surface.v1.json"];
assert.equal(git(["ls-files", "--others", "--exclude-standard", "--", ...selections]).trim(), "");
const pathsOf = () => git(["ls-files", "-z", "--", ...selections]).split("\0").filter(Boolean).sort();
const paths = pathsOf(), sources = {};
for (const path of paths) sources[path] = sha256(await readFile(path));
const output = resolve(`build/vo1469-native-installed-${route}-${mode}-${attempt}`);
await mkdir(output);
const leanPrefix = resolve(".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const tools = {};
for (const path of [resolve(leanPrefix, "bin/lean"), resolve(leanPrefix, "bin/lake"), resolve(leanPrefix, "lib/lean/libleanshared.so"),
  process.execPath, await realpath("/usr/bin/cc"), await realpath("/usr/bin/c++"),
  await realpath("/usr/bin/pkg-config"), await realpath("/usr/bin/ld"), await realpath("/usr/bin/as"),
  ...(await nativeArtifactPaths(resolve(leanPrefix, "include/lean"))).map(path => resolve(leanPrefix, "include/lean", path))])
  tools[path] = sha256(await readFile(path));
const runnerSha256 = sha256(await readFile(import.meta.filename));
const environment = {...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LEAN_BRIDGE_") && !["NODE_TEST_CONTEXT", "NODE_OPTIONS", "FORCE_COLOR"].includes(key))),
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_TEST: "1",
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_ROUTES: route,
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_MODES: mode,
  LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NATIVE_OUTPUT: output + "/selections",
  LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36",
  LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1", CMAKE_BUILD_PARALLEL_LEVEL: "1", NO_COLOR: "1", BASH_ENV: "/dev/null"};
const args = ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-primitive-subtype-native-installed-tests.mjs"];
const resources = await waitNominalSubtypeDotnetResources(output, {notify: console.log});
const start = {head, route, mode, foundationAttempt, sources, tools, runnerSha256, args, resources, environment: Object.fromEntries(Object.entries(environment).filter(([key]) => key.startsWith("LEAN_BRIDGE_") || ["LEAN_NUM_THREADS", "OMP_NUM_THREADS", "MAKEFLAGS", "CMAKE_BUILD_PARALLEL_LEVEL"].includes(key))), started: new Date().toISOString()};
await writeFile(output + "/start.json", canonicalJson(start), {flag: "wx"});
console.log(JSON.stringify({output, head, route, mode, sources: paths.length, toolFiles: Object.keys(tools).length, started: start.started}));
const handle = await open(output + "/run.tap", "wx"); let outcome;
try { outcome = await new Promise((done, fail) => {
  const child = spawn(process.execPath, args, {env: environment, stdio: ["ignore", handle.fd, handle.fd]});
  child.once("error", fail); child.once("close", (code, signal) => done({code, signal}));
}); } finally {await handle.close();}
const bytes = await readFile(output + "/run.tap"), changed = [], toolsChanged = [], tests = {};
for (const [path,digest] of Object.entries(sources)) if(sha256(await readFile(path)) !== digest) changed.push(path);
for (const [path,digest] of Object.entries(tools)) if(sha256(await readFile(path)) !== digest) toolsChanged.push(path);
for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
  const matches = [...bytes.toString().matchAll(new RegExp(`^# ${key} ([0-9]+)$`, "gm"))];
  if(matches.length === 1) tests[key] = Number(matches[0][1]);
}
const result = {head, route, mode, ...outcome, tests, bytes: bytes.length, tapSha256: sha256(bytes), changed, toolsChanged,
  pathsUnchanged: canonicalJson(pathsOf()) === canonicalJson(paths), headUnchanged: git(["rev-parse", "HEAD"]).trim() === head,
  runnerUnchanged: sha256(await readFile(import.meta.filename)) === runnerSha256, finished: new Date().toISOString()};
await writeFile(output + "/outcome.json", canonicalJson(result), {flag: "wx"}); console.log(JSON.stringify(result)); console.log(bytes.toString().slice(-6000));
assert.equal(result.code, 0); assert.equal(result.signal, null); assert.deepEqual(tests, {tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0});
assert.deepEqual(changed, []); assert.deepEqual(toolsChanged, []); assert.ok(result.pathsUnchanged && result.headUnchanged && result.runnerUnchanged);
await writeFile(output + "/complete.json", canonicalJson(result), {flag: "wx"});
