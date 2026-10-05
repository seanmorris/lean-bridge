/**
 * Bind WIT recursive acceptance to executed packages and preserve older receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { readTypeSurface, typeSurfaceCells } from "../../src/adoption/type-surface.mjs";
import { assertWitCompositionIntegration, witCompositionExecutionPath } from "./wit-composition-evidence.mjs";
import { witCompositionHistoryPath } from "./wit-composition-source-history.mjs";
import { reverseWitAcceptanceUpdate, witAcceptanceChangedPaths } from "./wit-acceptance-source-history.mjs";
import { beforeCStructuredCallables } from "./c-structured-callable-source-history.mjs";

export const witOrdinaryRegressionPath = "docs/evidence/wit-ordinary-regression-20260924.json";
export const witAcceptanceAddedPaths = [
	witOrdinaryRegressionPath, "docs/evidence/wit-recursive-acceptance-20260924.md"
	, "tests/helpers/wit-acceptance-source-history.mjs"
	, "tests/helpers/wit-recursive-acceptance.mjs"
	, "tests/wit-recursive-acceptance.test.mjs"
].sort();
const scope = {
	profiles: ["wit-wasi"], paths: ["ordinary-source", "reviewed-ir"]
	, shapes: ["recursive"], positions: ["parameter", "result", "field"]
	, copiedRecursiveAcceptance: true
	, structuredCallbacks: false
	, ownedResourceAggregates: false
};
const referencedJson = async (reference, path) => {
	assert.equal(reference.path, path);
	const bytes = await readFile(path); assert.equal(sha256(bytes), reference.sha256, path);
	return JSON.parse(bytes);
};

/**
 * Require the reproduced compiler failure and full enabled regression rerun.
 *
 * @param record - Original local TAP logs and fixture identities.
 */
