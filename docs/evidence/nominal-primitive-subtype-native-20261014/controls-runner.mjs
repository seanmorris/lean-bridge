import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";
import { checkNominalPrimitiveSubtypeNativeControls } from "../tests/helpers/nominal-primitive-subtype-native-controls.mjs";
import { checkNominalPrimitiveSubtypeNativeCiRecords } from "../tests/helpers/nominal-primitive-subtype-native-ci-report.mjs";
import { nominalPrimitiveSubtypeNativeRecords } from "../tests/helpers/nominal-primitive-subtype-native-report.mjs";

const [route, mode, producerAttempt, attempt] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
for(const value of [producerAttempt, attempt]) assert.match(value ?? "", /^r[1-9][0-9]*$/);
const sourceRoot = resolve(`build/vo1469-native-installed-${route}-${mode}-${producerAttempt}`);
const recordsRoot = resolve(sourceRoot, "selections", route, mode);
const output = resolve(`build/vo1469-native-installed-controls-${route}-${mode}-${attempt}`);
await mkdir(output);
const git = args => execFileSync("git", args, {encoding: "utf8", maxBuffer: 32 * 1024 ** 2});
const head = git(["rev-parse", "HEAD"]).trim(), json = async path => JSON.parse(await readFile(path));
const start = await json(sourceRoot + "/start.json"), complete = await json(sourceRoot + "/complete.json");
assert.equal(start.head, head); assert.equal(complete.head, head); assert.equal(start.route, route); assert.equal(start.mode, mode);
assert.deepEqual(complete.tests, {tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0});
assert.equal(complete.code, 0); assert.equal(complete.signal, null); assert.deepEqual(complete.changed, []); assert.deepEqual(complete.toolsChanged, []);
assert.ok(complete.pathsUnchanged && complete.headUnchanged && complete.runnerUnchanged);
assert.equal(sha256(await readFile(sourceRoot + "/run.tap")), complete.tapSha256);
const sources = {...start.sources, [import.meta.filename]: sha256(await readFile(import.meta.filename))};
const originalPaths = await nativeArtifactPaths(sourceRoot), originals = {};
for(const path of originalPaths) originals[path] = sha256(await readFile(resolve(sourceRoot, path)));
const unchanged = async () => {
  for(const [path, hash] of Object.entries({...sources, ...start.tools})) assert.equal(sha256(await readFile(path)), hash, path);
  assert.deepEqual(await nativeArtifactPaths(sourceRoot), originalPaths);
  for(const [path, hash] of Object.entries(originals)) assert.equal(sha256(await readFile(resolve(sourceRoot, path))), hash, path);
  assert.equal(git(["rev-parse", "HEAD"]).trim(), head); assert.equal(git(["diff", "HEAD", "--name-only"]).trim(), "");
};
await unchanged();
const resources = await waitNominalSubtypeDotnetResources(output, {notify: console.log});
await writeFile(output + "/start.json", canonicalJson({head, route, mode, sourceRoot, sources, originals, resources,
  installedAcceptance: true, compiledAgain: false, started: new Date().toISOString()}), {flag: "wx"});
const read = path => {
  assert.ok(/^[A-Za-z0-9_.+/-]+$/.test(path) && !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
  return readFile(resolve(recordsRoot, path));
};
const receipt = JSON.parse(await read("build-0/package-set-receipt.json"));
const records = nominalPrimitiveSubtypeNativeRecords(route, receipt).sort();
assert.equal(records.length, route === "ordinary" ? 30 : 32);
assert.deepEqual(await nativeArtifactPaths(recordsRoot), records);
assert.equal(execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {encoding: "utf8"}), "glibc 2.36\n");
const runtime = {platform: process.platform, arch: process.arch, glibc: "2.36"};
const options = {route, mode, producerCommit: head, runtime, floor: "2.36"};
const checked = await checkNominalPrimitiveSubtypeNativeControls(read, options);
assert.equal(checked.executions, 4); assert.equal(checked.initialExecutions, 2); assert.equal(checked.dispatchObserved, false);
assert.equal(checked.recordControls, records.length * 2); assert.equal(checked.reportControls, 41);
assert.equal(checked.packageControls, 12); assert.equal(checked.modelControls, mode === "full" ? 42 : 23);
const ci = await checkNominalPrimitiveSubtypeNativeCiRecords({route, mode, producer: head, directory: recordsRoot,
  tap: sourceRoot + "/run.tap", glibc: "2.36"}, {tap: await readFile(sourceRoot + "/run.tap", "utf8"), read, runtime});
assert.deepEqual(checked, {...ci, recordControls: records.length * 2, reportControls: 41,
  packageControls: 12, modelControls: mode === "full" ? 42 : 23});
await unchanged();
const report = {head, route, mode, sourceRoot, checked, records: records.length, originalsUnchanged: originalPaths.length,
  sourcesUnchanged: Object.keys(sources).length, toolFilesUnchanged: Object.keys(start.tools).length,
  finished: new Date().toISOString(), installedAcceptance: true, compiledAgain: false};
await writeFile(output + "/complete.json", canonicalJson(report), {flag: "wx"}); console.log(JSON.stringify(report));
