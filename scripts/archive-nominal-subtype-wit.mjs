/**
 * Preserve original nominal WIT executions after independent package and record checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { nominalSubtypeWitOriginal, nominalSubtypeWitGenerator } from "../tests/helpers/nominal-subtype-wit-generators.mjs";
import { checkNominalSubtypeWitReport } from "../tests/helpers/nominal-subtype-wit-report.mjs";
import { checkNominalSubtypeWitControls } from "../tests/helpers/nominal-subtype-wit-controls.mjs";
import { inspectNominalSubtypeWitHandoff } from "../tests/helpers/nominal-subtype-wit-handoff.mjs";
import { nominalSubtypeWitComponentRecord } from "../tests/helpers/nominal-subtype-wit-package-records.mjs";
import { assertNominalSubtypeWitRun, nominalSubtypeWitSelections } from "../tests/helpers/nominal-subtype-wit-provenance.mjs";
import { waitNominalSubtypeDotnetResources } from "../tests/helpers/nominal-subtype-dotnet-resources.mjs";

const roots = process.argv.slice(2);
assert.equal(roots.length, 4, "Supply ordinary/full, ordinary/result-only, reviewed/full and reviewed/result-only directories");
const destination = "docs/evidence/nominal-subtype-wit-20261013";
await assert.rejects(access(destination), { code: "ENOENT" });
const producerCommit = "9b39bd38db9165e95a948a6bbc8023409cc8b4ce";
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const files = new Map([["runner.mjs", await readFile("build/vo1467-wit-installed-batch.mjs")]]), runs = [];
for(const [index, [route, mode]] of nominalSubtypeWitSelections.entries())
{
	await waitNominalSubtypeDotnetResources("build", { notify: console.log });
	const root = resolve(roots[index]), batch = dirname(dirname(root)), label = `${route}-${mode}`;
	assert.equal(root, join(batch, route, mode));
	const startBytes = await readFile(join(batch, "start.json")), endBytes = await readFile(join(batch, "runs.json"));
	const start = JSON.parse(startBytes), ends = JSON.parse(endBytes), end = ends.find(item => item.selection === `${route}/${mode}`);
	assert.equal(ends.filter(item => item.selection === `${route}/${mode}`).length, 1);
	const tap = await readFile(join(batch, label + ".tap"));
	assertNominalSubtypeWitRun({ start, end, tap, route, mode, producerCommit });
	if(index) assert.ok(Date.parse(runs[index - 1].finished) <= Date.parse(end.started));
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const original = path => readFile(join(root, path)), handoff = await inspectNominalSubtypeWitHandoff(original);
	const read = path => handoff.supplements.has(path) ? Promise.resolve(handoff.supplements.get(path)) : original(path);
	const checked = await checkNominalSubtypeWitReport(read, { route, mode, producerCommit, runtime, floor });
	assert.deepEqual(await nativeArtifactPaths(root), [...checked.records.filter(path => path !== nominalSubtypeWitComponentRecord), handoff.archivePath].sort());
	const controls = await checkNominalSubtypeWitControls(read, checked);
	for(const [path, bytes] of [["start.json", startBytes], ["runs.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${path}`, bytes);
	for(const path of checked.records) files.set(`${label}/records/${path}`, await read(path));
	runs.push({ label, originalRoot: root
		, started: end.started, finished: end.finished
		, ...checked, controls, tapSha256: sha256(tap) });
	process.stdout.write(canonicalJson({ label, records: checked.records.length, controls }));
}

const failedAttempts = [];
for(const [attempt, mode, reason, pattern] of [
	["r1", "full", "The original harness expected flat world exports and stopped before compiling the public caller.", /assert\.match|AssertionError/u]
	, ["r2", "result-only", "The disk guard stopped before the first installed execution; both original package builds and the caller had completed.", /requires 2 GiB free disk/u]
]) {
	const batch = `build/vo1467-wit-installed-20261013-${attempt}`, root = `${batch}/ordinary/${mode}`;
	const label = `failed-${attempt}-ordinary-${mode}`, startBytes = await readFile(batch + "/start.json"), endBytes = await readFile(batch + "/runs.json");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes).find(item => item.selection === `ordinary/${mode}`), tap = await readFile(`${batch}/ordinary-${mode}.tap`);
	assert.equal(end.code, 1); assert.equal(end.signal, null); assert.deepEqual(end.changed, []);
	assert.equal(end.bytes, tap.length); assert.equal(end.sha256, sha256(tap)); assert.equal(end.sourcesChecked, Object.keys(start.sources).length);
	assert.match(tap.toString(), pattern); assert.match(tap.toString(), /# pass 0\n# fail 1/u);
	await assert.rejects(access(root + "/report.json"), { code: "ENOENT" });
	await verifyPackageSetReceipt({ receiptPath: root + "/handoff/package-set-receipt.json" });
	const receipt = JSON.parse(await readFile(root + "/handoff/package-set-receipt.json")), artifact = receipt.packages[0].artifacts[0];
	const records = (await nativeArtifactPaths(root)).filter(path => path !== "handoff/" + artifact.path);
	for(const [path, bytes] of [["start.json", startBytes], ["runs.json", endBytes], ["run.tap", tap]]) files.set(`${label}/${path}`, bytes);
	for(const path of records) files.set(`${label}/records/${path}`, await readFile(join(root, path)));
	failedAttempts.push({ label, route: "ordinary", mode
		, producerCommit: start.head
		, originalRoot: resolve(root), code: 1, records, artifact, reason
		, tapSha256: sha256(tap) });
}

const generatorClosure = (await nominalSubtypeWitGenerator(producerCommit)).paths;
const selectedSources = [...new Set([
	...generatorClosure, "src/analyze/NativeExports.lean"
	, "src/build/native-component.mjs", "src/build/native-wit-artifacts.mjs"
	, "src/release/native-wasi.mjs", "src/release/deterministic-archive.mjs"
	, "tests/helpers/nominal-subtype-installed-fixture.mjs"
	, ...["fixture", "tools", "package", "install", "interface", "installed-tests"]
		.map(name => `tests/helpers/nominal-subtype-wit-${name}.mjs`)
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/fin-container-edge-closure.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs", "tests/helpers/module-closure.mjs"
	, ...["wit-wasi.c", "wit-values.h", "wit-inputs.h"]
		.map(path => `tests/fixtures/nominal-subtype-consumers/${path}`)
	, ...["NominalSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"]
		.map(path => `tests/fixtures/onboarding/nominal-subtypes/${path}`)
])].sort();
for(const path of selectedSources)
{
	const bytes = nominalSubtypeWitOriginal(producerCommit, path);
	for(const run of runs)
		assert.equal(JSON.parse(files.get(`${run.label}/start.json`)).sources[path], sha256(bytes), path);
	files.set("sources/" + path, bytes);
}
const checkers = ["generators", "report", "model-records", "package-records"
	, "tool-records", "environment-records", "provenance", "controls", "handoff"];
for(const name of checkers) files.set(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-subtype-wit-${name}.mjs`));
const index = { schemaVersion: 1, kind: "nominal-subtype-wit-installed-v1"
	, producerCommit, runs, generatorClosure, selectedSources, checkers
	, failedAttempts
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux x64/glibc 2.36 with Wasmtime 42.0.1; no hosted 2.38 inference."
		, "The component calls its authenticated native Lean host. This is not a standalone WASI package."
		, "The named nominal Nat fixture includes mixed Fin fields; other primitive bases and transports remain separate tasks."
		, "No constructor/source-entry counters or algorithm-memory observations."
		, "Selected command binaries and Wasmtime C API identities are recorded. Complete compiler and operating-system distributions remain trusted."
		, "Native libraries and complete original archives remain in build handoffs. This archive retains their identities, the original compiled components and caller binaries."
		, "Author/build roots and consumer compilation inputs were removed before the two executions. Packaged generated source members remain installed."
		, "Original batch records freeze 5,541 source inputs and retain terminal comparisons. The launcher did not record its own pre-launch hash or the full ambient environment."
		, "The compiled-component supplements were copied from each authenticated complete original archive without regeneration."
		, "This archive alone does not promote support or require recurring installed CI."] };
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommit, indexSha256: sha256(canonicalJson(index)) }));
