/**
 * Source-bound C# loader evidence retains its process and package boundaries.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedAggregateCarriers } from "../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedDotnetPackage } from "../src/backends/dotnet/owned-package.mjs";
import { beforeOwnedDotnetProcessGenerated, ownedDotnetProcessHistoricalBytes } from "./helpers/owned-dotnet-process-history.mjs";

const verify = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-dotnet-loading-execution");
	assert.deepEqual(record.scope, { compiledLean: true, authenticatedLoading: true
		, privateGmp: true, sourceFreeExecution: true, relocatedExecution: true
		, defaultClrProtections: true, preparedForkProbe: true
		, installedNuget: false, typeSurfacePromotions: 0 });
	for(const [name, digest] of [
		["foundation", "4047eea1ec19c9179ac8b8d954beb9b8f0d3791c101251ca1625873f79eab77c"]
		, ["callbacks", "d433d2b37afbec89f3b36a399444021d323872a4ecb1f44bd6a8777fbbbef44f"]
	]) {
		const entry = record[name];
		assert.equal(entry.path, `docs/evidence/owned-dotnet-${name}-20260927.json`);
		const bytes = await readFile(entry.path);
		assert.equal(bytes.length, entry.bytes); assert.equal(entry.sha256, digest);
		assert.equal(sha256(bytes), digest);
	}
	assert.equal(record.sources.length, 124);
	assert.equal(new Set(record.sources.map(item => item.path)).size, 124);
	for(const entry of record.sources)
	{
		assert.match(entry.path, /^(?:src|tests)\/[A-Za-z0-9_./-]+$/u);
		assert.ok(!entry.path.includes(".."));
		const bytes = ownedDotnetProcessHistoricalBytes(entry.path, await readFile(entry.path), entry.sha256);
		assert.equal(Buffer.byteLength(bytes), entry.bytes); assert.equal(sha256(bytes), entry.sha256, entry.path);
	}
	assert.equal(record.commands.length, 2);
	for(const [index, entry] of record.commands.entries())
	{
		assert.equal(entry.exitCode, 0); assert.equal(sha256(entry.stdout), entry.sha256);
		if(index === 0) assert.ok(entry.stdout.includes("# tests 3\n# suites 0\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n"));
		else assert.equal(entry.stdout, "");
	}
	const foundation = JSON.parse(await readFile(record.foundation.path));
	assert.equal(record.reports.length, 2);
	for(const reviewed of [false, true])
	{
		const entry = record.reports.find(item => item.path === `build/owned-dotnet-loading/${reviewed ? "reviewed" : "ordinary"}.json`);
		assert.ok(entry);
		const source = canonicalJson(entry.report), report = entry.report;
		assert.equal(Buffer.byteLength(source), entry.bytes); assert.equal(sha256(source), entry.sha256);
		const input = foundation.compilerInputs.find(item => item.path === `build/owned-aggregate-native/owned-cpp-composition${reviewed ? "-reviewed" : ""}-callbacks-inputs.json`).input;
		const generated = generateOwnedAggregateCarriers({ ...input, hostCallbacks: true });
		const model = generateOwnedDotnetPackage(generated.model.bindingIr, report.evidence);
		assert.deepEqual(report.contract, model.contract);
		assert.deepEqual(report.generatedFiles, Object.fromEntries(Object.entries(model.files).map(([path, text]) =>
			[path, sha256(beforeOwnedDotnetProcessGenerated(path, text, report.generatedFiles[path]))])));
		assert.equal(report.evidence.componentReceiptSha256, sha256(canonicalJson({ sourceIdentity: input.sourceIdentity, metadata: input.metadata })));
		assert.equal(report.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-dotnet-loading.cs")));
		assert.deepEqual(report.observation, { checks: 167, privateGmp: true, forkBeforeLock: true, identities: 0 });
		for(const field of ["compiledLean", "compilerWorkspaceRemoved"
			, "managedSourcesRemoved", "relocated", "rejectsTamperedLibrary"
			, "rejectsSymlinkLibrary", "rejectsSymlinkDirectory"
			, "rejectsUnverifiedPreload", "rejectsRuntimeConflict"
			, "rejectsComponentConflict"])
			assert.equal(report[field], true, field);
		assert.equal(report.installedNuget, false);
	}
};

test("owned C# loading evidence rejects missing checks and broader package claims", async () => {
	const record = JSON.parse(await readFile("docs/evidence/owned-dotnet-loading-20260927.json"));
	await verify(record);
	for(const mutate of [
		value => { value.scope.installedNuget = true; }
		, value => { value.scope.defaultClrProtections = false; }
		, value => { value.reports.pop(); }
		, value => { value.reports[0].report.observation.identities = 1; }
		, value => { value.reports[0].report.rejectsUnverifiedPreload = false; }
		, value => { value.reports[0].report.rejectsSymlinkDirectory = false; }
		, value => { value.reports[0].report.contract.gmp = "libgmp.so.10"; }
		, value => { value.sources[0].sha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		for(const entry of changed.reports)
		{
			const source = canonicalJson(entry.report);
			entry.bytes = Buffer.byteLength(source); entry.sha256 = sha256(source);
		}
		await assert.rejects(() => verify(changed));
	}
});
