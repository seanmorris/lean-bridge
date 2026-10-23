/**
 * Bind the public npm/browser value-index claims to exact hosted evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	sourceAtHistoryMilestone, withHistoryMilestoneSourcePins
} from "./source-history-test-source.mjs";
import {
	checkedRecordValueIndexBrowserPromotionHistoryPath
} from "./checked-record-value-index-browser-promotion-source-history.mjs";
import {
	checkedRecordValueIndexBrowserNatOnlyLimit
	, checkedRecordValueIndexBrowserPromotionBaseline
	, checkedRecordValueIndexBrowserPromotionConversion
	, checkedRecordValueIndexBrowserPromotionLimit
	, checkedRecordValueIndexBrowserPromotionProfiles
	, checkedRecordValueIndexBrowserPromotionReferences
	, promoteCheckedRecordValueIndexBrowsers
} from "./checked-record-value-index-browser-promotion.mjs";
import {
	checkedRecordValueIndexBrowserEvidence
	, checkedRecordValueIndexBrowserEvidenceRevisions
} from "./checked-record-value-index-browser-evidence.mjs";

const contracts = async () => ({
	irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json"))
	, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json"))
});
const targetId = cell => cell.shape === "checked-record"
	&& checkedRecordValueIndexBrowserPromotionProfiles.includes(cell.profile)
	&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["parameter", "result"].includes(cell.position);
const auditedId = cell => targetId(cell) || cell.shape === "checked-record"
	&& checkedRecordValueIndexBrowserPromotionProfiles.includes(cell.profile)
	&& ["ordinary-source", "reviewed-ir"].includes(cell.path)
	&& ["field", "callback-parameter", "callback-result"]
		.includes(cell.position);

test("hosted value-index browser promotion authenticates four exact routes"
	, { timeout: 900_000 }, async () => {
		const references = await checkedRecordValueIndexBrowserPromotionReferences();
		const revisions = checkedRecordValueIndexBrowserEvidenceRevisions();
		assert.deepEqual(references.map(item => [
			item.route, item.mode, item.sourcePath, item.positions
		]), [
			["ordinary-source", "full", "ordinary-source"
				, ["parameter", "result"]]
			, ["reviewed-ir", "full", "reviewed-ir"
				, ["parameter", "result"]]
			, ["result-only-ordinary-source", "result-only"
				, "ordinary-source", ["result"]]
			, ["result-only-reviewed-ir", "result-only"
				, "reviewed-ir", ["result"]]
		]);
		for(const reference of references)
		{
			assert.deepEqual(reference.profiles
				, checkedRecordValueIndexBrowserPromotionProfiles);
			assert.equal(reference.revision, revisions.producer);
			assert.equal(reference.npmCheckerRevision, revisions.npmChecker);
			assert.equal(reference.consumerRevision, revisions.consumer);
			assert.equal(reference.checkerRevision, revisions.checker);
			assert.equal(reference.archiverRevision, revisions.archiver);
			assert.equal(reference.hostedRun, 39201330491);
			assert.equal(reference.artifact, 12164886878);
			assert.equal(reference.counts.browserExecutions, 12);
			assert.equal(reference.counts.lifecycleObservations, 51);
			assert.equal(reference.counts.controls.fastPasses, 11);
			assert.equal(reference.counts.controls.provenanceMutations, 5);
			assert.equal(reference.files.length, 1970);
			assert.equal(reference.artifacts.length, 2);
			assert.ok(reference.command.includes(
				"run-checked-record-value-index-browser-ci.sh"));
			assert.ok(reference.scope.includes(
				checkedRecordValueIndexBrowserPromotionLimit));
			for(const suffix of [
				"index.json", `${reference.route}/acceptance.tap`
				, `${reference.route}/records/report.json`
				, "sources/checker/.github/workflows/checked-record-value-index-browser.yml"
				, "hosted/api/run.json", "hosted/artifact.zip.parts/0000.part"
			]) assert.ok(reference.files.some(file => file.path.endsWith(suffix))
				, suffix);
		}
	}
);

test("hosted value-index browser promotion rejects forged and repeated evidence"
	, { timeout: 900_000 }, async () => {
		const original = checkedRecordValueIndexBrowserPromotionBaseline();
		const references = await checkedRecordValueIndexBrowserPromotionReferences();
		for(const changed of [
			references.slice(1), references.slice().reverse()
			, [...references, references[0]]
		]) await assert.rejects(
			promoteCheckedRecordValueIndexBrowsers(original, changed));
		for(const mutate of [
			item => { item.profiles.pop(); }
			, item => { item.positions.pop(); }
			, item => { item.revision = "0".repeat(40); }
			, item => { item.hostedRun = 1; }
			, item => { item.counts.browserExecutions = 11; }
			, item => { item.scope = "Every dependent record works"; }
			, item => { item.files.pop(); }
			, item => { item.artifacts.pop(); }
		]) {
			const changed = structuredClone(references);
			mutate(changed[0]);
			await assert.rejects(
				promoteCheckedRecordValueIndexBrowsers(original, changed));
		}
		const promoted = await promoteCheckedRecordValueIndexBrowsers(
			original, references);
		await assert.rejects(promoteCheckedRecordValueIndexBrowsers(
			promoted, references), /Already promoted/u);
		const overlap = structuredClone(original);
		overlap.observations.push(structuredClone(overlap.observations.find(item =>
			item.id === "checked-record-node-javascript-ordinary-source-parameter")));
		await assert.rejects(promoteCheckedRecordValueIndexBrowsers(
			overlap, references), /overlapping/u);
		await assert.rejects(checkedRecordValueIndexBrowserPromotionReferences(
			async path => {
				const bytes = await readFile(path);
				return path === `${checkedRecordValueIndexBrowserEvidence}/index.json`
					? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
			}
		));
	}
);

test("hosted value-index browser promotion changes exactly twenty cells"
	, { timeout: 900_000 }, async () => {
		const original = checkedRecordValueIndexBrowserPromotionBaseline();
		const frozenSha256 = sha256(canonicalJson(original));
		const proposed = withHistoryMilestoneSourcePins(
			checkedRecordValueIndexBrowserPromotionHistoryPath
			, await promoteCheckedRecordValueIndexBrowsers(
				original
				, await checkedRecordValueIndexBrowserPromotionReferences()
			)
		);
		validateTypeSurface(proposed, await contracts());
		assert.equal(sha256(canonicalJson(original)), frozenSha256);
		assert.equal(proposed.evidence.length, original.evidence.length + 4);
		assert.equal(proposed.observations.length, original.observations.length);
		const before = typeSurfaceCells(original, await contracts(), auditedId);
		const after = typeSurfaceCells(proposed, await contracts(), auditedId);
		const beforeById = new Map(before.map(cell => [cell.id, cell]));
		const changed = [];
		for(const cell of after)
		{
			const prior = beforeById.get(cell.id);
			assert.ok(prior, cell.id);
			if(!targetId(cell))
			{
				assert.deepEqual(cell, prior, cell.id);
				continue;
			}
			assert.notDeepEqual(cell, prior, cell.id);
			assert.equal(cell.stages.installedExecution.state, "passed");
			assert.equal(cell.hostType, prior.hostType);
			assert.ok(cell.conversionNote.includes(
				checkedRecordValueIndexBrowserPromotionConversion));
			assert.ok(cell.limitations.includes(
				checkedRecordValueIndexBrowserPromotionLimit));
			assert.ok(!cell.limitations.includes(
				checkedRecordValueIndexBrowserNatOnlyLimit));
			for(const stage of Object.values(cell.stages))
			{
				const ids = stage.evidence.filter(id =>
					id.startsWith("checked-record-value-index-browser-"));
				assert.equal(ids.length, cell.position === "result" ? 2 : 1);
				assert.ok(ids.every(id => id.includes(cell.path)));
			}
			changed.push(cell.id);
		}
		const expected = checkedRecordValueIndexBrowserPromotionProfiles.flatMap(
			profile => ["ordinary-source", "reviewed-ir"].flatMap(path =>
				["parameter", "result"].map(position =>
					`${profile}/checked-record/${path}/${position}`)));
		assert.deepEqual(changed.sort(), expected.sort());
		assert.equal(changed.length, 20);
		for(const cell of after.filter(item => item.shape === "checked-record"
			&& checkedRecordValueIndexBrowserPromotionProfiles.includes(item.profile)
			&& ["field", "callback-parameter", "callback-result"]
				.includes(item.position)))
			assert.deepEqual(cell, beforeById.get(cell.id), cell.id);

		for(let index = 0; index < original.evidence.length; index++)
		{
			const prior = original.evidence[index];
			const current = proposed.evidence[index];
			assert.equal(current.id, prior.id);
			assert.deepEqual({ ...current, files: undefined }
				, { ...prior, files: undefined }, prior.id);
			assert.deepEqual(current.files.map(file => file.path)
				, prior.files.map(file => file.path), prior.id);
		}
		const milestone = sourceAtHistoryMilestone(
			checkedRecordValueIndexBrowserPromotionHistoryPath
			, "docs/type-surface.v1.json"
		);
		assert.equal(sha256(canonicalJson(proposed))
			, sha256(canonicalJson(JSON.parse(milestone))));
	}
);

test("value-index browser docs name the exact prepared packages and boundary"
	, async () => {
		const paths = [
			"docs/javascript-typescript.md", "docs/lean/existing-package.md"
			, "docs/lean/export-decisions.md", "docs/reference/types.md"
			, "docs/evidence/README.md"
		];
	for(const path of paths)
	{
		const source = sourceAtHistoryMilestone(
			checkedRecordValueIndexBrowserPromotionHistoryPath, path
		);
		assert.ok(source.includes(
			"checked-record-value-index-browser-promotion-20261019.md"), path);
	}
	const javascript = sourceAtHistoryMilestone(
		checkedRecordValueIndexBrowserPromotionHistoryPath
		, "docs/javascript-typescript.md"
	);
		for(const value of [
			"Bool", "String", "Nat", "result-only", "λ🌱"
			, "340282366920938463463374607431768211457"
			, "Open or opaque", "workflow"
		]) assert.ok(javascript.includes(value), value);
		const summary = await readFile(
			"docs/evidence/checked-record-value-index-browser-promotion-20261019.md"
			, "utf8");
		for(const value of [
			"39201330491", "12164886878"
			, "79359306d2e50a5893affe04cafed95d54166b88"
			, "20", "parameter", "result", "fields", "callbacks"
		]) assert.ok(summary.includes(value), value);

		const workflow = await readFile(
			".github/workflows/checked-record-value-index-browser.yml", "utf8");
		assert.ok(workflow.includes(
			"on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
		assert.ok(workflow.includes(
			"run-checked-record-value-index-browser-ci.sh"));
		const profiles = await readFile("src/adoption/test-profiles.mjs", "utf8");
		assert.ok(profiles.includes('"checked-record-value-index-browser"'));
	}
);
