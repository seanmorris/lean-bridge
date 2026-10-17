#!/usr/bin/env node
/**
 * Freeze the four hosted inherited checked-record C/C++ selections once.
 *
 * The argument is the downloaded hosted artifact root. This script replays the hosted checker over
 * every selection and copies original bytes; it never rebuilds or executes a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
	access, constants, copyFile, mkdir, readFile, readdir, stat, writeFile
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	assertInheritedCheckedRecordNativeCiTap, checkInheritedCheckedRecordNativeCiRecords
} from "../tests/helpers/inherited-checked-record-native-ci-report.mjs";
import {
	inheritedCheckedRecordNativeRecords
} from "../tests/helpers/inherited-checked-record-native-report.mjs";
import {
	inheritedCheckedRecordNativeChecker, inheritedCheckedRecordNativeEvidence
	, inheritedCheckedRecordNativeEvidenceSources, inheritedCheckedRecordNativeFloor
	, inheritedCheckedRecordNativeHostedRun, inheritedCheckedRecordNativeHostedRuntime
	, inheritedCheckedRecordNativeMaxLoad, inheritedCheckedRecordNativeOriginal
	, inheritedCheckedRecordNativeProducer, inheritedCheckedRecordNativeSelections
} from "../tests/helpers/inherited-checked-record-native-evidence.mjs";

const usage = "Usage: archive-inherited-checked-record-native-evidence.mjs /absolute/hosted-artifact-root";
const artifactRoot = process.argv[2];
assert.ok(process.argv.length === 3 && typeof artifactRoot === "string"
	&& isAbsolute(artifactRoot) && resolve(artifactRoot) === artifactRoot, usage);
assert.match(inheritedCheckedRecordNativeProducer ?? "", /^[a-f0-9]{40}$/u
	, "Pin the inherited native producer first");
assert.ok(Number.isSafeInteger(inheritedCheckedRecordNativeHostedRun.runId)
	, "Pin the green hosted run first");
await assert.rejects(access(inheritedCheckedRecordNativeEvidence), { code: "ENOENT" });
// The archiver revision is the clean tracked tree that runs this script, recorded exactly.
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
	, { stdio: "ignore" }), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(archiveCommit, /^[a-f0-9]{40}$/u);
const revisions = {
	producer: inheritedCheckedRecordNativeProducer
	, checker: inheritedCheckedRecordNativeChecker
	, archiver: archiveCommit
};
const runtime = inheritedCheckedRecordNativeHostedRuntime;
const floor = inheritedCheckedRecordNativeFloor, maxLoad = inheritedCheckedRecordNativeMaxLoad;
const producerCommit = inheritedCheckedRecordNativeProducer;
const hostedRoot = join(artifactRoot, inheritedCheckedRecordNativeHostedRun.root);
const labels = inheritedCheckedRecordNativeSelections.map(({ route, mode }) => `${route}-${mode}`);
assert.deepEqual((await readdir(hostedRoot)).sort(), [...labels].sort()
	, "The hosted root must hold exactly the four selections");

const descriptors = new Map();
const digestFile = path => new Promise((resolveDigest, reject) => {
	const hash = createHash("sha256"), stream = createReadStream(path);
	stream.on("data", chunk => hash.update(chunk));
	stream.on("error", reject);
	stream.on("end", () => resolveDigest(hash.digest("hex")));
});
const putBytes = (path, bytes) => {
	assert.ok(!descriptors.has(path), path);
	const value = Buffer.from(bytes);
	descriptors.set(path, { bytes: value.length, sha256: sha256(value), value });
};
const putFile = async (path, source) => {
	assert.ok(!descriptors.has(path), path);
	const information = await stat(source);
	assert.ok(information.isFile(), source);
	descriptors.set(path, { bytes: information.size, sha256: await digestFile(source), source });
};
const canonical = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

const runs = [];
for(const { route, mode } of inheritedCheckedRecordNativeSelections)
{
	const label = `${route}-${mode}`, cell = join(hostedRoot, label);
	assert.deepEqual((await readdir(cell)).sort(), ["records", "run.tap", "verification.json"], label);
	const recordsRoot = join(cell, "records", route, mode);
	assert.deepEqual(await readdir(join(cell, "records")), [route], label);
	assert.deepEqual(await readdir(join(cell, "records", route)), [mode], label);
	const tapBytes = await readFile(join(cell, "run.tap"));
	assertInheritedCheckedRecordNativeCiTap(tapBytes.toString(), route, mode);
	const receipt = canonical(await readFile(join(recordsRoot, "build-0/package-set-receipt.json")));
	// The producer's own controls record is retained beside the report-defined records.
	const records = [...inheritedCheckedRecordNativeRecords(route, receipt), "controls.json"];
	assert.equal(new Set(records).size, records.length);
	assert.deepEqual(await nativeArtifactPaths(recordsRoot), [...records].sort(), label);
	// Exactly the hosted checker, with the hosted runner's own runtime facts.
	const checked = await checkInheritedCheckedRecordNativeCiRecords({
		route, mode, producer: producerCommit, directory: recordsRoot
		, tap: join(cell, "run.tap"), glibc: floor, "max-load": String(maxLoad)
	}, { tap: tapBytes.toString(), runtime, read: path => readFile(join(recordsRoot, path)) });
	const verificationBytes = await readFile(join(cell, "verification.json"));
	assert.equal(verificationBytes.toString(), canonicalJson(checked)
		, `${label} replay must equal the hosted verification`);
	assert.equal((await readFile(join(recordsRoot, "controls.json"))).toString(), canonicalJson(checked)
		, `${label} replay must equal the producer controls`);
	for(const path of records) await putFile(`${label}/records/${path}`, join(recordsRoot, path));
	putBytes(`${label}/run.tap`, tapBytes);
	putBytes(`${label}/verification.json`, verificationBytes);
	runs.push({
		label, route, mode, recordCount: records.length
		, tapSha256: sha256(tapBytes), verificationSha256: sha256(verificationBytes)
		, reportSha256: sha256(await readFile(join(recordsRoot, "report.json")))
		, controls: {
			record: checked.recordControls, report: checked.reportControls
			, resource: checked.resourceControls, model: checked.modelControls
			, package: checked.packageControls
		}
		, artifacts: receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({
			profile: pkg.target, path: artifact.path
			, bytes: artifact.bytes, sha256: artifact.sha256
		})))
	});
	process.stdout.write(canonicalJson({ label, records: records.length }) + "\n");
}

const selectedSources = inheritedCheckedRecordNativeEvidenceSources(revisions);
for(const { role, revision, path } of selectedSources)
	putBytes(`sources/${role}/${path}`, inheritedCheckedRecordNativeOriginal(revision, path));

const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
	.map(([path, descriptor]) => ({ path, bytes: descriptor.bytes, sha256: descriptor.sha256 }));
const index = {
	schemaVersion: 1, kind: "inherited-checked-record-native-hosted-v1"
	, producerCommit, checkerCommit: revisions.checker, archiveCommit
	, hostedRun: inheritedCheckedRecordNativeHostedRun
	, runtime, floor, maxLoad, runs, selectedSources, files
	, limitations: [
		"Hosted GitHub Linux x64 acceptance with an explicit glibc 2.38 package floor and load ceiling 12."
		, "Four ordinary/reviewed full/result-only selections reproduce complete C and C++ packages from two author roots, install offline after author removal, and replay unchanged independent C11/GMP and C++20 callers after physical relocation."
		, "Parent and child constructors, repeated positions with different constructor selections, nested inheritance, aliases and invalid inner and outer values are exercised; result-only packages erase input-constructor metadata."
		, "Complete original C and C++ archives, receipts, caller sources, execution records, the original TAP, the hosted verification and the exact producer source closure are retained. External compiler and operating-system distributions are not retained."
		, "Other hosts, callbacks and owned positions require separate evidence. This archive does not itself promote support."
	]
};

await mkdir(dirname(inheritedCheckedRecordNativeEvidence), { recursive: true });
await mkdir(inheritedCheckedRecordNativeEvidence);
for(const [path, descriptor] of descriptors)
{
	const target = join(inheritedCheckedRecordNativeEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	if(descriptor.source) await copyFile(descriptor.source, target, constants.COPYFILE_FICLONE);
	else await writeFile(target, descriptor.value, { flag: "wx" });
	assert.equal((await stat(target)).size, descriptor.bytes, path);
	assert.equal(await digestFile(target), descriptor.sha256, path);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(inheritedCheckedRecordNativeEvidence, "index.json"), indexBytes, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: inheritedCheckedRecordNativeEvidence, files: files.length + 1
	, bytes: files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
	, producerCommit, archiveCommit, indexSha256: sha256(indexBytes)
}) + "\n");
