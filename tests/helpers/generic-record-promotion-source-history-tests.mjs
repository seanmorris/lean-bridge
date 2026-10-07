/**
 * Core regression repairs preserve historical receipts and support claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedScalarRolloutSource } from "./reviewed-scalar-rollout-source-history.mjs";
import { beforeGenericRecordPromotionSource, genericRecordPromotionChangedPaths, genericRecordPromotionHistoryPath, reverseGenericRecordPromotionUpdate } from "./generic-record-promotion-source-history.mjs";

test("Generic record promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(genericRecordPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e79ff60b547325fd10e5d0261bc35c75e818d509");
	assert.deepEqual(record.updates.map(update => update.path), genericRecordPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedScalarRolloutSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseGenericRecordPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeGenericRecordPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeGenericRecordPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeGenericRecordPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseGenericRecordPromotionUpdate(changed, update));
		assert.throws(() => reverseGenericRecordPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("generic promotion cites nine installed bundles without changing unrelated profiles or historical claims", async () => {
	const path = "docs/type-surface.v1.json", source = beforeReviewedScalarRolloutSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeGenericRecordPromotionSource(path, source));
	const receipt = JSON.parse(await readFile("docs/evidence/generic-record-specializations-20261007/receipt.json", "utf8"));
	const references = receipt.reports.map(report => ({ ...report, evidenceId: `generic-record-${report.id.replaceAll(".", "-")}-installed` }));
	assert.equal(references.length, 9);
	assert.deepEqual(current.evidence.slice(previous.evidence.length).map(entry => entry.id), references.map(entry => entry.evidenceId));
	assert.deepEqual(current.observations.map(entry => entry.id), previous.observations.map(entry => entry.id));
	const selected = ["npm-finite-specializations", "perl-finite-specializations"
		, "native-specializations-c-cpp", "native-specializations-python"
		, "native-specializations-rust", "native-specializations-ruby"
		, "native-specializations-dotnet", "native-specializations-java-kotlin"
		, "native-specializations-php-native"
		, "native-specializations-wit-wasi"].map(id => `${id}-ordinary-source`);
	for(const [index, cell] of current.observations.entries())
	{
		const before = previous.observations[index];
		if(!selected.includes(cell.id))
		{ assert.deepEqual(cell, before, cell.id); continue; }
		const profiles = cell.profiles.map(profile => profile.startsWith("node-") ? "npm" : profile);
		const added = references.filter(report => report.profiles.some(profile => profiles.includes(profile))).map(report => report.evidenceId);
		assert.ok(added.length > 0, cell.id);
		for(const [stage, value] of Object.entries(cell.stages))
		{
			assert.deepEqual({ ...value, evidence: null }, { ...before.stages[stage], evidence: null }, `${cell.id}/${stage}`);
			assert.deepEqual(value.evidence, [...before.stages[stage].evidence, ...added]);
		}
		const strip = value => ({ ...value, stages: null, scope: null, limitations: null, conversionNotes: null });
		assert.deepEqual(strip(cell), strip(before));
		assert.match(cell.scope, /nine configured specializations/u);
		assert.match(cell.conversionNotes.generic, /host record with instantiated fields/u);
		assert.ok(cell.limitations.some(value => value.includes("reviewed generic signatures and PHP-Wasm are not covered")));
		assert.ok(!cell.limitations.some(value => /installed acceptance of them is not yet recorded|separate #1433 implementation/u.test(value)));
	}
	for(const key of Object.keys(previous).filter(key => !["evidence", "observations"].includes(key)))
		assert.deepEqual(current[key], previous[key], key);
	let refreshed = 0;
	for(const [index, entry] of previous.evidence.entries())
	{
		const now = current.evidence[index];
		const strip = value => ({ ...value, files: value.files.map(file => file.path) });
		assert.deepEqual(strip(now), strip(entry), entry.id);
		for(const [position, file] of entry.files.entries())
		{
			if(file.sha256 === now.files[position].sha256) continue;
			assert.ok(genericRecordPromotionChangedPaths.includes(file.path));
			const bytes = beforeReviewedScalarRolloutSource(file.path, await readFile(file.path, "utf8"));
			assert.equal(sha256(beforeGenericRecordPromotionSource(file.path, bytes)), file.sha256);
			assert.equal(sha256(bytes), now.files[position].sha256); refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	for(const reference of references)
	{
		const evidence = current.evidence.find(entry => entry.id === reference.evidenceId);
		assert.equal(evidence.kind, "installed");
		assert.equal(evidence.revision, reference.revision);
		assert.equal(evidence.command, reference.reproduceCommand);
		const bytes = await readFile(reference.path);
		assert.equal(sha256(bytes), reference.sha256);
		const report = JSON.parse(bytes);
		const hashes = reference.id === "specialized-npm" ? [report.archiveSha256, report.runtimeArchiveSha256] : Object.values(report.archives);
		assert.deepEqual(evidence.artifacts.map(item => item.sha256).sort(), hashes.sort());
		for(const file of evidence.files)
			assert.equal(sha256(beforeReviewedScalarRolloutSource(file.path, await readFile(file.path, "utf8"))), file.sha256, file.path);
	}
});
