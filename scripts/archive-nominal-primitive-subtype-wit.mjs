/**
 * Retain the four accepted nineteen-base nominal WIT selections and their independent controls.
 *
 * This is a one-shot evidence promotion script. It never rebuilds or executes a component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { checkNominalPrimitiveSubtypeWitControls } from "../tests/helpers/nominal-primitive-subtype-wit-controls.mjs";
import { nominalPrimitiveSubtypeWitCheckerPath, nominalPrimitiveSubtypeWitEvidence, nominalPrimitiveSubtypeWitEvidenceCheckers, nominalPrimitiveSubtypeWitEvidenceSources, nominalPrimitiveSubtypeWitExpectedControls, nominalPrimitiveSubtypeWitPrefix, nominalPrimitiveSubtypeWitPreservedRetained } from "../tests/helpers/nominal-primitive-subtype-wit-evidence.mjs";
import { inspectNominalPrimitiveSubtypeWitHandoff } from "../tests/helpers/nominal-primitive-subtype-wit-handoff.mjs";
import { checkNominalPrimitiveSubtypeWitReport } from "../tests/helpers/nominal-primitive-subtype-wit-report.mjs";
import { nominalSubtypeWitGenerator, nominalSubtypeWitOriginal } from "../tests/helpers/nominal-subtype-wit-generators.mjs";
import {
	assertNominalPrimitiveSubtypeWitControlsRun
	, assertNominalPrimitiveSubtypeWitPreservedLaunch
	, assertNominalPrimitiveSubtypeWitRun
	, nominalPrimitiveSubtypeWitAcceptedLaunches
	, nominalPrimitiveSubtypeWitControlsRunner
	, nominalPrimitiveSubtypeWitFirstControlsRunner
	, nominalPrimitiveSubtypeWitFirstRunner
	, nominalPrimitiveSubtypeWitFirstWorktree
	, nominalPrimitiveSubtypeWitLoadCeiling
	, nominalPrimitiveSubtypeWitPreservedLaunches
	, nominalPrimitiveSubtypeWitProducer
	, nominalPrimitiveSubtypeWitRunner
	, nominalPrimitiveSubtypeWitSelections
	, nominalPrimitiveSubtypeWitTools
	, nominalPrimitiveSubtypeWitWorktree
} from "../tests/helpers/nominal-primitive-subtype-wit-provenance.mjs";

assert.equal(process.argv.length, 2, "The frozen accepted launches take no arguments");
await assert.rejects(access(nominalPrimitiveSubtypeWitEvidence), { code: "ENOENT" });
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const files = new Map();
const put = (path, bytes) => { assert.ok(!files.has(path), path); files.set(path, bytes); };

const runnerBytes = await readFile(nominalPrimitiveSubtypeWitRunner);
const controlsRunnerBytes = await readFile(nominalPrimitiveSubtypeWitControlsRunner);
put("runners/" + basename(nominalPrimitiveSubtypeWitRunner), runnerBytes);
put("runners/" + basename(nominalPrimitiveSubtypeWitControlsRunner), controlsRunnerBytes);
const firstRunnerBytes = await readFile(nominalPrimitiveSubtypeWitFirstRunner);
const firstControlsRunnerBytes = await readFile(nominalPrimitiveSubtypeWitFirstControlsRunner);
put("runners/" + basename(nominalPrimitiveSubtypeWitFirstRunner), firstRunnerBytes);
put("runners/" + basename(nominalPrimitiveSubtypeWitFirstControlsRunner), firstControlsRunnerBytes);

const runs = []; let previousFinish = 0;
assert.deepEqual(nominalPrimitiveSubtypeWitAcceptedLaunches.map(item => [item.route, item.mode]), nominalPrimitiveSubtypeWitSelections);
assert.equal(nominalPrimitiveSubtypeWitPreservedLaunches.length, 1);
for(const launch of nominalPrimitiveSubtypeWitAcceptedLaunches)
{
	const { route, mode, attempt } = launch, label = `${route}-${mode}`, prefix = nominalPrimitiveSubtypeWitPrefix(launch);
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalPrimitiveSubtypeWitRun({ start, end, tap, runner: runnerBytes, controlsRunner: controlsRunnerBytes, route, mode, prefix });
	assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the prior accepted selection`);
	const controlBytes = {};
	for(const name of ["controls.start.json", "controls.json", "controls.end.json", "controls.log"]) controlBytes[name] = await readFile(prefix + "." + name);
	for(const name of ["controls.start.json", "controls.json"])
		assert.equal(controlBytes[name].toString(), canonicalJson(JSON.parse(controlBytes[name])), name);
	const controlsStart = JSON.parse(controlBytes["controls.start.json"]), controls = JSON.parse(controlBytes["controls.json"]);
	const controlsEnd = JSON.parse(controlBytes["controls.end.json"]), root = prefix + `-records/${route}/${mode}`;
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const original = path => readFile(join(root, path)), handoff = await inspectNominalPrimitiveSubtypeWitHandoff(original);
	const read = path => handoff.supplements.has(path) ? Promise.resolve(handoff.supplements.get(path)) : original(path);
	const options = { route, mode, producerCommit: nominalPrimitiveSubtypeWitProducer, runtime, floor };
	const counts = await checkNominalPrimitiveSubtypeWitReport(read, options);
	assert.deepEqual(await nativeArtifactPaths(root), [...counts.records.filter(path => !handoff.supplements.has(path)), handoff.archivePath].sort());
	const expected = nominalPrimitiveSubtypeWitExpectedControls(mode, counts.records.length);
	assert.deepEqual(await checkNominalPrimitiveSubtypeWitControls(read, options), expected);
	assertNominalPrimitiveSubtypeWitControlsRun({
		start, end, controlsStart, controls, controlsEnd
		, log: controlBytes["controls.log"], route, mode, prefix
		, expected: { ...counts, tools: JSON.parse(await original("tools.json")), controls: expected } });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) put(`${label}/producer/${name}`, bytes);
	for(const [name, bytes] of Object.entries(controlBytes)) put(`${label}/controls/${name}`, bytes);
	// The complete original archive stays in the build handoff; its component supplement is retained from it.
	for(const path of counts.records) put(`${label}/records/${path}`, await read(path));
	previousFinish = Date.parse(controlsEnd.finished);
	runs.push({
		label, route, mode, attempt, prefix
		, loadCeiling: nominalPrimitiveSubtypeWitLoadCeiling
		, worktree: nominalPrimitiveSubtypeWitWorktree
		, runtime, floor
		, started: start.started
		, finished: end.finished
		, controlsFinished: controlsEnd.finished
		, tapSha256: sha256(tap)
		, reportSha256: sha256(await original("report.json"))
		, archiveSha256: handoff.archiveSha256
		, counts: counts.counts
		, controls: expected
	});
	process.stdout.write(canonicalJson({ label, records: counts.records.length, controls: expected }) + "\n");
}

const preserved = [];
for(const launch of nominalPrimitiveSubtypeWitPreservedLaunches)
{
	const prefix = nominalPrimitiveSubtypeWitPrefix(launch), label = `${launch.route}-${launch.mode}-${launch.attempt}`;
	const retainedBytes = {};
	for(const name of nominalPrimitiveSubtypeWitPreservedRetained) retainedBytes[name] = await readFile(prefix + "." + (name === "run.tap" ? "tap" : name));
	const start = JSON.parse(retainedBytes["start.json"]), end = JSON.parse(retainedBytes["end.json"]), controlsEnd = JSON.parse(retainedBytes["controls.end.json"]);
	assertNominalPrimitiveSubtypeWitPreservedLaunch({
		start, end, tap: retainedBytes["run.tap"], controlsEnd
		, log: retainedBytes["controls.log"]
		, runner: firstRunnerBytes, controlsRunner: firstControlsRunnerBytes
		, route: launch.route, mode: launch.mode, prefix });
	assert.ok(Date.parse(controlsEnd.finished) <= Date.parse(runs[0].started), "the preserved launch precedes every accepted launch");
	for(const [name, bytes] of Object.entries(retainedBytes)) put(`preserved/${label}/${name}`, bytes);
	preserved.push({
		label, ...launch, prefix
		, worktree: nominalPrimitiveSubtypeWitFirstWorktree
		, counted: false
		, classification: "checker defect: the producer passed, then the controls phase at the first launch commit threw on the unrefined word width export; fixed before the accepted producer commit"
		, started: start.started
		, finished: end.finished
		, controlsFinished: controlsEnd.finished
		, retained: [...nominalPrimitiveSubtypeWitPreservedRetained]
		, tapSha256: sha256(retainedBytes["run.tap"]) });
}

const generatorClosure = (await nominalSubtypeWitGenerator(nominalPrimitiveSubtypeWitProducer)).paths;
const selectedSources = [...new Set([...generatorClosure, ...nominalPrimitiveSubtypeWitEvidenceSources])].sort();
for(const path of selectedSources) put("sources/" + path, nominalSubtypeWitOriginal(nominalPrimitiveSubtypeWitProducer, path));
for(const name of nominalPrimitiveSubtypeWitEvidenceCheckers) put(`checkers/${name}.mjs`, await readFile(nominalPrimitiveSubtypeWitCheckerPath(name)));

const index = {
	schemaVersion: 1, kind: "nominal-primitive-subtype-wit-installed-v1"
	, producerCommit: nominalPrimitiveSubtypeWitProducer
	, loadCeiling: nominalPrimitiveSubtypeWitLoadCeiling
	, tools: nominalPrimitiveSubtypeWitTools
	, runner: { producer: basename(nominalPrimitiveSubtypeWitRunner), controls: basename(nominalPrimitiveSubtypeWitControlsRunner) }
	, firstRunner: { producer: basename(nominalPrimitiveSubtypeWitFirstRunner), controls: basename(nominalPrimitiveSubtypeWitFirstControlsRunner) }
	, runs
	, preserved
	, selectedSources
	, generatorClosure
	, checkers: nominalPrimitiveSubtypeWitEvidenceCheckers
	, files: [...files].sort(([left], [right]) => left.localeCompare(right)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor and Wasmtime 42.0.1, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete WIT packages from two author roots, install offline after author removal, compile the public C caller once and replay after moving the installed tree."
		, "The component calls its authenticated native Lean host through Wasmtime; this is not a standalone WASI package, and the recorded 64-bit word width is the native host's."
		, "All accepted launches ran serially on one CPU under the default admission ceiling of 6 with unchanged disk and memory floors; no accepted launch was stopped by a floor."
		, "The first ordinary/full launch at the preceding commit produced a passing package but its controls phase stopped on a checker defect; it is retained, classified and never counted as acceptance."
		, "Complete original archives and native libraries remain in the build handoffs. This archive retains their identities, the original compiled components, caller binaries, execution and control records and selected frozen producer sources; external toolchain binaries are not retained."
		, "The shared fixture covers all nineteen admitted primitive bases in acyclic records, variants, aliases, mixed Fin guards and constructor-free results; it does not generalize to every nominal type."
		, "Constructor/source entry counts and memory are unmeasured. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work."
		, "Selected command binaries and the Wasmtime C API identities are recorded; complete compiler and operating-system distributions remain trusted."
		, "Archived absolute paths record the original host and are not CI prerequisites. This archive does not itself promote support or establish the hosted result."
	]
};
await mkdir(nominalPrimitiveSubtypeWitEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSubtypeWitEvidence, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(nominalPrimitiveSubtypeWitEvidence, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSubtypeWitEvidence
	, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nominalPrimitiveSubtypeWitProducer
	, indexSha256: sha256(canonicalJson(index)) }) + "\n");
