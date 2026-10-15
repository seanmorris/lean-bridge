import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, readlink, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// VO #1492: run the real primitive-base Ruby controls against one selection's original records.
// Usage: node run-vo1492-nominal-primitive-ruby-controls-aaadc4f.mjs <ordinary|reviewed> <full|result-only> <prefix>
const cwd = "/app/build/worktrees/nominal-subtype-ruby-vo1492-load8";
const expectedRevision = "aaadc4fc84dc7d31ff134013b61bf1c789bfb5bb";
const producerRunner = `/app/build/run-vo1492-nominal-primitive-ruby-${expectedRevision.slice(0, 7)}.mjs`;
const { canonicalJson, sha256 } = await import(`${cwd}/src/capsule/node.mjs`);
const { nativeArtifactPaths } = await import(`${cwd}/src/build/native-artifacts.mjs`);
const { waitNominalSubtypeDotnetResources } = await import(`${cwd}/tests/helpers/nominal-subtype-dotnet-resources.mjs`);
const { checkNominalPrimitiveSubtypeRubyControls } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-ruby-controls.mjs`);
const { checkNominalPrimitiveSubtypeRubyCiRecords } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-ruby-ci-report.mjs`);
const { runCopied } = await import(`${cwd}/tests/helpers/copied-fixture-install.mjs`);
const [route, mode, prefix] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
assert.match(prefix ?? "", new RegExp(`^/app/build/vo1492-nominal-primitive-ruby-${route}-${mode}-r[1-9][0-9]*-${expectedRevision.slice(0, 7)}$`, "u"));
const git = args => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
// The complete untracked listing, ignored entries included, must be exactly the two symlinks.
const expectedStatus = "?? .toolchains\n?? node_modules";
const worktreeLinks = async () => {
	const links = {};
	for(const entry of await readdir(cwd)) if(entry !== ".git" && (await lstat(`${cwd}/${entry}`)).isSymbolicLink()) links[entry] = await readlink(`${cwd}/${entry}`);
	assert.deepEqual(links, { ".toolchains": "/app/.toolchains", node_modules: "/app/node_modules" }, "worktree symlinks"); return links;
};
const head = git(["rev-parse", "HEAD"]);
assert.equal(head, expectedRevision); assert.equal(git(["diff", "HEAD", "--name-only"]), "");
assert.equal(git(["status", "--porcelain", "--untracked-files=all", "--ignored"]), expectedStatus, "untracked entries");
const start = JSON.parse(await readFile(prefix + ".start.json")), end = JSON.parse(await readFile(prefix + ".end.json"));
assert.equal(start.revision, head); assert.equal(start.route, route); assert.equal(start.mode, mode);
const maxLoad = Number(start.environment.LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_MAX_LOAD);
assert.equal(maxLoad, 8); assert.equal(start.guards.initial.load, maxLoad);
// Both untracked runner files must still be the bytes the producer recorded at launch.
const runners = { [producerRunner]: start.runnerSha256, [import.meta.filename]: start.controlsRunnerSha256 };
for(const [path, digest] of Object.entries(runners)) assert.equal(sha256(await readFile(path)), digest, `${path} changed since launch`);
const links = await worktreeLinks(); assert.deepEqual(start.links, links);
assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]); assert.equal(end.error, undefined);
const tap = await readFile(prefix + ".tap"); assert.equal(sha256(tap), end.tapSha256);
const sourceRoot = prefix + "-records", records = resolve(sourceRoot, route, mode);
const sourcePaths = [
	"tests/fixtures/nominal-primitive-subtype-consumers/ruby.rb"
	, ...["fixture", "installed-tests", "archive", "package", "environment-records", "model-records", "package-records", "report", "controls", "ci-report"]
		.map(name => `tests/helpers/nominal-primitive-subtype-ruby-${name}.mjs`)
	, "tests/helpers/nominal-primitive-subtype-ruby-model.rb"
	, "tests/helpers/nominal-subtype-ruby-generators.mjs"
	, "tests/helpers/fin-container-edge-ruby-closure.mjs"
];
const sources = { ...runners };
for(const path of sourcePaths) sources[path] = sha256(await readFile(resolve(cwd, path)));
const originalPaths = await nativeArtifactPaths(sourceRoot), originals = {};
for(const path of originalPaths) originals[path] = sha256(await readFile(resolve(sourceRoot, path)));
const resources = await waitNominalSubtypeDotnetResources(sourceRoot, { maxLoad, notify: console.log });
await writeFile(prefix + ".controls.start.json", canonicalJson({ head, route, mode, prefix, sourceRoot, runners, links, sources, originals, resources, started: new Date().toISOString(), compiledAgain: false }), { flag: "wx" });
const read = path => {
	assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== ".."));
	return readFile(resolve(records, path));
};
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" }); assert.equal(version, "glibc 2.36\n");
const command = await realpath(start.environment.LEAN_BRIDGE_RUBY), commandBytes = await readFile(command);
const interpreter = { command
	, identity: { bytes: commandBytes.length, sha256: sha256(commandBytes) }
	, run: await runCopied(command, ["--disable-gems", "-rjson", "-e", "print JSON.generate({engine: RUBY_ENGINE, version: RUBY_VERSION, platform: RUBY_PLATFORM})"], cwd) };
assert.equal(interpreter.run.stderr, "");
const rubyVersion = JSON.parse(interpreter.run.stdout).version;
const runtime = { platform: process.platform, arch: process.arch, glibc: "2.36" };
const options = { route, mode, producerCommit: head, runtime, floor: "2.36", rubyVersion };
const checked = await checkNominalPrimitiveSubtypeRubyControls(read, options);
const expectedControls = { recordControls: checked.records * 2, environmentControls: 12, packageControls: 4
	, modelControls: mode === "full" ? 42 : 23, executionControls: 20 };
assert.equal(checked.executions, 2); assert.equal(checked.dispatchObserved, false); assert.equal(checked.generatorModules, 19);
for(const [key, value] of Object.entries(expectedControls)) assert.equal(checked[key], value, key);
const ci = await checkNominalPrimitiveSubtypeRubyCiRecords({ route, mode, producer: head, directory: records, tap: prefix + ".tap", glibc: "2.36", ruby: command }
	, { tap: tap.toString("utf8"), read, runtime, interpreter });
assert.deepEqual(checked, { ...ci, ...expectedControls });
for(const [path, digest] of Object.entries(sources)) assert.equal(sha256(await readFile(path.startsWith("/") ? path : resolve(cwd, path))), digest, path);
assert.deepEqual(await nativeArtifactPaths(sourceRoot), originalPaths);
for(const [path, digest] of Object.entries(originals)) assert.equal(sha256(await readFile(resolve(sourceRoot, path))), digest, path);
assert.equal(git(["rev-parse", "HEAD"]), head); assert.equal(git(["diff", "HEAD", "--name-only"]), "");
assert.equal(git(["status", "--porcelain", "--untracked-files=all", "--ignored"]), expectedStatus, "untracked entries"); assert.deepEqual(await worktreeLinks(), links);
const report = { head, route, mode, prefix, sourceRoot, runners, links, checked, originalsUnchanged: originalPaths.length, sourcesUnchanged: Object.keys(sources).length
	, finished: new Date().toISOString(), installedAcceptance: true, compiledAgain: false };
await writeFile(prefix + ".controls.json", canonicalJson(report), { flag: "wx" });
console.log(JSON.stringify(report));
