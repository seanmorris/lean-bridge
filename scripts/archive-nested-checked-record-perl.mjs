#!/usr/bin/env node
/**
 * Retain four accepted nested checked-record Perl selections without rebuilding.
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
	assertNestedCheckedRecordPerlCiTap
	, checkNestedCheckedRecordPerlCiRecords
} from "../tests/helpers/nested-checked-record-perl-ci-report.mjs";
import {
	nestedCheckedRecordPerlEvidence
	, nestedCheckedRecordPerlEvidenceCases
	, nestedCheckedRecordPerlEvidenceSources
	, nestedCheckedRecordPerlOriginal
	, nestedCheckedRecordPerlOriginalRoot
	, nestedCheckedRecordPerlProducer
} from "../tests/helpers/nested-checked-record-perl-provenance.mjs";

assert.equal(process.argv.length, 2, "The four frozen runs take no arguments");
execFileSync("git", ["merge-base", "--is-ancestor", nestedCheckedRecordPerlProducer, "HEAD"]);
await assert.rejects(access(nestedCheckedRecordPerlEvidence), { code: "ENOENT" });
const files = new Map(), floor = "2.36";
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
for(const name of nestedCheckedRecordPerlEvidenceCases)
{
	const origin = join(nestedCheckedRecordPerlOriginalRoot, name);
	const recordsRoot = join(origin, "records", name);
	const tap = await readFile(join(origin, "run.tap"));
	const verificationBytes = await readFile(join(origin, "verification.json"));
	const verification = json(verificationBytes, `${name}/verification.json`);
	assertNestedCheckedRecordPerlCiTap(tap.toString(), name);
	const paths = await nativeArtifactPaths(recordsRoot);
	const read = path => readFile(join(recordsRoot, path));
	const checked = await checkNestedCheckedRecordPerlCiRecords({
		name, producer: nestedCheckedRecordPerlProducer, glibc: floor
		, tap: tap.toString(), paths, read, runtime: verification.runtime
	});
	assert.deepEqual(verification, checked);
	assert.deepEqual(paths, verification.records.map(item => item.path));
	for(const item of verification.records)
	{
		const bytes = await read(item.path);
		assert.equal(bytes.length, item.bytes); assert.equal(sha256(bytes), item.sha256);
		put(`${name}/records/${item.path}`, bytes);
	}
	put(`${name}/producer/run.tap`, tap);
	put(`${name}/producer/verification.json`, verificationBytes);
	runs.push({
		name, authorRoute: verification.authorRoute, apiMode: verification.apiMode
		, floor: verification.floor, runtime: verification.runtime
		, configurations: verification.configurations
		, installModes: verification.installModes, builds: verification.builds
		, executions: verification.executions, durationMs: duration(tap)
		, tapSha256: sha256(tap), verificationSha256: sha256(verificationBytes)
		, reportSha256: verification.reportSha256
		, records: verification.records.length
	});
}

const selectedSources = await nestedCheckedRecordPerlEvidenceSources();
for(const path of selectedSources)
	put("sources/" + path, nestedCheckedRecordPerlOriginal(
		nestedCheckedRecordPerlProducer, path
	));
const index = {
	schemaVersion: 1, kind: "nested-checked-record-perl-installed-v1"
	, producerCommit: nestedCheckedRecordPerlProducer, runs, selectedSources
	, files: [...files].sort(([left], [right]) => left.localeCompare(right))
		.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) }))
	, limitations: [
		"These are local Linux x64/glibc 2.36 observations with an explicit 2.36 package floor. The dedicated hosted workflow retains the production 2.38 floor but had not run when this archive was created."
		, "Each ordinary/reviewed full/result-only selection was built twice in independent author roots, then installed through prebuilt-only and local XS compilation on threaded and unthreaded Perl 5.36.3 and 5.38.2."
		, "Every installed caller was replayed unchanged after moving its complete installation. Full mode recorded 4,762 checks, 524 expected Lean rejections, four host-shape rejections, 528 recoveries and 1,060 input snapshots in each execution. Result-only mode recorded 1,571 checks and no input constructors."
		, "The retained records include models, package-set receipts, generated XS, CPAN manifests, install receipts, install traces, installed-file identities, exact caller results, TAP, verification, and the producer source closure. Prepared CPAN archive bytes and installed binary bytes are represented by authenticated digests rather than copied into this archive."
		, "Proof fields do not appear in generated Perl classes or result values. Runtime work includes the explicit Fin, Subtype and checked-record validations selected by each export contract, not proof erasure."
		, "The fixture covers a checked Packet with Fin 10 and refined Nat fields through direct and repeated parameters, arrays, Lists, options, products, Except branches, a containing record, an active variant field, and constructor-free Array and Option results."
		, "Recursive and generic checked records, broader dependent indices, callbacks, owned and identity-bearing values remain separate work. This archive does not itself promote documented support."
	]
};

await mkdir(nestedCheckedRecordPerlEvidence);
for(const [path, bytes] of files)
{
	const target = join(nestedCheckedRecordPerlEvidence, path);
	await mkdir(dirname(target), { recursive: true });
	await writeFile(target, bytes, { flag: "wx" });
	assert.deepEqual(await readFile(target), bytes);
}
const indexBytes = Buffer.from(canonicalJson(index));
await writeFile(join(nestedCheckedRecordPerlEvidence, "index.json"), indexBytes, {
	flag: "wx"
});
process.stdout.write(canonicalJson({
	destination: nestedCheckedRecordPerlEvidence, files: files.size
	, bytes: [...files.values()].reduce((sum, value) => sum + value.length, 0)
	, producerCommit: nestedCheckedRecordPerlProducer
	, indexSha256: sha256(indexBytes)
}) + "\n");
