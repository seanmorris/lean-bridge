/**
 * Require actual offline owned WIT execution, loader rejection and mandatory CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedWitPackageCommand = "node --test --test-concurrency=1 tests/wit-owned-packaging.test.mjs";
export const ownedWitPackageScope = Object.freeze({
	installedPackages: true, ordinaryAndReviewed: true, compiledLean: true
	, generatedComponent: true, publicSession: true, hostCallbacks: true
	, nineteenScalars: true, recursiveResources: true, returnedLeanClosures: true
	, sourceFree: true, offline: true, relocated: true
	, deterministicReassembly: true, pkgConfig: true, cmake: true
	, fiveAuthenticatedDependencies: true, localAndGlobalLoading: true
	, compatibleDuplicates: true, inheritedAndFreshHostForkRejection: true
	, compiledDocumentation: true, transferredInputs: false
	, anchoredBorrowedResults: false, retainedHostCallbacks: false
	, asynchronousCallables: false, standaloneWasi: false
	, installedSupportPromotions: 0
});

/**
 * Check both source paths, installed package identities and every loader scenario.
 *
 * @param record - Immutable source-bound installed execution receipt.
 */
export const assertOwnedWitPackageExecution = record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitPackageScope);
	const run = record.run;
	assert.equal(run.command, ownedWitPackageCommand); assert.equal(run.exitCode, 0);
	assert.equal(sha256(run.text), run.sha256);
	for(const [key, count] of Object.entries({ tests: 6, pass: 6, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.installed.map(({ mode, fixture }) => [fixture, mode])
		, ["values", "callbacks", "scalars"].flatMap(fixture => ["ordinary", "reviewed"].map(mode => [fixture, mode])));
	for(const report of record.installed)
	{
		assert.equal(report.schemaVersion, 1); assert.ok(report.checks >= (report.fixture === "scalars" ? 100 : 300));
		assert.ok(run.text.includes(`${report.mode} ${report.fixture}: ${report.checks} independent installed checks; pkg-config and relocated CMake consumers passed`));
		for(const name of ["sourceRemoved", "producerRemoved", "handoffRemoved", "relocated", "deterministicReassembly", "pkgConfig", "cmake"])
			assert.equal(report[name], true, name);
		assert.equal(report.network, false);
		for(const name of ["bindingIrSha256", "runtimeIdentity"]) assert.match(report[name], /^[a-f0-9]{64}$/u);
		assert.equal(report.packages.length, 1); const pkg = report.packages[0];
		assert.equal(pkg.archive, `owned-${report.fixture}-1.2.3-wit-wasi.tar.gz`);
		assert.equal(pkg.name, `owned-${report.fixture}`); assert.equal(pkg.version, "1.2.3");
		assert.equal(pkg.compilerAccess, false); assert.ok(pkg.bytes > 0); assert.match(pkg.sha256, /^[a-f0-9]{64}$/u);
		const names = report.dependencies.map(item => item.name);
		assert.equal(names.length, 5); assert.equal(new Set(names).size, 5);
		assert.equal(names.filter(name => /^libcomponent_[a-f0-9]{20}\.so$/u.test(name)).length, 1);
		for(const name of ["libgmp.so.10", "liblean_bridge_native.so", "libleanshared.so", "libwasmtime.so"]) assert.ok(names.includes(name));
		for(const dependency of report.dependencies)
		{ assert.ok(Number.isSafeInteger(dependency.bytes) && dependency.bytes > 0); assert.match(dependency.sha256, /^[a-f0-9]{64}$/u); }
		if(report.fixture !== "values")
		{ assert.equal(report.loader, null); assert.equal(report.documentation, null); continue; }
		assert.equal(report.documentation.stdout, "42\n"); assert.match(report.documentation.sourceSha256, /^[a-f0-9]{64}$/u);
		const loader = report.loader;
		for(const name of ["sourceSha256", "executableSha256"]) assert.match(loader[name], /^[a-f0-9]{64}$/u);
		assert.equal(loader.reports.length, 12);
		for(const visibility of ["local", "global"])
		{
			const compatible = loader.reports.filter(item => item.visibility === visibility && item.compatibleAndFork);
			assert.equal(compatible.length, 1); assert.equal(compatible[0].conflict, false); assert.ok(compatible[0].checks > 10);
			for(const name of names)
			{
				const conflicts = loader.reports.filter(item => item.visibility === visibility && item.tamperedDependency === name);
				assert.equal(conflicts.length, 1); assert.equal(conflicts[0].conflict, true); assert.ok(conflicts[0].checks > 10);
			}
		}
	}
};

const step = (job, name) => {
	const value = job.split(`      - name: ${name}\n`)[1]?.split("      - name:")[0];
	assert.ok(value, name); return value;
};

/**
 * Require enabled installed execution, no-skip TAP, logs and failure propagation.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedWitPackageCi = workflow => {
	const job = workflow.split("  wasi-consumer:\n")[1]?.split("  docker-engine:\n")[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	const setup = step(job, "Compile ordinary Lean APIs and consume relocated WIT packages");
	assert.match(setup, /sudo apt-get install -y build-essential cmake pkg-config zstd ripgrep/u);
	const execute = step(job, "Install owned WIT packages without producer sources");
	assert.doesNotMatch(execute, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(execute, /^ {8}id: owned_wit_package$/mu);
	assert.match(execute, /^ {10}LEAN_BRIDGE_WIT_OWNED_PACKAGE_TEST: "1"$/mu);
	assert.equal(execute.split("        run: |\n")[1].trim().split("\n").map(line => line.trim()).join("\n"), [
		"set -euo pipefail"
		, 'export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"'
		, "source scripts/env.sh"
		, ownedWitPackageCommand + " 2>&1 | tee build/wit-owned-packaging.log"
		, "test -s build/wit-owned-packaging.log"
		, "rg '^# pass 6$' build/wit-owned-packaging.log"
		, "rg '^# fail 0$' build/wit-owned-packaging.log"
		, "rg '^# skipped 0$' build/wit-owned-packaging.log"
	].join("\n"));
	const upload = step(job, "Preserve owned WIT installed execution");
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {12}build\/wit-owned-packaging.log$/mu);
	assert.match(upload, /^ {12}build\/owned-wit-packaging\/\*.json$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	assert.doesNotMatch(upload, /^ {8}continue-on-error:/mu);
	assert.match(step(job, "Enforce WIT and WASI support"), /steps\.owned_wit_package\.outcome != 'success'/u);
	const observations = step(job, "Record WIT and WASI observations");
	for(const name of ["test_result", "executed"])
		assert.match(observations.split(`          ${name}=`)[1]?.split("\n")[0] ?? "", /steps\.owned_wit_package\.outcome == 'success'/u);
	assert.ok(workflow.split("  support-summary:\n")[1]?.split("    runs-on:")[0].includes("      - wasi-consumer\n"));
};
