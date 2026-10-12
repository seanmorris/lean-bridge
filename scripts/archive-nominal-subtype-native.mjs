/**
 * Preserve the four original native nominal package selections, without promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { checkNominalSubtypeNativeReport, nominalSubtypeNativeRecordPaths } from "../tests/helpers/nominal-subtype-native-report.mjs";

const prefixes = process.argv.slice(2);
assert.equal(prefixes.length, 4, "Supply ordinary/full, reviewed/full, ordinary/result-only, reviewed/result-only prefixes");
const destination = "docs/evidence/nominal-subtype-native-20261011";
await assert.rejects(access(destination), { code: "ENOENT" });
const files = new Map(), runs = [];
const selections = [["ordinary", "full"], ["reviewed", "full"], ["ordinary", "result-only"], ["reviewed", "result-only"]];
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" };
const runner = await readFile("build/run-nominal-subtype-native.mjs");
for(const [index, [route, mode]] of selections.entries())
{
	const prefix = prefixes[index], label = `${route}-${mode}`;
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-native-${label}-r[0-9]+-[a-f0-9]{7}$`, "u"));
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assert.equal(start.route, route); assert.equal(start.mode, mode); assert.match(start.revision, /^[a-f0-9]{40}$/u);
	assert.equal(start.runnerSha256, sha256(runner));
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, ["-n", "19", "/usr/bin/ionice", "-c", "3"
		, "/usr/bin/taskset", "-c", "3", "/usr/bin/node", "--test"
		, "--test-concurrency=1"
		, "tests/helpers/nominal-subtype-native-installed-tests.mjs"]);
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_TEST, "1");
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_PROFILES, "c,cpp");
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_ROUTES, route);
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_MODES, mode);
	assert.equal(start.environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NATIVE_OUTPUT, prefix + "-records");
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, runtime.glibc);
	assert.equal(start.environment.LEAN_NUM_THREADS, "1"); assert.equal(start.environment.OMP_NUM_THREADS, "1");
	assert.equal(start.environment.MAKEFLAGS, "-j1");
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < 6);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]);
	assert.equal(end.error, undefined); assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
	const root = `${prefix}-records/${route}/${mode}`;
	const counts = mode === "full" ? { c: 4149, cpp: 4122 } : { c: 2042, cpp: 2042 };
	const checked = await checkNominalSubtypeNativeReport(path => readFile(join(root, path)), { route, mode, producerCommit: start.revision, runtime, counts });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${name}`, bytes);
	for(const path of nominalSubtypeNativeRecordPaths) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	runs.push({ label, prefix, started: start.started, finished: end.finished
		, ...checked, tapSha256: sha256(tap)
		, reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
const producerCommit = runs[0].producerCommit;
assert.ok(runs.every(run => run.producerCommit === producerCommit));
const selectedSources = [
	"src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean", "src/analyze/native-types.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/native-model.mjs", "src/build/component-refinements.mjs"
	, "src/build/refinement-mirrors.mjs", "src/build/native-project.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-gmp.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/c/fin-diagnostic.mjs"
	, "src/backends/c/gmp-projection.mjs", "src/backends/c/gmp-values.mjs"
	, "src/backends/cpp/generate.mjs", "src/backends/cpp/boost.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "tests/helpers/nominal-subtype-native-installed-tests.mjs"
	, "tests/helpers/nominal-subtype-native-caller.mjs"
	, "tests/helpers/nominal-subtype-native-caller-tests.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture-tests.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/package-set.mjs"
	, "tests/fixtures/nominal-subtype-consumers/c.c"
	, "tests/fixtures/nominal-subtype-consumers/cpp.cpp"
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(name => `tests/fixtures/onboarding/nominal-subtypes/${name}`)
];
for(const path of selectedSources) files.set(`sources/${path}`, execFileSync("git", ["show", `${producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 }));
files.set("runner.mjs", runner);
files.set("checker.mjs", await readFile("tests/helpers/nominal-subtype-native-report.mjs"));
const entries = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }));
const index = { schemaVersion: 1, kind: "nominal-subtype-native-installed-v1"
	, producerCommit, runs, selectedSources, files: entries
	, limitations: ["Observed Linux x64/glibc 2.36 only, not hosted release-floor acceptance."
		, "Constructor/source entry counts and memory usage are unmeasured."
		, "Only the named ordinary/reviewed full/result-only C/C++ nominal Nat fixture."
		, "Package archives and full toolchain closures are not retained; original receipts, package hashes, selected producer sources and execution records are retained."
		, "The process tree uses one CPU and one Lean thread. GMP explicitly uses make -j2 despite MAKEFLAGS=-j1."
		, "This archive does not promote support cells or establish recurring hosted gates."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
