/**
 * Index the common function-specialization reports already retained in the successful ff71335 ZIPs.
 * Preserve both earlier archives and reuse their authenticated source snapshots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { assertHostedArrayArchive, hostedArrayDirectory, hostedArrayReceiptSha256 } from "../tests/helpers/generic-record-array-hosted-evidence.mjs";
import { assertHostedSpecializationArchive, assertHostedSpecializationReport, hostedSpecializationDirectory, hostedSpecializationReceiptSha256, strictArtifactZipMembers } from "../tests/helpers/hosted-specialization-evidence.mjs";
import { assertNativeSpecializationClosure } from "../tests/helpers/native-specialization-closure.mjs";

assert.ok(process.argv.slice(2).every(option => option === "--check"), "Only --check is accepted");
const directory = "docs/evidence/native-specialization-closure-20261010";
const revision = "ff71335c762628da47887bfd4f208e62c39b94b7", workingRevision = "a46d3db2981f7066c6f78bc0f9077929c35b00ee";
const arrays = JSON.parse(await readFile(`${hostedArrayDirectory}/receipt.json`));
const previous = JSON.parse(await readFile(`${hostedSpecializationDirectory}/receipt.json`));
await assertHostedArrayArchive(arrays); await assertHostedSpecializationArchive(previous);
const sources = [], pending = new Map(), reports = [];
const paths = ["tests/native-specializations.test.mjs", "tests/helpers/native-specialization-install.mjs", "tests/helpers/copied-fixture-install.mjs"];
for(const path of ["tests/fixtures/onboarding/native-specializations", "tests/fixtures/specialization-consumers"])
	paths.push(...execFileSync("git", ["ls-tree", "-r", "--name-only", revision, "--", path], { encoding: "utf8" }).trim().split("\n"));
const sourceTexts = new Map();
for(const path of paths)
{
	const archived = previous.files.find(file => file.path === `${hostedSpecializationDirectory}/sources/${path}.txt`);
	assert.ok(archived, path);
	const bytes = await readFile(archived.path);
	for(const ref of [revision, workingRevision])
		assert.deepEqual(execFileSync("git", ["show", `${ref}:${path}`], { maxBuffer: 8 * 1024 * 1024 }), bytes, `${ref}:${path}`);
	sources.push({ path, archivePath: archived.path, sha256: sha256(bytes) });
	sourceTexts.set(path, bytes.toString("utf8"));
}
const source = path => { assert.ok(sourceTexts.has(path), path); return sourceTexts.get(path); };
for(const group of arrays.groups)
{
	const suffix = group.name === "c-family" ? "c-cpp" : group.name === "jvm" ? "java-kotlin" : group.name.startsWith("perl-") ? "perl" : group.name;
	const member = `native-specializations/${suffix}.json`;
	const bytes = strictArtifactZipMembers(await readFile(`${hostedArrayDirectory}/${group.name}.zip`), [member]).get(member);
	const data = JSON.parse(bytes);
	assertHostedSpecializationReport(data, group.name, member, source);
	const path = `${directory}/${group.name}.json`;
	pending.set(path, bytes);
	reports.push({ group: group.name, member, path, bytes: bytes.length
		, sha256: sha256(bytes)
		, artifactId: group.artifactId, jobId: group.jobId
		, checks: data.reports.map(item => [item.profile, item.checks]) });
}
const receipt = { schemaVersion: 1, kind: "native-specialization-closure"
	, planNodes: [1426, 1455]
	, revision, workingRevision, runId: arrays.runId
	, archives: [
		{ path: `${hostedArrayDirectory}/receipt.json`, sha256: hostedArrayReceiptSha256 }
		, { path: `${hostedSpecializationDirectory}/receipt.json`, sha256: hostedSpecializationReceiptSha256 }
	]
	, sources, reports
	, scope: {
		path: "ordinary-source", profiles: 11
		, functionSelections: 12, functionObservations: 14
		, recordSelections: 13, recordObservations: 15
		, arraySelections: 13, arrayObservations: 15
		, python: "The common ten-function fixture runs on 3.11.17; direct, specialized and Array record fixtures also run on 3.12.15."
		, perl: "All fixtures run on 5.36.3 and 5.38.2, each threaded and unthreaded."
		, sourceIdentity: "The eighteen selected function-fixture, producer and consumer files match the old source snapshots, ff71335 producer and a46d3db closure baseline byte for byte. No archived source is executed by the verifier."
		, packageArchivesRetained: false, supportPromotion: false
		, excluded: ["reviewed IR", "open generic dispatch", "callback/resource specializations", "broader recursive/refined/dependent generic work"] }
};
const bytes = Buffer.from(canonicalJson(receipt)); pending.set(`${directory}/receipt.json`, bytes);
await assertNativeSpecializationClosure(receipt, path => pending.has(path) ? Promise.resolve(pending.get(path)) : readFile(path));
for(const [path, content] of pending)
{
	if(process.argv.includes("--check"))
	{
		assert.deepEqual(await readFile(path), content, `${path} differs from its original ZIP member or canonical receipt`);
		continue;
	}
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, content, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.deepEqual(await readFile(path), content, `${path} already holds different bytes`);
	}
}
console.log(JSON.stringify({ reports: reports.length, observations: reports.flatMap(item => item.checks).length, sources: sources.length, receiptSha256: sha256(bytes) }));
