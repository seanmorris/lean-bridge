import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const [route, mode, producerAttempt, attempt] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
for (const name of [producerAttempt, attempt]) assert.match(name ?? "", /^r[1-9][0-9]*$/);
const sourceRoot = resolve(`build/vo1469-npm-installed-${route}-${mode}-${producerAttempt}`);
const output = `build/vo1469-npm-installed-controls-${route}-${mode}-${attempt}`; await mkdir(output);
const json = async path => JSON.parse(await readFile(path));
const start = await json(sourceRoot + "/start.json"), complete = await json(sourceRoot + "/complete.json");
const git = args => execFileSync("git", args, {encoding: "utf8", maxBuffer: 32 * 1024 ** 2});
const head = git(["rev-parse", "HEAD"]).trim();
assert.equal(start.head, head); assert.equal(complete.head, head);
assert.equal(start.route, route); assert.equal(start.mode, mode);
assert.deepEqual(complete.tests, {tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0});
assert.equal(complete.code, 0); assert.equal(complete.signal, null);
assert.deepEqual(complete.changed, []); assert.deepEqual(complete.runtimeChanged, []);
assert.ok(complete.pathsUnchanged && complete.headUnchanged && complete.runnerUnchanged && complete.runtimePathsUnchanged);
assert.equal(sha256(await readFile(sourceRoot + "/run.tap")), complete.tapSha256);
assert.equal(git(["diff", "HEAD", "--name-only"]).trim(), "");
const helperPath = "build/vo1469-npm-ci-prepared/nominal-primitive-subtype-npm-controls.mjs";
const helper = await readFile(helperPath, "utf8"), sources = {...start.sources};
for (const path of [helperPath, import.meta.filename]) sources[path] = sha256(await readFile(path));
for (const [path, hash] of Object.entries(sources)) assert.equal(sha256(await readFile(path)), hash, path);
for (const [path, hash] of Object.entries(start.runtime)) assert.equal(sha256(await readFile(resolve(start.runtimeRoot, path))), hash, path);
const originals = {};
const originalPaths = await nativeArtifactPaths(sourceRoot);
for (const path of originalPaths) originals[path] = sha256(await readFile(resolve(sourceRoot, path)));
const resources = await waitNominalSubtypeDotnetResources(output, {notify: console.log});
await writeFile(output + "/start.json", canonicalJson({head, route, mode, sourceRoot, sources, originals, resources,
  started: new Date().toISOString(), installedAcceptance: true, compiledAgain: false}), {flag: "wx"});
const source = helper.replace(/from "(\.[^"]+)"/gu, (_match, relative) =>
  `from "${pathToFileURL(resolve(dirname("tests/helpers/nominal-primitive-subtype-npm-controls.mjs"), relative)).href}"`);
const {checkNominalPrimitiveSubtypeNpmControls} = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const read = path => {
  assert.ok(/^[A-Za-z0-9_@.+/-]+$/u.test(path) && !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
  return readFile(resolve(sourceRoot, "selections", route, mode, path));
};
const checked = await checkNominalPrimitiveSubtypeNpmControls(read, {route, mode, producerCommit: head,
  runtime: {node: process.version, platform: process.platform, arch: process.arch}});
assert.equal(checked.executions, 2); assert.equal(checked.dispatchObserved, false);
assert.equal(checked.recordControls, mode === "full" ? 64 : 62);
assert.equal(checked.reportControls, 23); assert.equal(checked.adapterControls, mode === "full" ? 42 : 23);
for (const [path, hash] of Object.entries(sources)) assert.equal(sha256(await readFile(path)), hash, path);
for (const [path, hash] of Object.entries(start.runtime)) assert.equal(sha256(await readFile(resolve(start.runtimeRoot, path))), hash, path);
assert.deepEqual(await nativeArtifactPaths(sourceRoot), originalPaths);
for (const [path, hash] of Object.entries(originals)) assert.equal(sha256(await readFile(resolve(sourceRoot, path))), hash, path);
assert.equal(git(["rev-parse", "HEAD"]).trim(), head);
assert.equal(git(["diff", "HEAD", "--name-only"]).trim(), "");
const report = {head, route, mode, sourceRoot, checked, originalsUnchanged: Object.keys(originals).length,
  sourcesUnchanged: Object.keys(sources).length, runtimeFilesUnchanged: Object.keys(start.runtime).length,
  finished: new Date().toISOString(), installedAcceptance: true, compiledAgain: false};
await writeFile(output + "/complete.json", canonicalJson(report), {flag: "wx"});
console.log(JSON.stringify(report));
