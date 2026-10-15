import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readdir, readFile, readlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// VO #1493: run the real primitive-base Perl controls against one selection's original records.
// Usage: node run-vo1493-nominal-primitive-perl-controls-acc614c.mjs <ordinary|reviewed> <full|result-only> <prefix>
const cwd = "/app/build/worktrees/nominal-subtype-perl-vo1493";
const expectedRevision = "acc614cd17981972b3f12307a94b0eef4a957fc5";
const producerRunner = `/app/build/run-vo1493-nominal-primitive-perl-${expectedRevision.slice(0, 7)}.mjs`;
const { canonicalJson, sha256 } = await import(`${cwd}/src/capsule/node.mjs`);
const { nativeArtifactPaths } = await import(`${cwd}/src/build/native-artifacts.mjs`);
const { waitNominalSubtypeDotnetResources } = await import(`${cwd}/tests/helpers/nominal-subtype-dotnet-resources.mjs`);
const { checkNominalPrimitiveSubtypePerlControls } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-perl-controls.mjs`);
const { checkNominalPrimitiveSubtypePerlCiRecords } = await import(`${cwd}/tests/helpers/nominal-primitive-subtype-perl-ci-report.mjs`);
const [route, mode, prefix] = process.argv.slice(2);
assert.ok(["ordinary", "reviewed"].includes(route)); assert.ok(["full", "result-only"].includes(mode));
assert.match(prefix ?? "", new RegExp(`^/app/build/vo1493-nominal-primitive-perl-${route}-${mode}-r[1-9][0-9]*-${expectedRevision.slice(0, 7)}$`, "u"));
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
// Both untracked runner files must still be the bytes the producer recorded at launch.
const runners = { [producerRunner]: start.runnerSha256, [import.meta.filename]: start.controlsRunnerSha256 };
for(const [path, digest] of Object.entries(runners)) assert.equal(sha256(await readFile(path)), digest, `${path} changed since launch`);
const links = await worktreeLinks(); assert.deepEqual(start.links, links);
assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]); assert.equal(end.error, undefined);
const tap = await readFile(prefix + ".tap"); assert.equal(sha256(tap), end.tapSha256);
const sourceRoot = prefix + "-records", records = resolve(sourceRoot, route, mode);
const sourcePaths = [
	"tests/fixtures/nominal-primitive-subtype-consumers/perl.pl", "tests/helpers/closed-package-tar.mjs"
	, ...["fixture", "install", "installed-tests", "model-records", "package-records", "handoff", "report", "controls", "ci-report"]
		.map(name => `tests/helpers/nominal-primitive-subtype-perl-${name}.mjs`)
	, "tests/helpers/nominal-subtype-perl-generators.mjs", "tests/helpers/checked-record-perl-install.mjs"
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
const version = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], { encoding: "utf8" }); assert.equal(version, "glibc 2.36\n");
const runtime = { platform: process.platform, arch: process.arch, glibc: "2.36" }, options = { route, mode, producerCommit: head, runtime, floor: "2.36" };
const checked = await checkNominalPrimitiveSubtypePerlControls(read, options);
const expectedControls = { recordControls: checked.records * 2, packageControls: 48, handoffControls: 4, modelControls: mode === "full" ? 43 : 24 };
assert.equal(checked.executions, 16); assert.equal(checked.dispatchObserved, false);
for(const [key, value] of Object.entries(expectedControls)) assert.equal(checked[key], value, key);
const ci = await checkNominalPrimitiveSubtypePerlCiRecords({ route, mode, producer: head, directory: records, tap: prefix + ".tap", glibc: "2.36" }, { tap: tap.toString("utf8"), read, runtime });
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
