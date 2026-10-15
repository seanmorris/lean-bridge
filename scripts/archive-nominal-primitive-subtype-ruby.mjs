/**
 * Retain the four accepted primitive-base nominal Ruby selections and the honest failed launch.
 *
 * This is a one-shot evidence promotion script. It never rebuilds or executes a gem.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { nominalPrimitiveSubtypeRubyEvidence, nominalPrimitiveSubtypeRubyEvidenceCheckers, nominalPrimitiveSubtypeRubyEvidenceSources } from "../tests/helpers/nominal-primitive-subtype-ruby-evidence.mjs";
import { checkNominalPrimitiveSubtypeRubyControls } from "../tests/helpers/nominal-primitive-subtype-ruby-controls.mjs";
import { checkNominalPrimitiveSubtypeRubyReport, nominalPrimitiveSubtypeRubyRecords } from "../tests/helpers/nominal-primitive-subtype-ruby-report.mjs";
import { nominalSubtypeRubyGenerator, nominalSubtypeRubyOriginal } from "../tests/helpers/nominal-subtype-ruby-generators.mjs";
import {
	assertNominalPrimitiveSubtypeRubyControlsRun
	, assertNominalPrimitiveSubtypeRubyPreservedLaunch
	, assertNominalPrimitiveSubtypeRubyRun
	, nominalPrimitiveSubtypeRubyAcceptedLaunches
	, nominalPrimitiveSubtypeRubyControlsRunner
	, nominalPrimitiveSubtypeRubyLoadCeiling
	, nominalPrimitiveSubtypeRubyPreservedLaunches
	, nominalPrimitiveSubtypeRubyProducer
	, nominalPrimitiveSubtypeRubyRunner
	, nominalPrimitiveSubtypeRubySelections
	, nominalPrimitiveSubtypeRubyWorktree
} from "../tests/helpers/nominal-primitive-subtype-ruby-provenance.mjs";

assert.equal(process.argv.length, 2, "The frozen accepted and preserved launches take no arguments");
await assert.rejects(access(nominalPrimitiveSubtypeRubyEvidence), { code: "ENOENT" });
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" }, floor = "2.36", rubyVersion = "3.3.12";
const prefixOf = ({ route, mode, attempt }) => `/app/build/vo1492-nominal-primitive-ruby-${route}-${mode}-${attempt}-aaadc4f`;
const files = new Map();
const put = (path, bytes) => { assert.ok(!files.has(path), path); files.set(path, bytes); };

const runnerBytes = await readFile(nominalPrimitiveSubtypeRubyRunner);
const controlsRunnerBytes = await readFile(nominalPrimitiveSubtypeRubyControlsRunner);
put("runners/" + basename(nominalPrimitiveSubtypeRubyRunner), runnerBytes);
put("runners/" + basename(nominalPrimitiveSubtypeRubyControlsRunner), controlsRunnerBytes);

const runs = []; let previousFinish = 0;
assert.deepEqual(nominalPrimitiveSubtypeRubyAcceptedLaunches.map(item => [item.route, item.mode]), nominalPrimitiveSubtypeRubySelections);
for(const launch of nominalPrimitiveSubtypeRubyAcceptedLaunches)
{
	const { route, mode, attempt } = launch, label = `${route}-${mode}`, prefix = prefixOf(launch);
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalPrimitiveSubtypeRubyRun({ start, end, tap, runner: runnerBytes, controlsRunner: controlsRunnerBytes, route, mode, prefix });
	assert.ok(Date.parse(start.started) >= previousFinish, `${label} overlaps the prior accepted selection`);
	const controlBytes = {};
	for(const name of ["controls.start.json", "controls.json", "controls.end.json", "controls.log"]) controlBytes[name] = await readFile(prefix + "." + name);
	for(const name of ["controls.start.json", "controls.json"])
		assert.equal(controlBytes[name].toString(), canonicalJson(JSON.parse(controlBytes[name])), name);
	const controlsStart = JSON.parse(controlBytes["controls.start.json"]), controls = JSON.parse(controlBytes["controls.json"]);
	const controlsEnd = JSON.parse(controlBytes["controls.end.json"]), root = prefix + `-records/${route}/${mode}`;
	const gem = JSON.parse(await readFile(join(root, "gem.json"))), records = nominalPrimitiveSubtypeRubyRecords(route, gem);
	assert.deepEqual((await nativeArtifactPaths(root)).sort(), [...records].sort());
	const read = path => readFile(join(root, path));
	const counts = await checkNominalPrimitiveSubtypeRubyReport(read, { route, mode, producerCommit: nominalPrimitiveSubtypeRubyProducer, runtime, floor, rubyVersion });
	const controlled = await checkNominalPrimitiveSubtypeRubyControls(read, { route, mode, producerCommit: nominalPrimitiveSubtypeRubyProducer, runtime, floor, rubyVersion });
	const expected = {
		...counts
		, recordControls: records.length * 2
		, environmentControls: 12
		, packageControls: 4
		, modelControls: mode === "full" ? 42 : 23
		, executionControls: 20
	};
	assert.deepEqual(controlled, expected);
	assertNominalPrimitiveSubtypeRubyControlsRun({
		start, end, controlsStart, controls, controlsEnd
		, log: controlBytes["controls.log"]
		, route, mode, prefix, expected });
	for(const [name, bytes] of [["start.json", startBytes], ["end.json", endBytes], ["run.tap", tap]]) put(`${label}/producer/${name}`, bytes);
	for(const [name, bytes] of Object.entries(controlBytes)) put(`${label}/controls/${name}`, bytes);
	for(const path of records) put(`${label}/records/${path}`, await readFile(join(root, path)));
	previousFinish = Date.parse(controlsEnd.finished);
	runs.push({
		label, route, mode, attempt, prefix
		, loadCeiling: nominalPrimitiveSubtypeRubyLoadCeiling
		, worktree: nominalPrimitiveSubtypeRubyWorktree
		, runtime
		, floor
		, rubyVersion
		, started: start.started
		, finished: end.finished
		, controlsFinished: controlsEnd.finished
		, tapSha256: sha256(tap)
		, reportSha256: sha256(await readFile(join(root, "report.json")))
		, counts
		, controls: {
			recordControls: expected.recordControls
			, environmentControls: 12
			, packageControls: 4
			, modelControls: expected.modelControls
			, executionControls: 20
		}
	});
}

const preserved = [];
for(const launch of nominalPrimitiveSubtypeRubyPreservedLaunches)
{
	const prefix = prefixOf(launch), label = `${launch.route}-${launch.mode}-${launch.attempt}`;
	const startBytes = await readFile(prefix + ".start.json"), endBytes = await readFile(prefix + ".end.json"), tap = await readFile(prefix + ".tap");
	const start = JSON.parse(startBytes), end = JSON.parse(endBytes);
	assertNominalPrimitiveSubtypeRubyPreservedLaunch({
		start, end, tap
		, runner: runnerBytes
		, controlsRunner: controlsRunnerBytes
		, route: launch.route, mode: launch.mode, prefix });
	const retained = ["start.json", "end.json", "run.tap", "failed-inputs.tar.gz", "failed-inputs.sha256", "failed-inputs.list"];
	for(const [name, bytes] of [
		["start.json", startBytes]
		, ["end.json", endBytes]
		, ["run.tap", tap]
		, ["failed-inputs.tar.gz", await readFile("build/vo1492-ruby-ordinary-full-r1-aaadc4f-retained-failed-inputs.tar.gz")]
		, ["failed-inputs.sha256", await readFile("build/vo1492-ruby-ordinary-full-r1-aaadc4f-retained-failed-inputs.sha256")]
		, ["failed-inputs.list", await readFile("build/vo1492-ruby-ordinary-full-r1-aaadc4f-retained-failed-inputs.list")]])
		put(`preserved/${label}/${name}`, bytes);
	preserved.push({
		label, ...launch, prefix
		, counted: false
		, classification: "resource-policy disk-floor failure: concurrent archive work drove free disk through the unchanged 768 MiB live floor"
		, started: start.started
		, finished: end.finished
		, retained
		, tapSha256: sha256(tap)
		, startSha256: sha256(startBytes)
		, endSha256: sha256(endBytes) });
}

const generatorClosure = (await nominalSubtypeRubyGenerator(nominalPrimitiveSubtypeRubyProducer)).paths;
const selectedSources = [...new Set([...generatorClosure, ...nominalPrimitiveSubtypeRubyEvidenceSources])].sort();
for(const path of selectedSources) put("sources/" + path, nominalSubtypeRubyOriginal(nominalPrimitiveSubtypeRubyProducer, path));
for(const name of nominalPrimitiveSubtypeRubyEvidenceCheckers)
{
	const path = name === "generators" ? "tests/helpers/nominal-subtype-ruby-generators.mjs"
		: `tests/helpers/nominal-primitive-subtype-ruby-${name}.mjs`;
	put(`checkers/${name}.mjs`, await readFile(path));
}

const index = {
	schemaVersion: 1, kind: "nominal-primitive-subtype-ruby-installed-v1"
	, producerCommit: nominalPrimitiveSubtypeRubyProducer
	, loadCeiling: nominalPrimitiveSubtypeRubyLoadCeiling
	, runner: { producer: basename(nominalPrimitiveSubtypeRubyRunner), controls: basename(nominalPrimitiveSubtypeRubyControlsRunner) }
	, runs
	, preserved
	, selectedSources
	, generatorClosure
	, checkers: nominalPrimitiveSubtypeRubyEvidenceCheckers
	, files: [...files].sort(([left], [right]) => left.localeCompare(right)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete RubyGems from two author roots, install offline after author removal and replay after moving the installed tree on MRI Ruby 3.3.12."
		, "All accepted launches ran serially on one CPU with a per-run admission ceiling of 8; hosted and default acceptance remains at 6, and the disk and memory floors remain unchanged."
		, "The earlier ordinary/full launch that hit the live disk floor is retained, classified and never counted as acceptance."
		, "Complete original gems, package receipts, payload identities, execution and control records, the failed input archive and selected frozen producer sources are retained; external toolchain binaries are not."
		, "The shared fixture covers all nineteen admitted primitive bases in acyclic records, variants, aliases, mixed Fin guards and constructor-free results; it does not generalize to every nominal type."
		, "Constructor/source entry counts and memory are unmeasured. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work."
		, "Archived absolute paths record the original host and are not CI prerequisites. This archive does not itself promote support or establish the hosted result."
	]
};
await mkdir(nominalPrimitiveSubtypeRubyEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSubtypeRubyEvidence, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
await writeFile(join(nominalPrimitiveSubtypeRubyEvidence, "index.json"), canonicalJson(index), { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSubtypeRubyEvidence
	, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nominalPrimitiveSubtypeRubyProducer
	, indexSha256: sha256(canonicalJson(index)) }) + "\n");
