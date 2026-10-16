/**
 * Retain the four accepted nineteen-base nominal JVM selections, their independent controls and both
 * uncounted earlier launches.
 *
 * This is a one-shot evidence promotion script. It never rebuilds or executes a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { checkNominalPrimitiveSubtypeJvmControls } from "../tests/helpers/nominal-primitive-subtype-jvm-controls.mjs";
import { inspectNominalPrimitiveSubtypeJvmCiHandoff } from "../tests/helpers/nominal-primitive-subtype-jvm-ci-handoff.mjs";
import {
	nominalPrimitiveSubtypeJvmCheckerPath
	, nominalPrimitiveSubtypeJvmEvidence
	, nominalPrimitiveSubtypeJvmEvidenceCheckers
	, nominalPrimitiveSubtypeJvmEvidenceSources
	, nominalPrimitiveSubtypeJvmPrefix
	, nominalPrimitiveSubtypeJvmPreservedLabel
	, nominalPrimitiveSubtypeJvmPreservedRetained
	, nominalPrimitiveSubtypeJvmRunnerFiles
} from "../tests/helpers/nominal-primitive-subtype-jvm-evidence.mjs";
import { checkNominalPrimitiveSubtypeJvmReport } from "../tests/helpers/nominal-primitive-subtype-jvm-report.mjs";
import { nominalSubtypeJvmGenerator, nominalSubtypeJvmOriginal } from "../tests/helpers/nominal-subtype-jvm-generators.mjs";
import {
	assertNominalPrimitiveSubtypeJvmControlsRun
	, assertNominalPrimitiveSubtypeJvmPreservedLaunch
	, assertNominalPrimitiveSubtypeJvmRun
	, nominalPrimitiveSubtypeJvmAcceptedLaunches
	, nominalPrimitiveSubtypeJvmAcceptedRevision
	, nominalPrimitiveSubtypeJvmLoadCeiling
	, nominalPrimitiveSubtypeJvmPreservedLaunches
	, nominalPrimitiveSubtypeJvmProducer
	, nominalPrimitiveSubtypeJvmSelections
	, nominalPrimitiveSubtypeJvmTools
	, nominalPrimitiveSubtypeJvmWorktreeOf
} from "../tests/helpers/nominal-primitive-subtype-jvm-provenance.mjs";

assert.equal(process.argv.length, 2, "The frozen accepted launches take no arguments");
await assert.rejects(access(nominalPrimitiveSubtypeJvmEvidence), { code: "ENOENT" });
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const files = new Map();
const put = (path, bytes) => { assert.ok(!files.has(path), path); files.set(path, bytes); };

const runners = new Map();
for(const path of nominalPrimitiveSubtypeJvmRunnerFiles())
{
	runners.set(path, await readFile(path)); put("runners/" + basename(path), runners.get(path));
}

const preserved = []; let previousFinish = 0;
for(const launch of nominalPrimitiveSubtypeJvmPreservedLaunches)
{
	const prefix = nominalPrimitiveSubtypeJvmPrefix(launch), label = nominalPrimitiveSubtypeJvmPreservedLabel(launch);
	const retained = nominalPrimitiveSubtypeJvmPreservedRetained(launch), bytes = {};
	for(const name of retained) bytes[name] = await readFile(prefix + "." + (name === "run.tap" ? "tap" : name));
	const start = JSON.parse(bytes["start.json"]), end = JSON.parse(bytes["end.json"]);
	const controlsEnd = bytes["controls.end.json"] ? JSON.parse(bytes["controls.end.json"]) : undefined;
	assertNominalPrimitiveSubtypeJvmPreservedLaunch({
		start, end, tap: bytes["run.tap"], controlsEnd, log: bytes["controls.log"]
		, runners, launch, route: launch.route, mode: launch.mode, prefix });
	assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps an earlier launch`);
	previousFinish = Date.parse((controlsEnd ?? end).finished);
	for(const [name, value] of Object.entries(bytes)) put(`preserved/${label}/${name}`, value);
	preserved.push({
		label, ...launch, prefix
		, worktree: nominalPrimitiveSubtypeJvmWorktreeOf(launch.revision)
		, counted: false
		, classification: launch.controlsCode === null
			? "harness load guard: the installed harness waited five minutes for host load below its default 6 and refused before any author build"
			: "controls runner defect: the producer passed, then the first e0fed7f controls runner asserted a dispatchObserved field that the JVM report result does not carry"
		, started: start.started
		, finished: end.finished
		, retained
		, tapSha256: sha256(bytes["run.tap"]) });
}

const runs = [];
assert.deepEqual(nominalPrimitiveSubtypeJvmAcceptedLaunches.map(item => [item.route, item.mode]), nominalPrimitiveSubtypeJvmSelections);
for(const launch of nominalPrimitiveSubtypeJvmAcceptedLaunches)
{
	const { route, mode, attempt } = launch, label = `${route}-${mode}`, prefix = nominalPrimitiveSubtypeJvmPrefix(launch);
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalPrimitiveSubtypeJvmRun({ start, end, tap, runners, route, mode, prefix });
	assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps an earlier launch`);
	const controlBytes = {};
	for(const name of ["controls.start.json", "controls.json", "controls.end.json", "controls.log"]) controlBytes[name] = await readFile(prefix + "." + name);
	for(const name of ["controls.start.json", "controls.json"])
		assert.equal(controlBytes[name].toString(), canonicalJson(JSON.parse(controlBytes[name])), name);
	const controlsStart = JSON.parse(controlBytes["controls.start.json"]), controls = JSON.parse(controlBytes["controls.json"]);
	const controlsEnd = JSON.parse(controlBytes["controls.end.json"]), root = prefix + `-records/${route}/${mode}`;
	await verifyPackageSetReceipt({ receiptPath: join(root, "handoff/package-set-receipt.json") });
	const original = path => readFile(join(root, path)), handoff = await inspectNominalPrimitiveSubtypeJvmCiHandoff(original, { floor, mode });
	const options = { route, mode, producerCommit: nominalPrimitiveSubtypeJvmProducer, runtime, floor, javaVersion: controls.checked.javaVersion };
	const counts = await checkNominalPrimitiveSubtypeJvmReport(handoff.read, options);
	assert.deepEqual(await nativeArtifactPaths(root), [...counts.records.filter(path => !path.startsWith("package/")), handoff.archivePath].sort());
	const recomputed = await checkNominalPrimitiveSubtypeJvmControls(handoff.read, options);
	assert.equal(recomputed.recordControls, counts.records.length * 2);
	const { controls: ignored, tools, ...ciCounts } = controls.checked; assert.ok(ignored && tools);
	assert.deepEqual(ciCounts, counts);
	assertNominalPrimitiveSubtypeJvmControlsRun({
		start, end, controlsStart, controls, controlsEnd
		, log: controlBytes["controls.log"], route, mode, prefix
		, expected: { ...counts, tools, controls: recomputed } });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) put(`${label}/producer/${name}`, bytes);
	for(const [name, bytes] of Object.entries(controlBytes)) put(`${label}/controls/${name}`, bytes);
	// The complete original JAR stays in the build handoff; its retained package members come from it.
	for(const path of counts.records) put(`${label}/records/${path}`, await handoff.read(path));
	previousFinish = Date.parse(controlsEnd.finished);
	runs.push({
		label, route, mode, attempt, prefix
		, loadCeiling: nominalPrimitiveSubtypeJvmLoadCeiling
		, worktree: nominalPrimitiveSubtypeJvmWorktreeOf(nominalPrimitiveSubtypeJvmProducer)
		, runtime, floor
		, started: start.started
		, finished: end.finished
		, controlsFinished: controlsEnd.finished
		, tapSha256: sha256(tap)
		, reportSha256: sha256(await original("report.json"))
		, archiveSha256: handoff.archiveSha256
		, controls: recomputed
	});
	process.stdout.write(canonicalJson({ label, records: counts.records.length, controls: recomputed }) + "\n");
}

const generatorClosure = (await nominalSubtypeJvmGenerator(nominalPrimitiveSubtypeJvmProducer)).paths;
const selectedSources = [...new Set([...generatorClosure, ...nominalPrimitiveSubtypeJvmEvidenceSources])].sort();
for(const path of selectedSources) put("sources/" + path, nominalSubtypeJvmOriginal(nominalPrimitiveSubtypeJvmProducer, path));
for(const name of nominalPrimitiveSubtypeJvmEvidenceCheckers) put(`checkers/${name}.mjs`, await readFile(nominalPrimitiveSubtypeJvmCheckerPath(name)));

const index = {
	schemaVersion: 1, kind: "nominal-primitive-subtype-jvm-installed-v1"
	, producerCommit: nominalPrimitiveSubtypeJvmProducer
	, loadCeiling: nominalPrimitiveSubtypeJvmLoadCeiling
	, tools: nominalPrimitiveSubtypeJvmTools
	, acceptedRunnerRevision: nominalPrimitiveSubtypeJvmAcceptedRevision
	, runners: nominalPrimitiveSubtypeJvmRunnerFiles().map(path => basename(path))
	, runs
	, preserved
	, selectedSources
	, generatorClosure
	, checkers: nominalPrimitiveSubtypeJvmEvidenceCheckers
	, files: [...files].sort(([left], [right]) => left.localeCompare(right)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, JDK 22.0.2 and Kotlin 2.2.0, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete Maven packages from two author roots, install offline after author removal, and run Java and Kotlin callers after relocation and again from a source-free deployment."
		, "Compile-time API and Kotlin nullability probes check the generated public surface; their records are retained, not their compiler distributions."
		, "All accepted launches ran serially on one CPU with an explicit harness load ceiling of 8 and unchanged disk and memory floors; hosted CI keeps the default ceiling of 6."
		, "Two earlier ordinary/full launches are retained, classified and never counted: a default load-guard refusal before any build, and a passing producer whose first controls runner stopped on a runner defect."
		, "Complete original JARs remain in the build handoffs. This archive retains their identities, the retained package members, execution, probe and control records and selected frozen producer sources."
		, "The shared fixture covers all nineteen admitted primitive bases in acyclic records, variants, aliases, mixed Fin guards and constructor-free results; it does not generalize to every nominal type."
		, "Constructor/source entry counts and memory are unmeasured. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work."
		, "Archived absolute paths record the original host and are not CI prerequisites. This archive does not itself promote support or establish the hosted result."
	]
};
await mkdir(nominalPrimitiveSubtypeJvmEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSubtypeJvmEvidence, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(nominalPrimitiveSubtypeJvmEvidence, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSubtypeJvmEvidence
	, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nominalPrimitiveSubtypeJvmProducer
	, indexSha256: sha256(canonicalJson(index)) }) + "\n");
