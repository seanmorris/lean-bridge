/**
 * Preserve original two-root C/C++ structural Subtype runs without promoting support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkStructuralSubtypeNativeReport, structuralSubtypeNativeRecordPaths } from "../tests/helpers/structural-subtype-native-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 2, "Supply ordinary and reviewed original run prefixes");
const destination = "docs/evidence/structural-subtype-native-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const files = new Map(), runs = [];
for(const [index, route] of ["ordinary", "reviewed"].entries())
{
	const prefix = prefixes[index];
	assert.match(prefix, new RegExp(`^build/vo1444-structural-native-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PROFILES, "c,cpp");
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_OUTPUT, prefix + "-records");
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 3\n# suites 0\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`;
	const checked = await checkStructuralSubtypeNativeReport(path => readFile(join(root, path)), { route, producerCommit: start.revision });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${route}/${name}`, bytes);
	for(const path of structuralSubtypeNativeRecordPaths) files.set(`${route}/records/${path}`, await readFile(join(root, path)));
	const runner = await readFile("build/run-structural-subtype-installed.mjs");
	assert.equal(sha256(runner), start.runnerSha256); files.set("runner.mjs", runner);
	runs.push({ ...checked, tapSha256: sha256(tap), reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
assert.equal(runs[0].producerCommit, runs[1].producerCommit);
const producerCommit = runs[0].producerCommit;
const selectedSources = [
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean", "src/analyze/native-types.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/native-model.mjs", "src/build/component-refinements.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/fin-diagnostic.mjs"
	, "src/backends/c/gmp-projection.mjs", "src/backends/c/gmp-values.mjs"
	, "tests/structural-subtype-installed.test.mjs"
	, "tests/helpers/structural-subtype-installed-fixture.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/fixtures/structural-subtype-consumers/c.c"
	, "tests/fixtures/structural-subtype-consumers/cpp.cpp"
	, ...["StructuralSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(name => `tests/fixtures/onboarding/structural-subtypes/${name}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 }));
files.set("checker.mjs", await readFile("tests/helpers/structural-subtype-native-report.mjs"));
const entries = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
const index = { schemaVersion: 1, kind: "structural-subtype-native-installed-v1"
	, producerCommit, runs, selectedSources, files: entries
	, limitations: ["Local glibc 2.36, not hosted release-floor acceptance."
		, "Constructor/source dispatch and memory usage are unmeasured."
		, "Only the named ordinary/reviewed C/C++ structural-container fixture."
		, "Archives and full toolchain closures are not stored; package digests and original execution records are retained."
		, "No support-cell promotion or recurring hosted gate is established by this archive."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
