/**
 * Keep the diagnostic CI repair tied to exact source transitions and unchanged acceptance scope.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinEdgeIntegrationSource, finEdgeIntegrationChangedPaths } from "./fin-container-edge-integration-history.mjs";
import { finEdgeCiChangedPaths } from "./fin-container-edge-ci-history.mjs";
import { finForeignChangedPaths } from "./fin-container-foreign-history.mjs";
import { finRecordOmissionChangedPaths } from "./fin-record-review-omission-history.mjs";
import { finHostedPromotionChangedPaths } from "./fin-native-hosted-promotion-history.mjs";
import { finZeroCiChangedPaths } from "./fin-record-zero-ci-history.mjs";
import { finNominalRefusalChangedPaths } from "./fin-nominal-refusal-history.mjs";
import { finAliasClosureChangedPaths } from "./fin-alias-closure-history.mjs";
import { phpWasmDirectFinChangedPaths } from "./php-wasm-fin-direct-history.mjs";
import { beforeFinDiagnosticCiSource, finDiagnosticCiChangedPaths, finDiagnosticCiHistoryPath, finDiagnosticCiPredecessor, reverseFinDiagnosticCiUpdate } from "./native-fin-diagnostic-ci-history.mjs";

test("diagnostic CI history authenticates exact repairs and refuses unknown source changes", async () => {
	const history = JSON.parse(await readFile(finDiagnosticCiHistoryPath, "utf8"));
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "native-fin-diagnostic-ci-v1");
	assert.equal(history.predecessorCommit, finDiagnosticCiPredecessor);
	assert.deepEqual(history.updates.map(update => update.path), finDiagnosticCiChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeFinEdgeIntegrationSource(update.path, await readFile(update.path, "utf8")), previous = reverseFinDiagnosticCiUpdate(current, update);
		assert.equal(beforeFinDiagnosticCiSource(update.path, current), previous);
		assert.equal(beforeFinDiagnosticCiSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinDiagnosticCiSource(update.path, previous), previous);
		assert.equal(beforeFinRefinementSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(update.path, current), beforeFinRefinementSource(update.path, previous));
		const changed = current + "\n// unknown edit\n";
		assert.equal(beforeFinDiagnosticCiSource(update.path, changed), changed);
		assert.throws(() => reverseFinDiagnosticCiUpdate(changed, update));
		assert.throws(() => reverseFinDiagnosticCiUpdate(current, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseFinDiagnosticCiUpdate(current, { ...update, path: "unknown.mjs" }));
		assert.throws(() => reverseFinDiagnosticCiUpdate(current, { ...update, edits: [] }));
		assert.throws(() => reverseFinDiagnosticCiUpdate(current, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("diagnostic CI repair changes source pins only and preserves earlier ledgers", async () => {
	const history = JSON.parse(await readFile(finDiagnosticCiHistoryPath, "utf8"));
	const path = "docs/type-surface.v1.json", source = beforeFinEdgeIntegrationSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeFinDiagnosticCiSource(path, source));
	const expected = structuredClone(previous); let refreshed = 0;
	for(const entry of expected.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path && item.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; refreshed++; }
	}
	assert.equal(refreshed, 12);
	assert.deepEqual(current, expected);
	assert.deepEqual(current.observations, previous.observations);
	for(const file of current.evidence.flatMap(entry => entry.files))
	{
		const bytes = await readFile(file.path);
		const source = [...phpWasmDirectFinChangedPaths, ...finAliasClosureChangedPaths, ...finNominalRefusalChangedPaths, ...finZeroCiChangedPaths, ...finHostedPromotionChangedPaths, ...finRecordOmissionChangedPaths, ...finForeignChangedPaths, ...finEdgeCiChangedPaths, ...finEdgeIntegrationChangedPaths].includes(file.path)
			? beforeFinEdgeIntegrationSource(file.path, bytes.toString("utf8")) : bytes;
		assert.equal(sha256(source), file.sha256, file.path);
	}
	assert.equal(sha256(await readFile("docs/evidence/native-fin-diagnostic-source-history-20261010.json")), "2bc3b1217601bb0eb0c19b9f1496d00ab5df831e3a1bd1881a4429b28fd210ab");
});
