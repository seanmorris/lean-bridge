#!/usr/bin/env node
/**
 * Freeze the four accepted nested checked-record C/C++ selections once.
 *
 * This script validates existing records and copies them. It never rebuilds or executes a package.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
	access, constants, copyFile, mkdir, readFile, stat, writeFile
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import {
	checkNestedCheckedRecordNativeControls
} from "../tests/helpers/nested-checked-record-native-controls.mjs";
import {
	nestedCheckedRecordNativeRecords
} from "../tests/helpers/nested-checked-record-native-report.mjs";
import {
	nestedCheckedRecordNativeEvidence
	, nestedCheckedRecordNativeOriginal
	, nestedCheckedRecordNativeProducer
	, nestedCheckedRecordNativeSelectedSources
	, nestedCheckedRecordNativeSelections
} from "../tests/helpers/nested-checked-record-native-evidence.mjs";

assert.equal(process.argv.length, 2, "The frozen native archive takes no arguments");
await assert.rejects(access(nestedCheckedRecordNativeEvidence), { code: "ENOENT" });
assert.doesNotThrow(() => execFileSync("git", ["diff", "--quiet", "HEAD", "--"]
	, { stdio: "ignore" }), "Archive generation requires a clean tracked source tree");
const archiveCommit = execFileSync("git", ["rev-parse", "HEAD"]
	, { encoding: "utf8" }).trim();
const runtime = { platform: "linux", arch: "x64", glibc: "2.36" };
const floor = "2.36", maxLoad = 12;
const descriptors = new Map();
const digestFile = path => new Promise((resolve, reject) => {
	const hash = createHash("sha256"), stream = createReadStream(path);
	stream.on("data", chunk => hash.update(chunk));
	stream.on("error", reject);
	stream.on("end", () => resolve(hash.digest("hex")));
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
	descriptors.set(path, {
		bytes: information.size, sha256: await digestFile(source), source
	});
};
const canonical = bytes => {
	const value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value));
	return value;
};

const runs = [];
for(const selection of nestedCheckedRecordNativeSelections)
{
	const { route, mode, root } = selection, label = `${route}-${mode}`;
	const receipt = canonical(await readFile(join(root
		, "build-0/package-set-receipt.json")));
	const records = [...nestedCheckedRecordNativeRecords(route, receipt), "controls.json"];
	assert.equal(new Set(records).size, records.length);
	assert.deepEqual(await nativeArtifactPaths(root), [...records].sort());
	const options = {
		route, mode, producerCommit: nestedCheckedRecordNativeProducer
		, runtime, floor, maxLoad
	};
	const read = path => readFile(join(root, path));
	const checked = await checkNestedCheckedRecordNativeControls(read, options);
	const controlsBytes = await read("controls.json"), controls = canonical(controlsBytes);
	assert.deepEqual(controls, checked);
	for(const path of records) await putFile(`${label}/records/${path}`, join(root, path));
	const reportBytes = await read("report.json");
	runs.push({
		label, route, mode, originalRoot: root
		, producerCommit: nestedCheckedRecordNativeProducer, runtime, floor, maxLoad
		, recordCount: records.length
		, reportSha256: sha256(reportBytes), controlsSha256: sha256(controlsBytes)
		, counts: checked.counts
		, executions: checked.executions, initialExecutions: checked.initialExecutions
		, controls: {
			record: checked.recordControls, report: checked.reportControls
			, resource: checked.resourceControls, model: checked.modelControls
			, package: checked.packageControls
		}
		, artifacts: receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => ({
			profile: pkg.target, path: artifact.path, bytes: artifact.bytes
			, sha256: artifact.sha256
		})))
	});
	process.stdout.write(canonicalJson({ label, records: records.length
		, counts: checked.counts }) + "\n");
}

const selectedSources = nestedCheckedRecordNativeSelectedSources();
for(const path of selectedSources)
	putBytes(`sources/producer/${path}`, nestedCheckedRecordNativeOriginal(path));
const archiveSources = [
	"scripts/archive-nested-checked-record-native.mjs"
	, "tests/helpers/nested-checked-record-native-evidence.mjs"
];
for(const path of archiveSources)
	putBytes(`sources/archive/${path}`, execFileSync("git", ["show", `${archiveCommit}:${path}`]
		, { maxBuffer: 64 * 1024 * 1024 }));

const files = [...descriptors].sort(([left], [right]) => left.localeCompare(right))
	.map(([path, descriptor]) => ({ path, bytes: descriptor.bytes
		, sha256: descriptor.sha256 }));
const index = {
	schemaVersion: 1, kind: "nested-checked-record-native-installed-v1"
	, producerCommit: nestedCheckedRecordNativeProducer, archiveCommit
	, runtime, floor, maxLoad, runs, selectedSources, archiveSources
	, files
	, limitations: [
		"Local Linux x64/glibc 2.36 acceptance with an explicit 2.36 package floor, not hosted release-floor acceptance."
		, "Four ordinary/reviewed full/result-only selections reproduce complete C and C++ packages from two author roots, install offline after author removal, and replay unchanged independent callers after physical relocation."
		, "The full API covers nested Fin and checked Subtype fields through arrays, lists, options, products, Except branches, an enclosing record and the active variant branch. Result-only packages project Array and Option values without input-constructor metadata."
		, "Exact rejection, recovery and unchanged-caller snapshots are retained. Constructor/source entry counts and peak memory are not measured."
		, "Complete original C and C++ archives, receipts, compiler identities, caller sources, execution records, destructive controls and the exact producer source closure are retained. External compiler and operating-system distributions are not retained."
		, "Generic, recursive and inherited checked records, open dependent or zero-payload records, callbacks and owned positions remain outside this acceptance. Other hosts require separate evidence."
		, "Archived build paths describe the original host and are not CI prerequisites. This archive does not itself promote support or establish a hosted result."
	]
};

await mkdir(nestedCheckedRecordNativeEvidence);
for(const [path, descriptor] of descriptors)
{
	const target = join(nestedCheckedRecordNativeEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	if(descriptor.source) await copyFile(descriptor.source, target, constants.COPYFILE_FICLONE);
	else await writeFile(target, descriptor.value, { flag: "wx" });
	const information = await stat(target);
	assert.equal(information.size, descriptor.bytes, path);
	assert.equal(await digestFile(target), descriptor.sha256, path);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nestedCheckedRecordNativeEvidence, "index.json"), indexBytes
	, { flag: "wx" });
process.stdout.write(canonicalJson({
	destination: nestedCheckedRecordNativeEvidence, files: files.length + 1
	, bytes: files.reduce((sum, file) => sum + file.bytes, indexBytes.length)
	, producerCommit: nestedCheckedRecordNativeProducer, archiveCommit
	, indexSha256: sha256(indexBytes)
}) + "\n");
