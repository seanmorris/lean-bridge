/**
 * Authenticate the PHP integration's filtered Perl builder repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { reversePhpNixBoundaryUpdate } from "./php-nix-boundary-repair-history.mjs";

export const phpNixBoundaryManifest = "nix/perl-engine-source-boundary.json";
export const phpNixBoundaryModules = [
	"src/backends/php/owned-assets.mjs"
	, "src/backends/php/owned-call-runtime.mjs"
	, "src/backends/php/owned-calls.mjs"
	, "src/backends/php/owned-conversion-support.mjs"
	, "src/backends/php/owned-conversion-transfer.mjs"
	, "src/backends/php/owned-conversions.mjs"
	, "src/backends/php/owned-integers.mjs"
	, "src/backends/php/owned-package.mjs"
	, "src/backends/php/owned-runtime.mjs"
	, "src/backends/php/owned-value-resources.mjs"
	, "src/backends/php/owned-value-walk.mjs"
	, "src/backends/php/owned-values.mjs"
	, "src/build/owned-php-artifacts.mjs"
	, "src/build/owned-php-projection.mjs"
	, "src/release/owned-composer.mjs"
];
const reproducer = "node --test --test-name-pattern='Nix Perl source boundary|filtered Perl engine loads' tests/perl-contract.test.mjs";
export const phpNixBoundaryCommands = { before: reproducer, after: reproducer
	, contracts: "node --test tests/perl-contract.test.mjs" };
export const phpNixBoundaryScope = {
	profile: "nix-perl-build-engine", addedFiles: 15
	, sourceClosure: true, filteredNodeImport: true, missingModuleControl: true
	, nixBuild: false, installedPackage: false, promotedCells: 0
};

/**
 * Check all declared imports instead of checking only the first missing module.
 *
 * @param boundary - Exact source filter used by the Nix engine.
 */
export const assertPhpNixImportClosure = async boundary => {
	const paths = new Set(boundary.includedFiles.map(path => resolve(path)));
	assert.equal(paths.size, boundary.includedFiles.length);
	for(const path of boundary.includedFiles)
	{
		const source = await readFile(path, "utf8");
		if(!path.endsWith(".mjs")) continue;
		for(const match of source.matchAll(/from\s+["'](\.[^"']+)["']/gu))
			assert.ok(paths.has(resolve(dirname(path), match[1])), `${path}: ${match[1]}`);
	}
};

/**
 * Bind the exact manifest delta and terminal failure/pass observations.
 *
 * @param record - Source-bound repair receipt, not an installed package claim.
 */
export const assertPhpNixBoundaryExecution = async record => {
	assert.deepEqual(record.scope, phpNixBoundaryScope);
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.addedFiles, phpNixBoundaryModules);
	assert.deepEqual(Object.keys(record.runs).sort(), ["after", "before", "contracts"]);
	for(const [name, command] of Object.entries(phpNixBoundaryCommands))
	{
		const run = record.runs[name], failed = name === "before", tests = name === "contracts" ? 48 : 2;
		assert.equal(run.command, command); assert.equal(run.exitCode, failed ? 1 : 0);
		assert.equal(run.sha256, sha256(run.text));
		for(const [key, value] of Object.entries({ tests, pass: failed ? 0 : tests, fail: failed ? tests : 0, cancelled: 0, skipped: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		for(const label of [
			"the Nix Perl source boundary includes the complete import and template closure"
			, "the filtered Perl engine loads without undeclared checkout modules"
		]) assert.match(run.text, new RegExp("^" + (failed ? "not ok" : "ok") + " \\d+ - " + label + "$", "mu"));
		if(failed)
		{
			assert.ok(run.text.includes("src/build/native-c-projection.mjs: ./owned-php-projection.mjs"));
			assert.ok(run.text.includes("ERR_MODULE_NOT_FOUND"));
			assert.ok(run.text.includes("/src/backends/php/owned-package.mjs"));
		}
		else assert.doesNotMatch(run.text, /^not ok|# SKIP/mu);
	}
	const source = await readFile(phpNixBoundaryManifest, "utf8"), boundary = JSON.parse(source);
	assert.equal(sha256(source), record.sources[phpNixBoundaryManifest]);
	assert.deepEqual(record.boundary, boundary);
	const update = record.updates.find(item => item.path === phpNixBoundaryManifest);
	assert.ok(update);
	const prior = JSON.parse(reversePhpNixBoundaryUpdate(source, update));
	assert.deepEqual({ ...boundary, includedFiles: prior.includedFiles }, prior);
	assert.deepEqual(boundary.includedFiles.filter(path => !prior.includedFiles.includes(path)), phpNixBoundaryModules);
	assert.deepEqual(boundary.includedFiles.filter(path => !phpNixBoundaryModules.includes(path)), prior.includedFiles);
	for(const path of phpNixBoundaryModules) assert.equal(sha256(await readFile(path)), record.sources[path], path);
	await assertPhpNixImportClosure(boundary);
};
