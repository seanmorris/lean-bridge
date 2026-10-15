/**
 * Retain the four accepted primitive-base nominal Rust selections and the
 * interrupted pre-fix launch. This script never rebuilds or executes a crate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { assertNominalPrimitiveSubtypeRustCiTap } from "../tests/helpers/nominal-primitive-subtype-rust-ci-report.mjs";
import { checkNominalPrimitiveSubtypeRustControls } from "../tests/helpers/nominal-primitive-subtype-rust-controls.mjs";
import { checkNominalPrimitiveSubtypeRustReport, nominalPrimitiveSubtypeRustRecords } from "../tests/helpers/nominal-primitive-subtype-rust-report.mjs";
import {
	nominalPrimitiveSubtypeRustAcceptedLaunches
	, nominalPrimitiveSubtypeRustEvidence
	, nominalPrimitiveSubtypeRustEvidenceSources
	, nominalPrimitiveSubtypeRustInterruptedPaths
	, nominalPrimitiveSubtypeRustInterruptedProducer
	, nominalPrimitiveSubtypeRustLaunchPaths
	, nominalPrimitiveSubtypeRustLoadCeiling
	, nominalPrimitiveSubtypeRustOriginal
	, nominalPrimitiveSubtypeRustPreservedLaunches
	, nominalPrimitiveSubtypeRustProducer
	, nominalPrimitiveSubtypeRustSelections
	, nominalPrimitiveSubtypeRustWorktree
} from "../tests/helpers/nominal-primitive-subtype-rust-provenance.mjs";

assert.equal(process.argv.length, 2, "The frozen accepted and interrupted launches take no arguments");
await assert.rejects(access(nominalPrimitiveSubtypeRustEvidence), { code: "ENOENT" });
const files = new Map();
const put = (path, bytes) => { assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes)); };
const parseCanonical = bytes => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value)); return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};

const runs = [];
assert.deepEqual(nominalPrimitiveSubtypeRustAcceptedLaunches.map(item => [item.route, item.mode]), nominalPrimitiveSubtypeRustSelections);
for(const launch of nominalPrimitiveSubtypeRustAcceptedLaunches)
{
	const { route, mode, attempt } = launch, label = `${route}-${mode}`, origin = nominalPrimitiveSubtypeRustLaunchPaths(launch);
	const tap = await readFile(origin.tap), verificationBytes = await readFile(origin.verification), verification = parseCanonical(verificationBytes);
	assertNominalPrimitiveSubtypeRustCiTap(tap.toString(), route, mode);
	assert.equal(verification.producerCommit, nominalPrimitiveSubtypeRustProducer);
	assert.equal(verification.route, route); assert.equal(verification.mode, mode);
	assert.equal(verification.floor, "2.36"); assert.deepEqual(verification.runtime, { platform: "linux", arch: "x64", glibc: "2.36" });
	const crate = parseCanonical(await readFile(join(origin.records, "crate.json")));
	const dependencies = parseCanonical(await readFile(join(origin.records, "dependencies.json")));
	const records = nominalPrimitiveSubtypeRustRecords(route, crate, dependencies);
	assert.deepEqual((await nativeArtifactPaths(origin.records)).sort(), [...records].sort());
	const read = path => readFile(join(origin.records, path));
	const options = { route
		, mode
		, producerCommit: nominalPrimitiveSubtypeRustProducer
		, runtime: verification.runtime
		, floor: verification.floor
		, toolchain: verification.toolchain };
	const checked = await checkNominalPrimitiveSubtypeRustReport(read, options);
	assert.deepEqual(verification, checked);
	const controlled = await checkNominalPrimitiveSubtypeRustControls(read, options);
	assert.deepEqual(controlled, {
		...checked
		, recordControls: records.length * 2
		, environmentControls: mode === "full" ? 60 : 61
		, packageControls: 6
		, modelControls: mode === "full" ? 42 : 23
		, executionControls: 30
	});
	put(`${label}/producer/run.tap`, tap); put(`${label}/producer/verification.json`, verificationBytes);
	for(const path of records) put(`${label}/records/${path}`, await readFile(join(origin.records, path)));
	runs.push({
		label, route, mode, attempt, origin
		, producerCommit: nominalPrimitiveSubtypeRustProducer
		, worktree: nominalPrimitiveSubtypeRustWorktree
		, loadCeiling: nominalPrimitiveSubtypeRustLoadCeiling
		, durationMs: duration(tap)
		, tapSha256: sha256(tap)
		, verificationSha256: sha256(verificationBytes)
		, reportSha256: sha256(await readFile(join(origin.records, "report.json")))
		, runtime: verification.runtime, floor: verification.floor
		, toolchain: verification.toolchain
		, counts: verification.counts
		, executions: verification.executions
		, dispatchObserved: verification.dispatchObserved
		, generatorModules: verification.generatorModules
		, records: verification.records
		, controls: {
			recordControls: controlled.recordControls
			, environmentControls: controlled.environmentControls
			, packageControls: controlled.packageControls
			, modelControls: controlled.modelControls
			, executionControls: controlled.executionControls
		}
	});
}

assert.deepEqual(nominalPrimitiveSubtypeRustPreservedLaunches, [{ route: "ordinary", mode: "full", attempt: "r1", producerCommit: nominalPrimitiveSubtypeRustInterruptedProducer }]);
const interruptedTap = await readFile(nominalPrimitiveSubtypeRustInterruptedPaths.tap);
assert.match(interruptedTap.toString(), /^TAP version 13\n# Waiting for host load below 8[^]*# Waiting for host load below 6/u);
assert.doesNotMatch(interruptedTap.toString(), /^(?:ok|not ok) /mu);
const partialRecords = await nativeArtifactPaths(nominalPrimitiveSubtypeRustInterruptedPaths.records);
assert.ok(partialRecords.length > 0); assert.ok(partialRecords.includes("handoff/archives/nominalprimitivesubtypes-1.0.0.crate"));
assert.ok(partialRecords.includes("build-0/model.json") && partialRecords.includes("build-1/model.json"));
assert.ok(!partialRecords.includes("report.json") && !partialRecords.includes("installation.json"));
put("preserved/ordinary-full-r1/run.tap", interruptedTap);
for(const path of partialRecords)
	put(`preserved/ordinary-full-r1/records/${path}`, await readFile(join(nominalPrimitiveSubtypeRustInterruptedPaths.records, path)));
const fixPaths = [
	"tests/helpers/nominal-primitive-subtype-rust-install-policy-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-install.mjs"
	, "tests/helpers/nominal-primitive-subtype-rust-installed-tests.mjs"
];
const fixPatch = execFileSync("git", ["diff", `${nominalPrimitiveSubtypeRustInterruptedProducer}..${nominalPrimitiveSubtypeRustProducer}`, "--", ...fixPaths]);
assert.ok(fixPatch.length > 0); put("preserved/ordinary-full-r1/fix.patch", fixPatch);
for(const path of fixPaths)
	put(`preserved/ordinary-full-r1/predecessor/${path}`, nominalPrimitiveSubtypeRustOriginal(nominalPrimitiveSubtypeRustInterruptedProducer, path));
const preserved = [{
	label: "ordinary-full-r1", route: "ordinary", mode: "full", attempt: "r1"
	, producerCommit: nominalPrimitiveSubtypeRustInterruptedProducer
	, replacementCommit: nominalPrimitiveSubtypeRustProducer
	, origin: nominalPrimitiveSubtypeRustInterruptedPaths
	, counted: false
	, classification: "operator-interrupted after both author builds exposed that the offline installer reset the selected load ceiling from 8 to 6"
	, tapSha256: sha256(interruptedTap)
	, records: partialRecords
	, fixPaths
	, fixPatchSha256: sha256(fixPatch)
}];

const selectedSources = await nominalPrimitiveSubtypeRustEvidenceSources();
for(const path of selectedSources)
	put("sources/" + path, nominalPrimitiveSubtypeRustOriginal(nominalPrimitiveSubtypeRustProducer, path));

const index = {
	schemaVersion: 1, kind: "nominal-primitive-subtype-rust-installed-v1"
	, producerCommit: nominalPrimitiveSubtypeRustProducer
	, interruptedProducerCommit: nominalPrimitiveSubtypeRustInterruptedProducer
	, loadCeiling: nominalPrimitiveSubtypeRustLoadCeiling
	, worktree: nominalPrimitiveSubtypeRustWorktree
	, runs, preserved, selectedSources
	, files: [...files].sort(([left], [right]) => left.localeCompare(right)).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete crates from two author roots, remove author sources, install with fourteen authenticated offline dependencies, replay after relocation and execute again after deleting all consumer sources."
		, "Every accepted selection executes the unchanged independent caller three times. Full mode checks 1,332 cases with 306 expected refusals; result-only checks 601 cases with no input-constructor API."
		, "Accepted launches used one build job and a local admission ceiling of 8. Disk and memory floors remained 2 GiB. Hosted CI rejects the override and retains its default ceiling."
		, "The interrupted ordinary/full r1 launch is retained and never counted. Its partial records and exact fix patch show the load-ceiling propagation defect; its private temporary consumer tree is not part of this archive."
		, "Complete original crates, dependency handoffs, package receipts, execution records, TAP, independent verification output and the exact producer source closure are retained. External toolchain binaries are represented by size, digest and version output, not copied."
		, "The fixture covers all nineteen admitted primitive bases in acyclic records, variants, aliases, mixed Fin guards and constructor-free results. It does not generalize to every nominal type."
		, "Constructor/source entry counts and memory are unmeasured. Refined callbacks, owned, recursive, dependent and broader generic Subtypes remain separate work. This archive does not itself promote support or establish hosted acceptance."
	]
};

await mkdir(nominalPrimitiveSubtypeRustEvidence);
for(const [path, bytes] of files)
{
	const target = join(nominalPrimitiveSubtypeRustEvidence, path); await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" }); assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nominalPrimitiveSubtypeRustEvidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nominalPrimitiveSubtypeRustEvidence
	, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nominalPrimitiveSubtypeRustProducer
	, indexSha256: sha256(indexBytes)
}) + "\n");
