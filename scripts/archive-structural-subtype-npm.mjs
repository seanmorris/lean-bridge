/**
 * Preserve both npm acceptance routes and the original failed harness attempts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkStructuralSubtypeNpmReport, structuralSubtypeNpmRecordPaths } from "../tests/helpers/structural-subtype-npm-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply the two failed ordinary runs, then successful ordinary and reviewed prefixes");
const destination = "docs/evidence/structural-subtype-npm-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const files = new Map(), attempts = [], runs = [];
const original = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const runner = await readFile("build/run-structural-subtype-npm.mjs");
files.set("runner.mjs", runner);
for(const [index, prefix] of prefixes.entries())
{
	const route = index === 3 ? "reviewed" : "ordinary", success = index >= 2;
	const label = success ? route : `failed/r${index + 1}`;
	assert.match(prefix, new RegExp(`^build/vo1444-structural-npm-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.runnerSha256, sha256(runner));
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_NPM_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/taskset"); assert.equal(start.args[0], "-c"); assert.equal(start.args[1], "3");
	assert.equal(start.args.at(-1), "tests/structural-subtype-npm-installed.test.mjs");
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [success ? 0 : 1, null, false]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), success ? /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u : /# tests 1\n# suites 0\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n/u);
	if(!success) assert.match(tap.toString(), index === 0 ? /node_modules\/undefined/u : /wrong rejection: mixed Fin before constructor/u);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`, paths = await nativeArtifactPaths(root);
	if(success) assert.deepEqual(paths.slice().sort(), structuralSubtypeNpmRecordPaths.slice().sort());
	else assert.ok(!paths.includes("report.json"));
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of paths) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	const attempt = { label, route, producerCommit: start.revision, success, records: paths, tapSha256: sha256(tap) };
	attempts.push(attempt);
	if(success)
	{
		const checked = await checkStructuralSubtypeNpmReport(path => readFile(join(root, path)), attempt);
		runs.push({ ...checked, tapSha256: attempt.tapSha256, reportSha256: sha256(await readFile(join(root, "report.json"))) });
	}
	else for(const path of ["tests/structural-subtype-npm-installed.test.mjs", "tests/structural-subtype-npm.test.mjs", "tests/fixtures/structural-subtype-consumers/javascript.mjs", "tests/fixtures/structural-subtype-consumers/index.mts"])
		files.set(`${label}/sources/${path}`, original(start.revision, path));
}
assert.equal(runs[0].producerCommit, runs[1].producerCommit);
const producerCommit = runs[0].producerCommit;
const selectedSources = [
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean", "src/analyze/native-types.mjs"
	, "src/analyze/export-configuration.mjs", "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/component-refinements.mjs", "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-package-receipt.mjs"
	, "tests/structural-subtype-npm-installed.test.mjs"
	, "tests/structural-subtype-npm.test.mjs"
	, "tests/helpers/structural-subtype-installed-fixture.mjs"
	, "tests/helpers/structural-subtype-npm-package.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/refinement-engine.mjs"
	, "tests/fixtures/structural-subtype-consumers/javascript.mjs"
	, "tests/fixtures/structural-subtype-consumers/index.mts"
	, ...["StructuralSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/structural-subtypes/${path}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, original(producerCommit, path));
files.set("checker.mjs", await readFile("tests/helpers/structural-subtype-npm-report.mjs"));
const index = { schemaVersion: 1, kind: "structural-subtype-npm-installed-v1"
	, producerCommit, attempts, runs, selectedSources
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Only the named ordinary/reviewed Node and strict TypeScript structural fixture."
		, "Constructor/source dispatch and memory usage are unmeasured."
		, "Package binaries and full toolchain closures are not retained; original receipts and installed-file hashes are retained."
		, "No browser, hosted acceptance, support-cell promotion or required recurring gate follows from this archive."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
