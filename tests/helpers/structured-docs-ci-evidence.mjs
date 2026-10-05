/**
 * Authenticate the installed npm rerun after repairing example selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { npmStructuredCallableDocumentation } from "./npm-structured-callable-documentation.mjs";

export const structuredDocsCiCommand = "LEAN_BRIDGE_RUNTIME_ROOT=/app/build/owned-js-transfer-runtime-inputs LEAN_BRIDGE_LAKE_RUNTIME_ROOT=/app/build/lean-link-spike/lazy LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit node --test tests/component-structured-callables.test.mjs";
export const structuredDocsCiScope = Object.freeze({
	profiles: ["node-javascript", "node-typescript", "browser-javascript", "browser-react", "browser-worker"]
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, browsers: ["chromium", "firefox", "webkit"]
	, installedPublicApi: true, documentationExecuted: true
	, runtimeChanges: false, installedSupportPromotions: 0
});

/**
 * Require real installed examples and the unchanged full callback corpus.
 *
 * @param record - Source-bound installed observations and completed test output.
 */
export const assertStructuredDocsCiExecution = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "structured-docs-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, structuredDocsCiScope);
	assert.equal(record.run.command, structuredDocsCiCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.report.runs.map(run => run.path), structuredDocsCiScope.sourcePaths);
	const consumer = (await Promise.all(["callable-consumers/npm.mjs", "structured-callable-consumers/npm.mjs"].map(path => readFile(`tests/fixtures/${path}`, "utf8")))).join("\n");
	const source = `${await readFile("tests/fixtures/onboarding/structured-callables/Structured.lean", "utf8")}\n${await readFile("tests/fixtures/structured-callable-consumers/Npm.lean", "utf8")}`;
	const documentation = npmStructuredCallableDocumentation(await readFile("docs/javascript-typescript.md", "utf8"));
	const result = { checks: 133120, rejections: 53, shapes: 9
		, primitive: { checks: 8084, primitives: 19, wordBits: 32 } };
	for(const run of record.report.runs)
	{
		for(const flag of ["offlineInstall"
			, "compilerFreePath"
			, "sourceRelocatedBeforeInstallation"
			, "sourceRemovedBeforeInstallation"
			, "producerBuildsRemovedBeforeInstallation"
			, "packagesRelocatedBeforeInstallation"])
			assert.equal(run[flag], true, flag);
		assert.match(run.node, /^v\d+\.\d+\.\d+$/u);
		assert.deepEqual(run.typescript, { strict: true, executed: true });
		assert.equal(run.consumerSha256, sha256(consumer)); assert.equal(run.sourceSha256, sha256(source));
		assert.deepEqual(run.result, result);
		assert.deepEqual(run.documentation, { path: "docs/javascript-typescript.md"
			, sourceSha256: sha256(documentation)
			, stdout: "copied\n2\nleaf\n"
			, stderr: ""
			, executions: 2, installedPublicApi: true });
		assert.deepEqual(run.browsers.map(browser => browser.engine), structuredDocsCiScope.browsers);
		for(const browser of run.browsers)
		{
			assert.match(browser.version, /^\d+/u);
			assert.deepEqual(browser.result, { page: result, react: result, worker: result });
		}
		const receipt = run.receipt;
		assert.equal(receipt.kind, "lean-bridge-component-package-receipt");
		assert.equal(receipt.component.name, "structured");
		for(const field of ["bindingIrSha256", "componentArtifactSha256", "componentBundleSha256", "componentIdentitySha256", "provenanceSha256", "runtimeRequirementSha256"])
			assert.match(receipt[field], /^[a-f0-9]{64}$/u);
		for(const artifact of [receipt.package, receipt.runtime])
		{
			assert.match(artifact.sha256, /^[a-f0-9]{64}$/u);
			assert.match(artifact.archive, /^[^/]+\.tgz$/u);
		}
		assert.equal(receipt.policies.runtimeBinaryInComponent, false);
		assert.equal(receipt.policies.runtimeShared, true);
	}
	const [ordinary, reviewed] = record.report.runs;
	assert.equal(ordinary.receipt.componentArtifactSha256, reviewed.receipt.componentArtifactSha256);
	assert.equal(ordinary.receipt.runtime.sha256, reviewed.receipt.runtime.sha256);
	assert.notEqual(ordinary.receipt.bindingIrSha256, reviewed.receipt.bindingIrSha256);
};
