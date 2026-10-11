/**
 * Preserve two original structural WIT installed runs with exact producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkStructuralSubtypeWitReport, structuralSubtypeWitRecords } from "../tests/helpers/structural-subtype-wit-report.mjs";

const selections = process.argv.slice(2);
assert.equal(selections.length, 3, "Supply successful ordinary/reviewed prefixes, then the original failed ordinary prefix");
const prefixes = selections.slice(0, 2), failedPrefix = selections[2];
const destination = "docs/evidence/structural-subtype-wit-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const runner = await readFile("build/run-structural-subtype-wit.mjs"), files = new Map([["runner.mjs", runner]]), runs = [];
const source = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
for(const [index, prefix] of prefixes.entries())
{
	const route = index ? "reviewed" : "ordinary", label = route;
	assert.match(prefix, new RegExp(`^build/vo1444-structural-wit-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.equal(start.runnerSha256, sha256(runner));
	assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_WIT_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/taskset"); assert.equal(start.args[1], "3");
	assert.equal(start.args.at(-1), "tests/helpers/structural-subtype-wit-installed-tests.mjs");
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.match(tap.toString(), new RegExp(`ok 1 - installed structural Subtypes WIT ${route} reproduce and relocate`, "u"));
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`;
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...structuralSubtypeWitRecords].sort());
	const checked = await checkStructuralSubtypeWitReport(path => readFile(join(root, path)), { route, producerCommit: start.revision });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of structuralSubtypeWitRecords) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	runs.push({ ...checked, label, tapSha256: sha256(tap), reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
assert.equal(new Set(runs.map(run => run.producerCommit)).size, 1);
const producerCommit = runs[0].producerCommit;
const selectedSources = [
	"src/analyze/NativeExports.lean", "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs", "src/build/native-component.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, ...["copied-model.mjs", "copied-host.mjs", "copied-conversions.mjs"
		, "copied-component.mjs", "copied-aliases.mjs"]
		.map(path => `src/backends/wit/${path}`)
	, "src/build/native-wit-artifacts.mjs", "src/build/native-wit-projection.mjs"
	, "src/release/native-wasi.mjs", "src/backends/wit/host-evidence.mjs"
	, "tests/structural-subtype-installed.test.mjs"
	, "tests/helpers/structural-subtype-installed-fixture.mjs"
	, "tests/helpers/structural-subtype-wit-fixture.mjs"
	, "tests/helpers/structural-subtype-wit-installed-tests.mjs"
	, "tests/helpers/structural-subtype-wit-tests.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/fixtures/structural-subtype-consumers/wit-wasi.c"
	, "tests/fixtures/structural-subtype-consumers/wit-values.h"
	, ...["StructuralSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/structural-subtypes/${path}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, source(producerCommit, path));

// Preserve the original formatting failure without counting it as acceptance.
assert.equal(failedPrefix, "build/vo1444-structural-wit-ordinary-r1-7a1b8ac");
const failedStart = await readFile(failedPrefix + ".start.json"), failedEnd = await readFile(failedPrefix + ".end.json"), failedTap = await readFile(failedPrefix + ".tap");
const failed = { start: JSON.parse(failedStart), end: JSON.parse(failedEnd) };
assert.equal(failed.start.route, "ordinary");
assert.match(failed.start.revision, /^7a1b8ac[a-f0-9]{33}$/u);
assert.equal(failed.start.runnerSha256, sha256(runner));
assert.deepEqual([failed.end.code, failed.end.signal, failed.end.diskStop], [1, null, false]);
assert.equal(failed.end.tapSha256, sha256(failedTap));
assert.match(failedTap.toString(), /# tests 1\n# suites 0\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n/u);
assert.match(failedTap.toString(), /structural WIT check failed at 133: exact/u);
const failedRoot = failedPrefix + "-records/ordinary";
const failedRecords = await nativeArtifactPaths(failedRoot);
const expectedFailedRecords = ["configuration.json", "consumer.c"
	, "expected.binding-ir.json"
	, ...[0, 1].flatMap(i => ["model.json", "package-set-receipt.json", "StructuralSubtypes.lean"].map(path => `build-${i}/${path}`))];
assert.deepEqual(failedRecords, expectedFailedRecords.sort());
for(const [path, bytes] of [["start.json", failedStart], ["end.json", failedEnd], ["run.tap", failedTap]]) files.set("failed/" + path, bytes);
for(const path of failedRecords) files.set("failed/records/" + path, await readFile(join(failedRoot, path)));
const failedSources = ["tests/fixtures/structural-subtype-consumers/wit-values.h"
	, "tests/fixtures/structural-subtype-consumers/wit-wasi.c"
	, "tests/helpers/structural-subtype-wit-fixture.mjs"
	, "tests/helpers/structural-subtype-wit-installed-tests.mjs"];
for(const path of failedSources) files.set("failed/sources/" + path, source(failed.start.revision, path));

files.set("checker.mjs", await readFile("tests/helpers/structural-subtype-wit-report.mjs"));
const index = {
	schemaVersion: 1, kind: "structural-subtype-wit-installed-v1"
	, producerCommit, runs, selectedSources
	, failed: { producerCommit: failed.start.revision, sources: failedSources
		, records: failedRecords, tapSha256: sha256(failedTap)
		, reason: "The independent caller did not account for Wasmtime's formatted-chain final newline. Corrected in 3a9cea9 before the successful installed runs." }
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux x86-64 glibc 2.36 acceptance, not hosted release-floor acceptance."
		, "No WIT constructor/source entry counts or memory measurement."
		, "Package binaries and complete toolchain closures are not retained."
		, "No support-inventory promotion or recurring installed CI gate follows from this archive."]
};
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