export const assertWitOrdinaryRegression = record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-ordinary-fixture-regression");
	assert.equal(record.source.path, "tests/native-wit.test.mjs");
	assert.notEqual(record.source.previousSha256, record.source.currentSha256);
	for(const run of [record.original, record.fixed])
	{
		assert.equal(sha256(run.text), run.sha256);
		assert.ok(run.command.includes("LEAN_BRIDGE_NATIVE_WIT_TEST=1"));
		assert.ok(run.command.includes("tests/native-wit.test.mjs"));
	}
	assert.equal(record.original.exitCode, 1); assert.match(record.original.text, /# fail 1\n/u);
	assert.match(record.original.text, /invalid use of undefined type.*dl_phdr_info/u);
	assert.match(record.original.text, /unknown type name.*Dl_info/u);
	assert.equal(record.fixed.exitCode, 0);
	assert.doesNotMatch(record.fixed.command, /--test-name-pattern/u);
	assert.match(record.fixed.text, /# tests 4\n# suites 0\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.match(record.fixed.text, /ok 3 - ordinary WIT archives reproduce and execute all copied types after installation/u);
	assert.match(record.fixed.text, /ok 4 - ordinary WIT compilation fails atomically when its pinned engine is absent/u);
	for(const project of ["cobalt", "saffron"]) assert.ok(record.fixed.text.includes(`${project}-api-2.0.0-rc.1-wit-wasi.tar.gz`));
};

/**
 * Promote only six copied cells and authenticate every source and prior report.
 *
 * @param record - Acceptance index and exact changes since the composition gate.
 */
export const assertWitRecursiveAcceptance = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "wit-recursive-acceptance");
	assert.equal(record.baselineRevision, "60c4262eacacc6b668f16a6778b535a3f2d68a54");
	assert.deepEqual(record.scope, scope);
	assert.deepEqual(record.inventory, { previousVersion: "0.84.0", version: "0.85.0", previousInstalled: 4212, installed: 4218, total: 6562, copiedRecursiveProfiles: 17 });
	const previous = await referencedJson(record.previous, witCompositionHistoryPath);
	const execution = await referencedJson(record.execution, witCompositionExecutionPath);
	assert.deepEqual(record.execution, previous.execution);
	const regression = await referencedJson(record.ordinaryRegression, witOrdinaryRegressionPath);
	assertWitOrdinaryRegression(regression);
	assert.deepEqual(record.updates.map(update => update.path).sort(), witAcceptanceChangedPaths);
	assert.deepEqual(Object.keys(record.additions).sort(), witAcceptanceAddedPaths);
	const paths = [...new Set([...Object.keys(previous.sourceHashes), ...witAcceptanceChangedPaths, ...witAcceptanceAddedPaths])].sort();
	assert.deepEqual(Object.keys(record.sourceHashes).sort(), paths);
	const priorSource = async path => beforeCStructuredCallables(path, await readFile(path, "utf8"), record.sourceHashes[path]);
	for(const path of paths) assert.equal(sha256(await priorSource(path)), record.sourceHashes[path], path);
	const restored = {};
	for(const update of record.updates)
	{
		assert.equal(update.currentSha256, record.sourceHashes[update.path]);
		restored[update.path] = reverseWitAcceptanceUpdate(await priorSource(update.path), update);
		if(previous.sourceHashes[update.path]) assert.equal(update.previousSha256, previous.sourceHashes[update.path]);
	}
	for(const [path, expected] of Object.entries(record.additions)) assert.equal(expected, record.sourceHashes[path]);
	const oldInventory = JSON.parse(restored["docs/type-surface.v1.json"]);
	for(const path of [regression.source.path, "tests/type-surface.test.mjs", "scripts/generate-type-docs.mjs"])
	{
		const oldHashes = oldInventory.evidence.flatMap(entry => entry.files).filter(file => file.path === path).map(file => file.sha256);
		assert.ok(oldHashes.length > 0);
		for(const hash of oldHashes) assert.equal(hash, sha256(restored[path]), path);
	}
	assert.equal(regression.source.previousSha256, sha256(restored[regression.source.path]));
	assert.equal(regression.source.currentSha256, record.sourceHashes[regression.source.path]);
	assert.match(await readFile(regression.source.path, "utf8"), /#ifndef _GNU_SOURCE\n#define _GNU_SOURCE\n#endif\n#include <stdlib.h>/u);
	const { document: current, ...contracts } = await readTypeSurface();
	assert.ok(current.contractVersion);
	const document = JSON.parse(await priorSource("docs/type-surface.v1.json"));
	assert.equal(oldInventory.contractVersion, record.inventory.previousVersion);
	assert.equal(document.contractVersion, record.inventory.version);
	const oldCells = typeSurfaceCells(oldInventory, contracts), cells = typeSurfaceCells(document, contracts);
	const installed = items => items.filter(cell => cell.stages.installedExecution.state === "passed");
	assert.equal(installed(oldCells).length, record.inventory.previousInstalled);
	assert.equal(installed(cells).length, record.inventory.installed); assert.equal(cells.length, record.inventory.total);
	const promoted = cells.filter(cell => cell.stages.installedExecution.evidence.includes("wit-wasi-recursive-installed"));
	assert.equal(promoted.length, 6);
	for(const cell of promoted)
	{
		assert.equal(cell.profile, "wit-wasi"); assert.equal(cell.shape, "recursive");
		assert.ok(scope.paths.includes(cell.path)); assert.ok(scope.positions.includes(cell.position));
		for(const stage of Object.values(cell.stages)) assert.deepEqual({ state: stage.state, evidence: stage.evidence }, { state: "passed", evidence: ["wit-wasi-recursive-installed"] });
	}
	const oldById = new Map(oldCells.map(cell => [cell.id, cell]));
	for(const cell of cells.filter(cell => !promoted.includes(cell))) assert.deepEqual(cell, oldById.get(cell.id), cell.id);
	assert.equal(new Set(installed(cells).filter(cell => cell.shape === "recursive").map(cell => cell.profile)).size, 17);
	const entry = document.evidence.find(item => item.id === "wit-wasi-recursive-installed");
	const artifacts = execution.reports.recursive.observations.flatMap(run => run.package.artifacts.map(artifact => ({
		path: `wit-wasi/${run.reviewed ? "reviewed-ir" : "ordinary-source"}/${artifact.path}`
		, sha256: artifact.sha256
	})));
	assert.deepEqual(entry.artifacts, artifacts);
	assert.ok(entry.files.some(file => file.path === witCompositionExecutionPath));
	assert.ok(entry.files.some(file => file.path === witOrdinaryRegressionPath));
	await assertWitCompositionIntegration(previous);
};
