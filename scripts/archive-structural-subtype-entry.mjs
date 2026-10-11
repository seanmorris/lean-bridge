/**
 * Archive original native entry probes, retaining the initial raw-driver failure separately.
 * Compress repetitive trace bytes losslessly and authenticate both forms.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkStructuralSubtypeEntryReport } from "../tests/helpers/structural-subtype-entry-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 3, "Supply the failed ordinary, successful ordinary and successful reviewed prefixes");
const destination = "docs/evidence/structural-subtype-entry-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const files = new Map(), compressed = new Map(), attempts = [], runs = [];
const original = (revision, path) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
const runner = await readFile("build/run-structural-subtype-entry.mjs"); files.set("runner.mjs", runner);
for(const [index, prefix] of prefixes.entries())
{
	const route = index === 2 ? "reviewed" : "ordinary", success = index > 0, label = success ? route : "failed/r1";
	assert.match(prefix, new RegExp(`^build/vo1444-structural-entry-${route}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.runnerSha256, sha256(runner));
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_ENTRY_OUTPUT, prefix + "-records");
	assert.equal(start.command, "/usr/bin/taskset"); assert.equal(start.args[1], "3");
	assert.equal(start.args.at(-1), "tests/structural-subtype-entry-installed.test.mjs");
	assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.diskStop], [success ? 0 : 1, null, false]);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), success ? /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u : /# tests 1\n# suites 0\n# pass 0\n# fail 1\n# cancelled 0\n# skipped 0\n/u);
	if(!success) assert.match(tap.toString(), /missing raw symbol lb_tundefined_some/u);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}`, paths = await nativeArtifactPaths(root);
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of paths)
	{
		const bytes = await readFile(join(root, path)), record = `${label}/records/${path}`;
		if(path.endsWith(".trace"))
		{
			const packed = gzipSync(bytes, { level: 9 }); assert.deepEqual(gunzipSync(packed), bytes);
			files.set(record + ".gz", packed);
			compressed.set(record + ".gz", { compression: "gzip", originalPath: record, originalBytes: bytes.length, originalSha256: sha256(bytes) });
		}
		else files.set(record, bytes);
	}
	const attempt = { label, route, producerCommit: start.revision, success, records: paths, tapSha256: sha256(tap) };
	attempts.push(attempt);
	if(success)
	{
		const checked = await checkStructuralSubtypeEntryReport(path => readFile(join(root, path)), attempt);
		runs.push({ ...checked, tapSha256: attempt.tapSha256, reportSha256: sha256(await readFile(join(root, "report.json"))) });
	}
	else
	{
		assert.ok(!paths.includes("report.json"));
		for(const path of ["tests/helpers/structural-subtype-entry-raw.mjs", "tests/structural-subtype-entry.test.mjs", "tests/structural-subtype-entry-installed.test.mjs"])
			files.set(`${label}/sources/${path}`, original(start.revision, path));
	}
}
assert.equal(runs[0].producerCommit, runs[1].producerCommit);
const producerCommit = runs[0].producerCommit;
const selectedSources = [
	"src/analyze/NativeExports.lean", "src/build/native-model.mjs"
	, "src/build/component-refinements.mjs", "src/build/native-component.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/gmp-projection.mjs", "src/backends/c/gmp-values.mjs"
	, "tests/structural-subtype-entry-installed.test.mjs"
	, "tests/structural-subtype-entry.test.mjs"
	, "tests/helpers/structural-subtype-entry.mjs"
	, "tests/helpers/structural-subtype-entry-cases.mjs"
	, "tests/helpers/structural-subtype-entry-observe.mjs"
	, "tests/helpers/structural-subtype-entry-raw.mjs"
	, "tests/helpers/structural-subtype-installed-fixture.mjs"
	, "tests/helpers/php-wasm-subtype-entry-trace.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/fixtures/structural-subtype-consumers/c.c"
	, ...["StructuralSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/structural-subtypes/${path}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, original(producerCommit, path));
files.set("checker.mjs", await readFile("tests/helpers/structural-subtype-entry-report.mjs"));
const index = { schemaVersion: 1, kind: "structural-subtype-native-entry-v1"
	, producerCommit, attempts, runs, selectedSources
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes), ...compressed.get(path) }))
	, limitations: ["Separate annotated-source LD_PRELOAD probes, not unmodified-release dispatch measurements."
		, "Only ordinary/reviewed Linux x86-64 C packages with the recorded libc floor."
		, "No memory, other-host or hosted acceptance claim."
		, "Package binaries and complete toolchain closures are not retained."
		, "No support-inventory promotion or recurring CI gate follows from this archive."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
