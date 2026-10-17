#!/usr/bin/env node
/**
 * Retain four accepted recursive checked-record Perl cells without rebuilding.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertRecursiveCheckedRecordPerlCiTap
	, checkRecursiveCheckedRecordPerlCiRecords
} from "../tests/helpers/recursive-checked-record-perl-ci-report.mjs";
import {
	recursiveCheckedRecordPerlEvidence
	, recursiveCheckedRecordPerlEvidenceCases
	, recursiveCheckedRecordPerlEvidenceSources
	, recursiveCheckedRecordPerlOriginal
	, recursiveCheckedRecordPerlOriginalRoot
	, recursiveCheckedRecordPerlProducer
} from "../tests/helpers/recursive-checked-record-perl-provenance.mjs";

assert.equal(process.argv.length, 2, "The four frozen runs take no arguments");
execFileSync("git", ["merge-base", "--is-ancestor", recursiveCheckedRecordPerlProducer, "HEAD"]);
await assert.rejects(access(recursiveCheckedRecordPerlEvidence), { code: "ENOENT" });
const files = new Map(), floor = "2.36", maxLoad = 20;
const put = (path, bytes) => {
	assert.ok(!files.has(path), path); files.set(path, Buffer.from(bytes));
};
const json = (bytes, path) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), path);
	return value;
};
const duration = tap => {
	const matches = [...tap.toString().matchAll(/^# duration_ms ([0-9]+(?:\.[0-9]+)?)$/gmu)];
	assert.equal(matches.length, 1); return Number(matches[0][1]);
};

const runs = [];
for(const name of recursiveCheckedRecordPerlEvidenceCases)
{
	const [route, fixture] = name.split("-");
	const origin = join(recursiveCheckedRecordPerlOriginalRoot, route, fixture);
	const tap = await readFile(join(recursiveCheckedRecordPerlOriginalRoot, `${name}.tap`));
	const verificationBytes = await readFile(join(
		recursiveCheckedRecordPerlOriginalRoot, `${name}.verification.json`
	));
	const verification = json(verificationBytes, `${name}.verification.json`);
	assertRecursiveCheckedRecordPerlCiTap(tap.toString(), name);
	const paths = await nativeArtifactPaths(origin);
	const read = path => readFile(join(origin, path));
	const checked = await checkRecursiveCheckedRecordPerlCiRecords({
		name, producer: recursiveCheckedRecordPerlProducer, glibc: floor, maxLoad
		, tap: tap.toString(), paths, read, runtime: verification.runtime
	});
	assert.deepEqual(verification, checked);
	for(const item of verification.records)
	{
		const bytes = await read(item.path);
		assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
		put(`${name}/records/${item.path}`, bytes);
	}
	const retainedHandoff = verification.handoff.filter(item =>
		!item.path.startsWith("handoff/archives/")
	);
	const omittedArchives = verification.handoff.filter(item =>
		item.path.startsWith("handoff/archives/")
	);
	assert.equal(retainedHandoff.length, 2); assert.equal(omittedArchives.length, 2);
	for(const item of retainedHandoff)
	{
		const bytes = await read(item.path);
		assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
		put(`${name}/records/${item.path}`, bytes);
	}
	put(`${name}/producer/run.tap`, tap);
	put(`${name}/producer/verification.json`, verificationBytes);
	runs.push({
		name, route, fixture, floor: verification.floor, maxLoad: verification.maxLoad
		, runtime: verification.runtime, configurations: verification.configurations
		, installModes: verification.installModes, builds: verification.builds
		, executions: verification.executions, durationMs: duration(tap)
		, tapSha256: sha256(tap), verificationSha256: sha256(verificationBytes)
		, reportSha256: verification.reportSha256
		, records: verification.records.length
		, retainedHandoff, omittedArchives
	});
}

const selectedSources = await recursiveCheckedRecordPerlEvidenceSources();
for(const path of selectedSources)
	put("sources/" + path, recursiveCheckedRecordPerlOriginal(
		recursiveCheckedRecordPerlProducer, path
	));
const index = {
	schemaVersion: 1, kind: "recursive-checked-record-perl-installed-v1"
	, producerCommit: recursiveCheckedRecordPerlProducer, runs, selectedSources
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"These are local Linux x64/glibc 2.36 observations with an explicit 2.36 package floor. The dedicated hosted workflow retains the production 2.38 floor."
		, "Each ordinary/reviewed recursive/mutual cell was built twice in independent author roots, then installed through prebuilt-only and local XS compilation on threaded and unthreaded Perl 5.36.3 and 5.38.2."
		, "Every installation ran an unchanged caller before and after moving the complete installed tree, for sixteen executions per cell. Recursive executions recorded 1,709 checks, 144 Lean rejections, 79 host rejections, 95 recoveries and 496 snapshots; mutual executions recorded 1,734 checks, 144 Lean rejections, 81 host rejections, 97 recoveries and 502 snapshots."
		, "The exact fixtures cover recursive records, mutual record/variant cycles, aliases, ordered fields, active branches, checked Nat subtypes, Fin 3 fields, exact depth and cycle failures, input preservation, recovery and constructor-free results."
		, "The archive retains every non-binary producer record, package-set receipts, checksum sidecars, TAP, verification and the producer source closure. Prepared component and runtime CPAN archive bytes are omitted after the original checker authenticated their byte lengths and SHA-256 identities."
		, "Proof fields do not appear in generated Perl classes or result values. Runtime work includes explicit Fin, Subtype and checked-record validation, not proof removal."
		, "This archive establishes only the four named Perl cells. Other hosts, owned values, callbacks, open dependent shapes and broader recursive forms remain separate work; this archive does not itself promote documented support."
	]
};

await mkdir(recursiveCheckedRecordPerlEvidence);
for(const [path, bytes] of files)
{
	const target = join(recursiveCheckedRecordPerlEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(recursiveCheckedRecordPerlEvidence, "index.json"), indexBytes, {
	flag: "wx"
});
process.stdout.write(canonicalJson({
	destination: recursiveCheckedRecordPerlEvidence, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: recursiveCheckedRecordPerlProducer
	, indexSha256: sha256(indexBytes)
}) + "\n");
