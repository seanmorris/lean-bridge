/**
 * Require reproduced owned WIT regressions and the complete filtered imports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpNixImportClosure } from "./php-nix-boundary-repair-evidence.mjs";
import { reverseOwnedWitBuildRepairUpdate } from "./wit-owned-build-repair-history.mjs";
import { beforeOwnedTransferC } from "./owned-transfer-c-history.mjs";

export const ownedWitBuildRepairManifest = "nix/perl-engine-source-boundary.json";
export const ownedWitBuildRepairModules = [
	"src/backends/wit/owned-graph-conversions.mjs"
	, "src/backends/wit/owned-graph-model.mjs"
	, "src/backends/wit/owned-graph-runtime.mjs"
	, "src/backends/wit/owned-graph-types.mjs"
	, "src/backends/wit/owned-host-evidence.mjs"
	, "src/backends/wit/owned-native-host.mjs"
	, "src/backends/wit/owned-native-resources.mjs"
	, "src/backends/wit/owned-package.mjs"
	, "src/backends/wit/owned-session.mjs"
	, "src/build/owned-wit-artifacts.mjs", "src/build/owned-wit-projection.mjs"
	, "src/release/owned-wasi.mjs"
];
const reproducer = "node --test --test-name-pattern='owned npm dispatch|ownership reaches|Nix Perl source boundary|filtered Perl engine loads|filtered Perl source closure|filtered Perl engine retains package-set' tests/owned-javascript-cli.test.mjs tests/owned-php-wasm-cli.test.mjs tests/perl-contract.test.mjs tests/php-nix-boundary-repair-evidence.test.mjs tests/toolchain-preflight.test.mjs";
export const ownedWitBuildRepairCommands = {
	before: reproducer, after: reproducer
	, contracts: "node --test tests/perl-contract.test.mjs tests/owned-javascript-cli.test.mjs tests/owned-php-wasm-cli.test.mjs tests/toolchain-preflight.test.mjs" };
export const ownedWitBuildRepairScope = Object.freeze({
	mixedTargetAdmission: true, sourceClosure: true, filteredNodeImport: true
	, missingModuleControls: true, addedModules: 12, reproducedFailures: 8
	, nixBuild: false, installedPackage: false, transferredInputs: false
	, anchoredBorrowedResults: false, installedSupportPromotions: 0
});

/**
 * Check the exact manifest delta and all failed/passing observations.
 *
 * @param record - Source-bound repair receipt, not a new installed support claim.
 */
export const assertOwnedWitBuildRepairExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitBuildRepairScope);
	assert.deepEqual(record.addedFiles, ownedWitBuildRepairModules);
	assert.deepEqual(Object.keys(record.runs).sort(), ["after", "before", "contracts"]);
	for(const [name, command] of Object.entries(ownedWitBuildRepairCommands))
	{
		const run = record.runs[name], failed = name === "before", contracts = name === "contracts";
		assert.equal(run.command, command); assert.equal(run.exitCode, failed ? 1 : 0);
		assert.equal(sha256(run.text), run.sha256);
		for(const [key, count] of Object.entries({ tests: contracts ? 62 : 8
			, pass: failed ? 0 : contracts ? 61 : 8
			, fail: failed ? 8 : 0, cancelled: 0, skipped: contracts ? 1 : 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
		if(failed)
		{
			assert.equal([...run.text.matchAll(/^not ok \d+ - /gmu)].length, 8);
			for(const text of ["Missing owned JavaScript build input: LEAN_BRIDGE_JS_EMSDK"
				, "ENOENT", "ERR_MODULE_NOT_FOUND"
				, "src/build/native-c-projection.mjs: ./owned-wit-projection.mjs"
				, "/src/backends/wit/owned-graph-model.mjs"])
				assert.ok(run.text.includes(text), text);
		}
		else assert.doesNotMatch(run.text, /^not ok|# TODO/mu);
		if(!contracts) assert.doesNotMatch(run.text, /# SKIP/u);
		else
		{
			const skipped = run.text.split("\n").filter(line => line.includes("# SKIP"));
			assert.equal(skipped.length, 1);
			assert.match(skipped[0], /installed CLI builds ordinary and reviewed owned npm packages from bundled headers/u);
		}
	}
	const current = await readFile(ownedWitBuildRepairManifest, "utf8");
	const source = beforeOwnedTransferC(ownedWitBuildRepairManifest, current), boundary = JSON.parse(source);
	assert.equal(sha256(source), record.sources[ownedWitBuildRepairManifest]);
	assert.deepEqual(boundary, record.boundary);
	const update = record.updates.find(item => item.path === ownedWitBuildRepairManifest);
	assert.ok(update); const previous = JSON.parse(reverseOwnedWitBuildRepairUpdate(source, update));
	assert.deepEqual({ ...boundary, includedFiles: previous.includedFiles }, previous);
	assert.deepEqual(boundary.includedFiles.filter(path => !previous.includedFiles.includes(path)), ownedWitBuildRepairModules);
	assert.deepEqual(boundary.includedFiles.filter(path => !ownedWitBuildRepairModules.includes(path)), previous.includedFiles);
	for(const path of ownedWitBuildRepairModules)
		assert.equal(sha256(beforeOwnedTransferC(path, await readFile(path, "utf8"), record.sources[path])), record.sources[path], path);
	await assertPhpNixImportClosure(JSON.parse(current));
};
