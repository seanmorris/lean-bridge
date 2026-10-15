/**
 * Retain the four accepted primitive-base nominal CPAN selections, their complete original archives,
 * their real control runs, every preserved non-accepted launch and the frozen source closures.
 * This archive does not promote support or claim constructor/source-entry counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { checkNominalPrimitiveSubtypePerlReport, nominalPrimitiveSubtypePerlRecords } from "../tests/helpers/nominal-primitive-subtype-perl-report.mjs";
import { assertNominalPrimitiveSubtypePerlControlsRun, assertNominalPrimitiveSubtypePerlPreservedLaunch, assertNominalPrimitiveSubtypePerlRun, nominalPrimitiveSubtypePerlRunnerVariant, nominalPrimitiveSubtypePerlRunnerVariants, nominalPrimitiveSubtypePerlSelections } from "../tests/helpers/nominal-primitive-subtype-perl-provenance.mjs";
import { nominalSubtypePerlOriginal, nominalSubtypePerlGenerator } from "../tests/helpers/nominal-subtype-perl-generators.mjs";

assert.equal(process.argv.length, 2, "The accepted and preserved launches are fixed; this script takes no arguments");
const destination = "docs/evidence/nominal-primitive-subtype-perl-20261015";
await assert.rejects(access(destination), { code: "ENOENT" });
const build = "/app/build/", runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36";
const prefixOf = (route, mode, attempt, revision) => `${build}vo1493-nominal-primitive-perl-${route}-${mode}-${attempt}-${revision.slice(0, 7)}`;
const revisions = Object.fromEntries(nominalPrimitiveSubtypePerlRunnerVariants.map(item => [item.producerCommit.slice(0, 7), item.producerCommit]));
// Exactly one accepted launch per selection, in execution order, each naming its owner and admitted ceiling.
const accepted = [
	{ route: "ordinary", mode: "full", attempt: "r1", revision: revisions.acc614c, loadCeiling: 6, owner: "Claude" }
	, { route: "ordinary", mode: "result-only", attempt: "r2", revision: revisions.e15acb5, loadCeiling: 8, owner: "Claude" }
	, { route: "reviewed", mode: "full", attempt: "r3", revision: revisions.e15acb5, loadCeiling: 8, owner: "Codex" }
	, { route: "reviewed", mode: "result-only", attempt: "r2", revision: revisions.e15acb5, loadCeiling: 12, owner: "Codex" }
];
assert.deepEqual(accepted.map(item => [item.route, item.mode]), nominalPrimitiveSubtypePerlSelections);
// Every other launch under this task, kept for honesty and never counted as acceptance.
const preserved = [
	{ route: "ordinary", mode: "result-only", attempt: "r1"
		, revision: revisions.acc614c, loadCeiling: 6, owner: "Claude", code: 1
		, reason: "C# producer host load remained at or above 6 for five minutes"
		, classification: "resource-policy failure: host load stayed at or above the default ceiling for five minutes before the 5.38.2 installs" }
	, { route: "reviewed", mode: "full", attempt: "r1"
		, revision: revisions.e15acb5, loadCeiling: 8, owner: "Claude", code: 1
		, reason: "C# producer requires 2 GiB free disk"
		, classification: "resource-policy failure: free disk fell under 2 GiB while a concurrently launched reviewed/full r2 shared the host" }
	, { route: "reviewed", mode: "full", attempt: "r2"
		, revision: revisions.e15acb5, loadCeiling: 8, owner: "Codex", code: 0
		, reason: null
		, classification: "green but launched while reviewed/full r1 was still running; retained as diagnostic evidence only because it violated single-producer serialization" }
	, { route: "reviewed", mode: "result-only", attempt: "r1"
		, revision: revisions.e15acb5, loadCeiling: 8, owner: "Codex", code: 1
		, reason: "C# producer host load remained at or above 8 for five minutes"
		, classification: "resource-policy failure: host load stayed at or above the per-run ceiling of 8 for five minutes after the first author build" }
];
const files = new Map(), runners = new Map();
const put = (path, bytes) => { assert.ok(!files.has(path), path); files.set(path, bytes); };
const runnerBytes = async path => {
	if(!runners.has(path)) runners.set(path, await readFile(path));
	return runners.get(path);
};
for(const variant of nominalPrimitiveSubtypePerlRunnerVariants) for(const path of [variant.producer, variant.controls])
	put("runners/" + basename(path), await runnerBytes(path));
const optional = async path => readFile(path).catch(error => { if(error.code === "ENOENT") return null; throw error; });
const runs = []; let previousFinish = 0;
for(const selection of accepted)
{
	const { route, mode, attempt, revision, loadCeiling, owner } = selection, label = `${route}-${mode}`;
	const variant = nominalPrimitiveSubtypePerlRunnerVariant(revision, loadCeiling), prefix = prefixOf(route, mode, attempt, revision);
	const runner = await runnerBytes(variant.producer), controlsRunner = await runnerBytes(variant.controls);
	const producer = {};
	for(const name of ["start.json", "end.json", "tap"]) producer[name] = await readFile(`${prefix}.${name}`);
	const runnerLog = await optional(`${prefix}.runner.log`);
	const start = JSON.parse(producer["start.json"]), end = JSON.parse(producer["end.json"]), tap = producer.tap;
	assertNominalPrimitiveSubtypePerlRun({ start, end, tap, runner, controlsRunner, route, mode, prefix, producerCommit: revision, floor, variant });
	assert.ok(Date.parse(start.started) >= previousFinish, `${label} started before the previous selection finished`);
	const controlRecords = {};
	for(const name of ["controls.start.json", "controls.json", "controls.end.json", "controls.log"]) controlRecords[name] = await readFile(`${prefix}.${name}`);
	for(const name of ["controls.start.json", "controls.json"]) assert.equal(controlRecords[name].toString(), canonicalJson(JSON.parse(controlRecords[name])), name);
	const controlsStart = JSON.parse(controlRecords["controls.start.json"]), controls = JSON.parse(controlRecords["controls.json"]), controlsEnd = JSON.parse(controlRecords["controls.end.json"]);
	const root = `${prefix}-records/${route}/${mode}`;
	const receipt = JSON.parse(await readFile(join(root, "build-0/package-set-receipt.json")));
	const records = nominalPrimitiveSubtypePerlRecords(route, receipt);
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...records].sort());
	const checked = await checkNominalPrimitiveSubtypePerlReport(path => readFile(join(root, path)), { route, mode, producerCommit: revision, runtime, floor });
	const expectedControls = { executions: 16, recordControls: checked.records * 2, packageControls: 48, handoffControls: 4, modelControls: mode === "full" ? 43 : 24 };
	assertNominalPrimitiveSubtypePerlControlsRun({ start, end, controlsStart, controls, controlsEnd, log: controlRecords["controls.log"], route, mode, prefix, producerCommit: revision, variant, expected: expectedControls });
	assert.deepEqual(controls.checked, { ...checked, ...expectedControls });
	for(const [name, bytes] of [["start.json", producer["start.json"]], ["end.json", producer["end.json"]], ["run.tap", tap]]) put(`${label}/producer/${name}`, bytes);
	if(runnerLog) put(`${label}/producer/runner.log`, runnerLog);
	for(const [name, bytes] of Object.entries(controlRecords)) put(`${label}/controls/${name}`, bytes);
	for(const path of records) put(`${label}/records/${path}`, await readFile(join(root, path)));
	previousFinish = Date.parse(controlsEnd.finished);
	runs.push({ label, route, mode, attempt, owner, prefix, loadCeiling
		, worktree: variant.worktree
		, runner: { producer: basename(variant.producer), controls: basename(variant.controls) }
		, runnerLog: runnerLog !== null
		, started: start.started, finished: end.finished
		, controlsFinished: controlsEnd.finished
		, ...checked
		, controls: { recordControls: expectedControls.recordControls, packageControls: 48, handoffControls: 4, modelControls: expectedControls.modelControls }
		, tapSha256: sha256(tap)
		, reportSha256: sha256(await readFile(join(root, "report.json"))) });
}
const failures = [];
for(const launch of preserved)
{
	const { route, mode, attempt, revision, loadCeiling, owner, code, reason, classification } = launch, label = `${route}-${mode}-${attempt}`;
	const variant = nominalPrimitiveSubtypePerlRunnerVariant(revision, loadCeiling), prefix = prefixOf(route, mode, attempt, revision);
	const runner = await runnerBytes(variant.producer), controlsRunner = await runnerBytes(variant.controls);
	const startBytes = await readFile(`${prefix}.start.json`), endBytes = await readFile(`${prefix}.end.json`), tap = await readFile(`${prefix}.tap`);
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalPrimitiveSubtypePerlPreservedLaunch({ start, end, tap, runner, controlsRunner, route, mode, prefix, producerCommit: revision, floor, variant, code, reason });
	const retained = ["start.json", "end.json", "run.tap"];
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) put(`preserved/${label}/${name}`, bytes);
	for(const name of ["runner.log", "controls.start.json", "controls.json", "controls.end.json", "controls.log"])
	{
		const bytes = await optional(`${prefix}.${name}`);
		if(bytes === null) continue;
		put(`preserved/${label}/${name}`, bytes); retained.push(name);
	}
	assert.equal(retained.includes("controls.json"), code === 0, `${label}: controls run only after a green producer`);
	failures.push({ label, route, mode, attempt, owner, prefix
		, producerCommit: revision, loadCeiling, counted: false
		, runner: { producer: basename(variant.producer), controls: basename(variant.controls) }
		, started: start.started, finished: end.finished
		, code, reason, classification, retained
		, tapSha256: sha256(tap), startSha256: sha256(startBytes)
		, endSha256: sha256(endBytes) });
}
const producerCommits = [...new Set(accepted.map(item => item.revision))];
assert.deepEqual(producerCommits, [revisions.acc614c, revisions.e15acb5]);
const closures = {};
for(const revision of producerCommits) closures[revision] = (await nominalSubtypePerlGenerator(revision)).paths;
assert.deepEqual(closures[revisions.acc614c], closures[revisions.e15acb5]);
const closure = closures[revisions.e15acb5];
const selectedSources = [...new Set([
	...closure, "src/analyze/NativeExports.lean", "src/build/native-component.mjs"
	, "src/build/cpan-projection.mjs", "src/build/perl-xs.mjs"
	, ...["Build.pm", "Runtime.pm", "Runtime.xs", "runtime.h"].map(path => `src/backends/perl/${path}`)
	, ...["cpan-package.mjs", "cpan-install.mjs", "cpan-install-trace.mjs"].map(path => `src/release/${path}`)
	, "tests/helpers/nominal-primitive-subtype-fixture.mjs"
	, ...["fixture.mjs", "install.mjs", "installed-tests.mjs", "tests.mjs", "model.pl", "handoff.mjs", "report.mjs", "model-records.mjs", "package-records.mjs", "controls.mjs", "ci-report.mjs"].map(path => `tests/helpers/nominal-primitive-subtype-perl-${path}`)
	, "tests/helpers/nominal-subtype-perl-generators.mjs"
	, "tests/helpers/closed-package-tar.mjs"
	, "tests/helpers/checked-record-perl-install.mjs"
	, "tests/helpers/nominal-subtype-dotnet-resources.mjs"
	, "tests/helpers/copied-fixture-install.mjs", "tests/helpers/package-set.mjs"
	, "tests/helpers/lake-workspace.mjs"
	, "tests/fixtures/nominal-primitive-subtype-consumers/perl.pl"
	, ...["NominalPrimitiveSubtypes.lean", "lakefile.toml", "lean-toolchain", "package.json", "LICENSE"].map(path => `tests/fixtures/onboarding/nominal-primitive-subtypes/${path}`)
])].sort();
const sourceDifferences = [];
for(const path of selectedSources)
{
	const bytes = producerCommits.map(revision => nominalSubtypePerlOriginal(revision, path));
	for(const [position, revision] of producerCommits.entries()) put(`sources/${revision}/${path}`, bytes[position]);
	if(!bytes[0].equals(bytes[1])) sourceDifferences.push(path);
}
const checkers = ["report", "model-records", "package-records", "handoff", "controls", "ci-report", "provenance"];
for(const name of checkers) put(`checkers/${name}.mjs`, await readFile(`tests/helpers/nominal-primitive-subtype-perl-${name}.mjs`));
put("checkers/generators.mjs", await readFile("tests/helpers/nominal-subtype-perl-generators.mjs"));
put("checkers/closed-package-tar.mjs", await readFile("tests/helpers/closed-package-tar.mjs"));
const index = {
	schemaVersion: 1, kind: "nominal-primitive-subtype-perl-installed-v1"
	, producerCommits, runs, preserved: failures
	, runnerVariants: nominalPrimitiveSubtypePerlRunnerVariants.map(item => ({ ...item, producer: basename(item.producer), controls: basename(item.controls) }))
	, selectedSources, sourceDifferences, generatorClosure: closure
	, checkers: [...checkers, "generators", "closed-package-tar"]
	, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: ["Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, not hosted release-floor acceptance."
		, "Only the shared nineteen-base nominal fixture: ordinary/reviewed full and result-only CPAN packages on the four pinned Perl ABIs with prebuilt-only and build-xs deliveries."
		, "The four accepted selections ran serially on one CPU under two frozen source revisions: ordinary/full at acc614c before the bounded per-run load ceiling existed, the other three at e15acb5, which only merges the Core quality budget and adds that ceiling option. Every selected source is retained at both revisions and the two differing paths are listed."
		, "Per-run admission ceilings of 6, 8, 8 and 12 are recorded in each launch; the hosted and default ceiling remains 6 and the disk and memory floors never changed."
		, "Four other launches are preserved and never counted: three resource-policy failures and one green run that violated single-producer serialization."
		, "The caller's check counts equal the Python caller's counts; that equality is a consistency check between callers, not evidence borrowed from Python."
		, "No Perl constructor/source entry counts or memory measurement."
		, "Original CPAN archives, receipts, package hashes, execution and control records and the complete producer JavaScript generator closure are retained; toolchain closures are not."
		, "This archive does not promote support or establish recurring installed CI gates."]
};
await mkdir(destination);
for(const [path, bytes] of files)
{
	const target = join(destination, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(destination, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({ destination, files: files.size, producerCommits, sourceDifferences, indexSha256: sha256(canonicalJson(index)) }) + "\n");
