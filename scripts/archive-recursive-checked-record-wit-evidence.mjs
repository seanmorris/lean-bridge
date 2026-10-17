#!/usr/bin/env node
/**
 * Validate and archive the accepted recursive checked-record WIT cells and their refused attempts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { inspectRecursiveCheckedRecordWitHandoff } from "../tests/helpers/recursive-checked-record-wit-handoff.mjs";
import { checkRecursiveCheckedRecordWitReport } from "../tests/helpers/recursive-checked-record-wit-report.mjs";
import {
	assertRecursiveCheckedRecordWitEvidenceTap, assertRecursiveCheckedRecordWitRefusalTap
	, recursiveCheckedRecordWitAttempts, recursiveCheckedRecordWitEvidence
	, recursiveCheckedRecordWitEvidenceSources, recursiveCheckedRecordWitLoadCeiling
	, recursiveCheckedRecordWitOriginal, recursiveCheckedRecordWitProducer
	, recursiveCheckedRecordWitRefusals, recursiveCheckedRecordWitRuntime
	, recursiveCheckedRecordWitSelections, recursiveCheckedRecordWitTools
	, recursiveCheckedRecordWitVerifier
} from "../tests/helpers/recursive-checked-record-wit-provenance.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const usage = "Usage: archive-recursive-checked-record-wit-evidence.mjs /absolute/r1-root /absolute/r2-root /absolute/r3-root /absolute/runner-directory";
const roots = process.argv.slice(2);
assert.equal(roots.length, 4, usage);
for(const root of roots) assert.ok(isAbsolute(root) && resolve(root) === root, usage);
const [r1, r2, r3, runnerDirectory] = roots, attemptRoots = { r1, r2, r3 };
const destination = resolve(recursiveCheckedRecordWitEvidence);
await assert.rejects(access(destination), { code: "ENOENT" });
await mkdir(destination, { recursive: false });

const treeFiles = async (root, prefix = "") => {
	const paths = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) paths.push(...await treeFiles(root, path));
		else
		{
			assert.ok(entry.isFile() && !entry.isSymbolicLink(), path); paths.push(path);
		}
	}
	return paths.sort();
};
const copy = async (from, to) => {
	const bytes = await readFile(from); await saveLakeFile(destination, to, bytes); return bytes;
};

// Each attempt pinned the producer revision and its own fresh root; logs end with the runner status.
const runners = {};
for(const [attempt, suffix, status] of [["r1", "", 4], ["r2", "-r2", 4], ["r3", "-r3", 0]])
{
	const script = await copy(join(runnerDirectory, `vo1522-wit-ffcb1cf${suffix}.sh`), `producer/runners/${attempt}.sh`);
	assert.ok(script.includes(`test "$(git rev-parse HEAD)" = ${recursiveCheckedRecordWitProducer} ||`), attempt);
	assert.ok(script.includes(`\nroot=${attemptRoots[attempt]}\n`), `${attempt} root`);
	const log = await copy(join(runnerDirectory, `vo1522-wit-ffcb1cf${suffix}.log`), `producer/runners/${attempt}.log`);
	assert.ok(log.toString().endsWith(`\nexit ${status}\n`) || log.toString() === `exit ${status}\n`, `${attempt} status`);
	runners[attempt] = { scriptSha256: sha256(script), logSha256: sha256(log), exit: status };
}

const runs = [];
for(const [route, fixture] of recursiveCheckedRecordWitSelections)
{
	const label = `${route}-${fixture}`, attempt = recursiveCheckedRecordWitAttempts[label];
	const cell = join(attemptRoots[attempt], label), recordsRoot = join(cell, "records", route, fixture);
	const tap = await copy(join(cell, "run.tap"), `${label}/run.tap`);
	assertRecursiveCheckedRecordWitEvidenceTap(tap.toString(), route, fixture);
	assert.equal((await readFile(join(cell, "verification.err"))).length, 0, `${label} checker stderr`);
	const verificationBytes = await copy(join(cell, "verification.json"), `${label}/verification.json`);
	const verification = JSON.parse(verificationBytes);
	const originalRead = path => readFile(join(recordsRoot, path));
	const handoff = await inspectRecursiveCheckedRecordWitHandoff(originalRead, fixture);
	const read = path => handoff.supplements.get(path) ?? originalRead(path);
	const result = await checkRecursiveCheckedRecordWitReport(read, {
		route, fixture, producerCommit: recursiveCheckedRecordWitProducer
		, runtime: recursiveCheckedRecordWitRuntime, floor: "2.36"
	});
	assert.equal(result.loadCeiling, recursiveCheckedRecordWitLoadCeiling);
	// The checker's own output is exactly the report result, the inspected tools and its controls.
	const tools = JSON.parse(await originalRead("tools.json"));
	assert.deepEqual(tools.selected, recursiveCheckedRecordWitTools);
	assert.equal(verificationBytes.toString(), canonicalJson({ ...result, tools, controls: verification.controls }));
	const retained = result.records.filter(path => !handoff.supplements.has(path)).concat(handoff.archivePath).sort();
	assert.deepEqual(await treeFiles(recordsRoot), retained);
	for(const path of retained) await copy(join(recordsRoot, path), `${label}/records/${path}`);
	await saveLakeFile(destination, `${label}/controls.json`, canonicalJson(verification.controls));
	runs.push({ label, route, fixture, attempt, counts: result.counts
		, records: result.records.length, executions: result.executions
		, loadCeiling: result.loadCeiling, archiveSha256: result.archiveSha256
		, reportSha256: result.reportSha256, tapSha256: sha256(tap)
		, verificationSha256: sha256(verificationBytes)
		, controls: verification.controls });
}

const refusals = [];
for(const refusal of recursiveCheckedRecordWitRefusals)
{
	const [route, fixture] = refusal.label.split("-"), cell = join(attemptRoots[refusal.attempt], refusal.label);
	const prefix = `refusals/${refusal.attempt}-${refusal.label}`;
	const tap = await copy(join(cell, "run.tap"), `${prefix}/run.tap`);
	assertRecursiveCheckedRecordWitRefusalTap(tap.toString(), refusal);
	const resources = await copy(join(cell, "records", route, fixture, "resources.json"), `${prefix}/resources.json`);
	refusals.push({ ...refusal, tapSha256: sha256(tap), resourcesSha256: sha256(resources) });
}

const selectedSources = recursiveCheckedRecordWitEvidenceSources();
for(const source of selectedSources)
{
	const bytes = recursiveCheckedRecordWitOriginal(source.revision, source.path);
	await saveLakeFile(destination, `sources/${source.role}/${source.path}`, bytes);
}

const files = [];
for(const path of await treeFiles(destination))
{
	const stats = await lstat(join(destination, path));
	assert.ok(stats.isFile() && !stats.isSymbolicLink(), path);
	const bytes = await readFile(join(destination, path));
	files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
}
const index = {
	schemaVersion: 1, kind: "recursive-checked-record-wit-installed-v1"
	, producerCommit: recursiveCheckedRecordWitProducer
	, checkerCommit: recursiveCheckedRecordWitVerifier
	, loadCeiling: recursiveCheckedRecordWitLoadCeiling
	, runtime: recursiveCheckedRecordWitRuntime
	, tools: recursiveCheckedRecordWitTools
	, runners, selectedSources, runs, refusals
	, limitations: [
		"The fixtures cover self-recursive Packet and mutual Envelope/Step groups with Option and Array carriers."
		, "Checked fields are limited to Fin 3 and the tested plusOne/plusTwo Nat Subtype constructors."
		, "Each package is a copied-graph WIT component whose native host forwards exact refinement diagnostics as the final Wasmtime error cause; callbacks, resources and owned positions remain separate work."
		, "The component requires its packaged native Lean host and is not a standalone WASI command."
		, "Accepted cells come from serial attempts r2 and r3 at one frozen revision; r1 and the r2 reviewed-mutual cell refused on disk and load guards and are retained only as observations."
		, "These local Linux x64/glibc 2.36 runs do not establish hosted release-floor acceptance."
		, "Constructor dispatch and peak memory are unmeasured."
	]
	, files
};
await saveLakeFile(destination, "index.json", canonicalJson(index));
process.stdout.write(canonicalJson({
	evidence: recursiveCheckedRecordWitEvidence
	, indexSha256: sha256(canonicalJson(index))
	, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0)
}) + "\n");
