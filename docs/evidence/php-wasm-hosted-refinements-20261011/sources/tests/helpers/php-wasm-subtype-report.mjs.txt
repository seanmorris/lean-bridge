/**
 * Validate installed Subtype reports against independently selected source contracts.
 * Report consistency does not establish hosted provenance or measure dispatch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { compilerExportSelection } from "../../src/analyze/export-configuration.mjs";
import { reviewedSourceSelection } from "../../src/analyze/reviewed-source.mjs";
import { phpWasmSubtypeFixture } from "./php-wasm-subtype-fixture.mjs";
import { assertPhpWasmRefinementObservation } from "./php-wasm-fin-observation.mjs";
import { assertPhpWasmRefinementPackage } from "./php-wasm-fin-direct-report.mjs";

export const phpWasmSubtypeChecks = 2024;

/** Read the independent complete fixture, then remove its temporary staging. */
export const phpWasmSubtypeReportInput = async () => {
	const cleanup = [];
	try
	{
		const fixture = await phpWasmSubtypeFixture({ after: callback => cleanup.push(callback) });
		return { fixture, name: "subtypes"
			, lean: await readFile(join(fixture.root, "Subtypes.lean"), "utf8")
			, caller: await readFile(fixture.consumer, "utf8") };
	}
	finally
	{ for(const callback of cleanup.reverse()) await callback(); }
};

/**
 * Require all installed executions and the exact ordinary or independently reviewed API.
 *
 * @param report - One original installed report.
 * @param route - Explicit ordinary-source or reviewed-source selection.
 * @param input - Independently composed source, caller and constructor decisions.
 */
export const assertPhpWasmSubtypeReport = (report, route, input) => {
	assert.ok(["ordinary-source", "reviewed-source"].includes(route));
	const reviewed = route === "reviewed-source", { fixture, name, lean, caller } = input;
	assert.deepEqual(Object.keys(report).sort(), [
		"schemaVersion", "archives", "bindingIrSha256", "constructorDispatch"
		, "dispatch", "fixture", "fixtureSources", "label", "modelSha256"
		, "observation", "packages", "path", "phpWasm", "profile", "receiptSha256"
		, "refinements", "reproducible", "sourceRemovedBeforeInstallation"
		, ...reviewed ? ["reviewedBindingIrSha256"] : []
	].sort());
	assert.equal(report.schemaVersion, 1); assert.equal(report.fixture, "subtypes");
	assert.equal(report.label, "subtypes"); assert.equal(report.constructorDispatch, "not measured");
	assert.deepEqual(report.fixtureSources, { leanSha256: sha256(lean), phpSha256: sha256(caller) });
	const requests = arrangement => `${JSON.stringify({ module: fixture.namespace
		, operations: { probe: fixture.operation }
		, autoload: arrangement === "composer" ? "vendor/autoload.php" : `vendor/${fixture.settings.composer.name}/bootstrap.php` })}\n`;
	assertPhpWasmRefinementObservation(report, fixture, caller, requests, phpWasmSubtypeChecks, reviewed);
	const identity = report.phpWasm.component.sourceIdentity, request = identity.request;
	const selection = reviewed ? reviewedSourceSelection(identity.reviewedBindingIr) : compilerExportSelection(fixture);
	assert.deepEqual(request.contracts, selection.contracts);
	assert.deepEqual(request.specializations, selection.specializations);
	assert.deepEqual(request.exports, reviewed ? selection.exports : fixture.exports);
	assert.deepEqual(request.arities, []); assert.deepEqual(request.resources, []);
	assert.deepEqual(request.modules, [fixture.module]); assert.deepEqual(request.exportModules, [fixture.module]);
	assert.equal(request.profile, "native-library-v1");
	assertPhpWasmRefinementPackage(report, fixture, name, lean);
	return true;
};
