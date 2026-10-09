/**
 * Reject altered compiler, installed-consumer and failure-history claims in the Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertWasmRefusalArchive, assertWasmRefusalRecords, wasmRefusalDirectory, wasmRefusalPaths } from "./reviewed-fin-wasm-refusal-evidence.mjs";

const receipt = async () => JSON.parse(await readFile(`${wasmRefusalDirectory}/receipt.json`));
const records = async () => {
	const json = async name => JSON.parse(await readFile(`${wasmRefusalDirectory}/${name}.json`));
	return { queue: await json("queue"), end: await json("end")
		, tap: await readFile(`${wasmRefusalDirectory}/run.tap`, "utf8")
		, failed: { queue: await json("failed/queue"), end: await json("failed/end"), tap: await readFile(`${wasmRefusalDirectory}/failed/run.tap`, "utf8") }
		, reports: [await json("reviewed-scalar"), await json("reviewed-structural")] };
};

test("Wasm refusal archive authenticates eighteen refusals, installed consumers and the original setup failure", async () => {
	const bytes = await readFile(`${wasmRefusalDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "c3675b75a5bde4ab7a91b86ba360abd468d26839f018bb2273c5f38f01d7d8af");
	const value = JSON.parse(bytes); await assertWasmRefusalArchive(value);
	assert.equal(value.artifacts.length, 25); assert.equal(value.sources.length, 13);
	assert.deepEqual(value.artifacts.map(file => file.path), wasmRefusalPaths);
});

test("Wasm refusal records reject forged compiler and package claims independently of original hashes", async () => {
	const original = await records(); assertWasmRefusalRecords(original);
	const mutations = [
		value => { value.privateAbi = 1; }
		, value => { value.independentBuilds = 1; }
		, value => { value.schemaVersion = 2; }
		, value => { value.path = "ordinary-source"; }
		, value => { value.refinements = {}; }
		, value => { value.mismatches.pop(); }
		, value => { value.mismatches.push(value.mismatches[0]); }
		, value => { value.mismatches[0].code = "invalid-reviewed-input"; }
		, value => { value.mismatches[0].fieldObserved = false; }
		, value => { value.mismatches[0].expectedField += ".other"; }
		, value => { value.mismatches[0].outputAbsent = false; }
		, value => { value.mismatches[0].reviewedSourceSha256 = "0".repeat(64); }
		, value => { value.mismatches[0].label = "invented mismatch"; }
		, value => { value.typescript.strict = false; }
		, value => { value.typescript.skipLibCheck = true; }
		, value => { value.typescript.declarationsSha256 = "0".repeat(64); }
		, value => { value.typescript.compilerSha256 = "0".repeat(64); }
		, value => { value.typescript.sourceSha256 = "0".repeat(64); }
		, value => { value.receipt.package.sha256 = "0".repeat(64); value.receiptSha256 = sha256(canonicalJson(value.receipt)); }
		, value => { value.entryCounterEvidence = true; }
	];
	for(const field of ["reproducible", "sourceRemovedBeforeInstallation", "compilerFreePath", "offlineInstall"])
		mutations.push(value => { value[field] = false; });
	for(const field of ["sourceSha256", "consumerSha256", "compilerSha256", "reviewedSourceSha256", "metadataSha256", "bindingIrSha256", "receiptSha256"])
		mutations.push(value => { value[field] = "0".repeat(64); });
	for(const index of [0, 1]) for(const mutate of mutations)
	{
		const value = structuredClone(original); mutate(value.reports[index]);
		assert.throws(() => assertWasmRefusalRecords(value));
	}
	for(const mutate of [value => value.reports.pop(), value => value.reports.reverse(), value => value.reports.push(value.reports[0])])
	{
		const value = structuredClone(original); mutate(value); assert.throws(() => assertWasmRefusalRecords(value));
	}
});

test("Wasm archive requires every Node and browser profile, engine, variant, asset and lifecycle observation", async () => {
	const original = await records();
	for(const index of [0, 1])
	{
		for(const mutate of [
			value => { value.executions.pop(); }
			, value => { value.executions[0].result.checks = 0; }
			, value => { value.executions[1].profile = "node-javascript"; }
			, value => { value.executions[0].hostVersion = "unknown"; }
			, value => { value.browser.pop(); }, value => { value.browser.reverse(); }
		]) {
			const value = structuredClone(original); mutate(value.reports[index]); assert.throws(() => assertWasmRefusalRecords(value));
		}
		for(const [profileIndex, { profile, browser }] of original.reports[index].browser.entries())
		{
			for(const mutate of [
				value => { value.requestedEngines.pop(); }
				, value => { value.externalNetworkBlocked = false; }
				, value => { value.installedSourcesRemoved = false; }
				, value => { value.executions.pop(); }
			]) {
				const value = structuredClone(original); mutate(value.reports[index].browser[profileIndex].browser);
				assert.throws(() => assertWasmRefusalRecords(value));
			}
			for(const executionIndex of browser.executions.keys())
			{
				const mutations = [
					value => { value.engine = "unknown"; }
					, value => { value.variant = "unknown"; }
					, value => { value.observation.results.rejections = 0; }
					, value => { value.observation.profile = "unknown"; }
					, value => { value.observation.realm = "unknown"; }
					, value => { value.observation.hostVersion = ""; }
					, value => { value.failedAssetRecovery = false; }
					, value => { value.assets = []; }
					, value => { value.assets[0].sha256 = "0".repeat(64); }
					, value => { value.assets[0].status = 404; }
					, value => { value.assets[0].mime = "text/html"; }
					, value => { value.assets[0].bytes = 0; }
					, value => { value.assets[0].path = "/foreign/main.wasm"; }
				];
				if(profile === "browser-react") mutations.push(value => { value.pendingUnmount = false; });
				if(profile === "browser-worker") mutations.push(value => { value.lifecycle.live = 1; });
				for(const mutate of mutations)
				{
					const value = structuredClone(original); mutate(value.reports[index].browser[profileIndex].browser.executions[executionIndex]);
					assert.throws(() => assertWasmRefusalRecords(value));
				}
			}
		}
	}
});

test("Wasm archive distinguishes the failed setup from the successful retry and requires unskipped transcripts", async () => {
	const original = await records();
	for(const failed of [false, true])
	{
		for(const mutate of [
			value => { value.queue.revision = "0".repeat(40); }
			, value => { value.queue.sources = {}; }
			, value => { value.queue.environment.LEAN_BRIDGE_REVIEWED_FIN_WASM_BROWSER_TEST = "0"; }
			, value => { value.queue.environment.LEAN_BRIDGE_RUNTIME_ROOT = "/unverified"; }
			, value => { value.queue.command = ["node", "--test"]; }
			, value => { value.queue.runtimeInputs = {}; }
			, value => { value.queue.lean = "unverified"; }
			, value => { value.queue.runnerSha256 = "0".repeat(64); }
			, value => { value.end.code = failed ? 0 : 1; }
			, value => { value.end.signal = "SIGTERM"; }
			, value => { value.end.stoppedForDisk = true; }
			, value => { value.end.minimumFreeMiB = 0; }
		]) {
			const value = structuredClone(original); mutate(failed ? value.failed : value); assert.throws(() => assertWasmRefusalRecords(value));
		}
		for(const [before, after] of [
			["# skipped 0", "# skipped 1"]
			, ["# cancelled 0", "# cancelled 1"], ["1..2", "1..1"]
			, ["1 - independently reviewed scalar Fin runs in source-free installed npm packages\n", "1 - independently reviewed scalar Fin runs in source-free installed npm packages # SKIP\n"]
			, failed ? ["code: 'shared-runtime-headers-unavailable'", "code: 'unrelated-failure'"] : ["ok 1 -", "not ok 1 -"]
		]) {
			const value = structuredClone(original), attempt = failed ? value.failed : value;
			const previous = attempt.tap; attempt.tap = previous.replace(before, after); assert.notEqual(attempt.tap, previous);
			attempt.end.tapSha256 = sha256(attempt.tap); assert.throws(() => assertWasmRefusalRecords(value));
		}
	}
});

test("Wasm refusal archive rejects widened scope or foreign paths before opening any artifact", async () => {
	const original = await receipt();
	for(const mutate of [
		value => { value.artifacts[0].path = "../../outside.json"; }
		, value => { value.artifacts[0].path = "/tmp/outside.json"; }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.artifacts.reverse(); }
		, value => { value.scope.hostedCi = true; }
		, value => { value.scope.lockedNix = true; }
		, value => { value.scope.entryCounterEvidence = true; }
		, value => { value.scope.failedAttempts = 0; }
		, value => { value.scope.browserExecutions = 30; }
		, value => { value.sources.pop(); }
	]) {
		const value = structuredClone(original); mutate(value); let reads = 0;
		await assert.rejects(() => assertWasmRefusalArchive(value, async path => { reads++; return readFile(path); })); assert.equal(reads, 0);
	}
});

test("Wasm refusal archive rejects altered or rehashed artifacts and changed provenance", async () => {
	const original = await receipt();
	for(const selected of original.artifacts)
	{
		const changed = Buffer.from(await readFile(selected.path)); changed[0] ^= 1;
		const read = path => path === selected.path ? Promise.resolve(changed) : readFile(path);
		await assert.rejects(() => assertWasmRefusalArchive(original, read));
		const value = structuredClone(original); value.artifacts.find(file => file.path === selected.path).sha256 = sha256(changed);
		await assert.rejects(() => assertWasmRefusalArchive(value, read));
	}
	for(const mutate of [
		value => { value.artifacts[0].originalPath = "invented/queue.json"; }
		, value => { value.artifacts[0].bytes--; }
		, value => { value.artifacts.at(-1).originalPath = "git:unknown:source.mjs"; }
	]) {
		const value = structuredClone(original); mutate(value); await assert.rejects(() => assertWasmRefusalArchive(value));
	}
});
