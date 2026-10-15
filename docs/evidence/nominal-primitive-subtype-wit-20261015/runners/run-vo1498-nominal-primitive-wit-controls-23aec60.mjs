import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, readlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// VO #1498: run the real primitive-base WIT controls against one selection's original records.
// Usage: node run-vo1498-nominal-primitive-wit-controls-23aec60.mjs <ordinary|reviewed> <full|result-only> <prefix>
const cwd = "/app/build/worktrees/nominal-primitive-wit-run-23aec60";
const expectedRevision = "23aec60f65c37995b43e963e22ef8f7a5ee00722";
const producerRunner = `/app/build/run-vo1498-nominal-primitive-wit-${expectedRevision.slice(0, 7)}.mjs`;
const { canonicalJson, sha256 } = await import(`${cwd}/src/capsule/node.mjs`);
const { nativeArtifactPaths } = await import(`${cwd}/src/build/native-artifacts.mjs`);
const { waitNominalSubtypeDotnetResources } = await import(`${cwd}/tests/helpers/nominal-subtype-dotnet-resources.mjs`);
const { checkNominalPrimitiveSubtypeWitControls } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-wit-controls.mjs`);
const { checkNominalPrimitiveSubtypeWitCiRecords } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-wit-ci-report.mjs`);
const { inspectNominalPrimitiveSubtypeWitHandoff } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-wit-handoff.mjs`);
const { inspectNominalSubtypeWitTools } = await import(`${cwd}/tests/helpers/nominal-subtype-wit-tools.mjs`);
const [route, mode, prefix] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
assert.match(prefix ?? "", new RegExp(`^/app/build/vo1498-nominal-primitive-wit-${route}-${mode}-r[1-9][0-9]*-${expectedRevision.slice(0, 7)}$`, "u"));
const git = args => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
// The complete untracked listing, ignored entries included, must be exactly the module symlink.
const expectedStatus = "?? node_modules";
const worktreeLinks = async () => {
	const links = {};
	for(const entry of await readdir(cwd)) if(entry !== ".git" && (await lstat(`${cwd}/${entry}`)).isSymbolicLink()) links[entry] = await readlink(`${cwd}/${entry}`);
	assert.deepEqual(links, { node_modules: "/app/node_modules" }, "worktree symlinks"); return links;
};
const head = git(["rev-parse", "HEAD"]);
assert.equal(head, expectedRevision); assert.equal(git(["diff", "HEAD", "--name-only"]), "");
assert.equal(git(["status", "--porcelain", "--untracked-files=all", "--ignored"]), expectedStatus, "untracked entries");
const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
assert.equal(start.revision, head); assert.equal(start.route, route); assert.equal(start.mode, mode);
// Both untracked runner files must still be the bytes the producer recorded at launch.
const runners = { [producerRunner]: start.runnerSha256, [import.meta.filename]: start.controlsRunnerSha256 };
for(const [path, digest] of Object.entries(runners)) assert.equal(sha256(await readFile(path)), digest, `${path} changed since launch`);
const links = await worktreeLinks(); assert.deepEqual(start.links, links);
assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]); assert.equal(end.error, undefined);
const tap = await readFile(prefix + ".tap"); assert.equal(sha256(tap), end.tapSha256);
const sourceRoot = prefix + "-records", records = resolve(sourceRoot, route, mode);
const sourcePaths = [
	...["wit-wasi.c", "wit-values.h", "wit-inputs.h"].map(name => `tests/fixtures/nominal-primitive-subtype-consumers/${name}`)
	, ...["fixture", "package", "install", "installed-tests", "model-records", "package-records", "environment-records", "handoff", "report", "controls", "ci-report"]
		.map(name => `tests/helpers/nominal-primitive-subtype-wit-${name}.mjs`)
	, ...["generators", "tools", "tool-records", "interface"].map(name => `tests/helpers/nominal-subtype-wit-${name}.mjs`)
];
const sources = { ...runners };
for(const path of sourcePaths) sources[path] = sha256(await readFile(resolve(cwd, path)));
const originalPaths = await nativeArtifactPaths(sourceRoot), originals = {};
for(const path of originalPaths) originals[path] = sha256(await readFile(resolve(sourceRoot, path)));
const resources = await waitNominalSubtypeDotnetResources(sourceRoot, { notify: console.log });
await writeFile(prefix + ".controls.start.json", canonicalJson({ head, route, mode, prefix, sourceRoot, runners, links, sources, originals, resources, started: new Date().toISOString(), compiledAgain: false }), { flag: "wx" });
const read = path => {
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
	return readFile(resolve(records, path));
};
const handoff = await inspectNominalPrimitiveSubtypeWitHandoff(read);
const supplemented = async path => handoff.supplements.get(path) ?? read(path);
const selected = { cc: start.environment.CC, wasmTools: start.environment.LEAN_BRIDGE_WASM_TOOLS, wasmtimeCapi: start.environment.LEAN_BRIDGE_WASMTIME_C_API };
const tools = await inspectNominalSubtypeWitTools(selected, records);
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" }); assert.equal(version, "glibc 2.36\n");
const runtime = { platform: process.platform, arch: process.arch, glibc: "2.36" }, options = { route, mode, producerCommit: head, runtime, floor: "2.36" };
const controls = await checkNominalPrimitiveSubtypeWitControls(supplemented, options);
const expectedControls = { recordControls: controls.recordControls, executionControls: 24, toolControls: 12, resourceControls: 4, environmentControls: 15, packageControls: 5, modelControls: mode === "full" ? 6 : 5 };
assert.deepEqual(controls, expectedControls);
const ci = await checkNominalPrimitiveSubtypeWitCiRecords({ route, mode, producer: head, directory: records, tap: prefix + ".tap", glibc: "2.36", cc: selected.cc, "wasm-tools": selected.wasmTools, "wasmtime-capi": selected.wasmtimeCapi }
	, { tap: tap.toString("utf8"), read: supplemented, runtime, tools, archiveSha256: handoff.archiveSha256 });
assert.equal(ci.executions, 2); assert.equal(ci.dispatchObserved, false); assert.equal(controls.recordControls, ci.records.length * 2);
const checked = { ...ci, controls };
for(const [path, digest] of Object.entries(sources)) assert.equal(sha256(await readFile(path.startsWith("/") ? path : resolve(cwd, path))), digest, path);
assert.deepEqual(await nativeArtifactPaths(sourceRoot), originalPaths);
for(const [path, digest] of Object.entries(originals)) assert.equal(sha256(await readFile(resolve(sourceRoot, path))), digest, path);
assert.equal(git(["rev-parse", "HEAD"]), head); assert.equal(git(["diff", "HEAD", "--name-only"]), "");
assert.equal(git(["status", "--porcelain", "--untracked-files=all", "--ignored"]), expectedStatus, "untracked entries"); assert.deepEqual(await worktreeLinks(), links);
const report = { head, route, mode, prefix, sourceRoot, runners, links, checked, originalsUnchanged: originalPaths.length, sourcesUnchanged: Object.keys(sources).length
	, finished: new Date().toISOString(), installedAcceptance: true, compiledAgain: false };
await writeFile(prefix + ".controls.json", canonicalJson(report), { flag: "wx" });
console.log(JSON.stringify(report));
