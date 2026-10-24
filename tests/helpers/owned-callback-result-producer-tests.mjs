/**
 * Authenticate callback generator replay without installed builds or CLI history walks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import {
	ownedCallbackResultProducer, ownedCallbackResultProducerClosure
	, ownedCallbackResultProducerEntries, ownedCallbackResultReplay
} from "./owned-callback-result-producer.mjs";

const record = async () => {
	const bytes = await readFile("docs/evidence/owned-callback-results-20261002.json");
	assert.equal(sha256(bytes), "f1e30c443a9f0b6c34035008cb5f7831a646b6f49f038d0ccbfa4edc440adb75");
	return JSON.parse(bytes);
};
const options = (hostCallbacks = true, combined = false) => ({
	hostCallbacks, callbackResultAnchors: true
	, anchoredResults: combined
	, receiverExports: combined
	, transferredInputs: combined
});
const nativeOptions = (hostCallbacks = true, combined = false) => ({
	ownedGraphs: true
	, ownedHostCallbacks: hostCallbacks
	, ownedCallbackResultAnchors: true
	, ownedAnchoredResults: combined
	, ownedReceiverExports: combined
	, ownedInputTransfers: combined
});

test("callback producer replay authenticates all 138 imported sources", async () => {
	const { sources } = await record();
	assert.equal(ownedCallbackResultProducer, "44c6789c830869b9923245cb38c29d4215da1433");
	assert.equal(ownedCallbackResultProducerEntries.length, 9);
	const closure = ownedCallbackResultProducerClosure(sources);
	assert.equal(closure.length, 138);
	assert.deepEqual(closure, [...new Set(closure)].sort());
	const refusalPaths = [
		"src/build/native-graph-model.mjs", "src/analyze/callback-signature.mjs"
		, "tests/helpers/owned-javascript-wasm-native.mjs"
		, "tests/helpers/owned-callback-result-fixture.mjs"
	];
	for(const path of refusalPaths)
	{
		assert.ok(closure.includes(path), path);
		const missing = { ...sources }; delete missing[path];
		assert.throws(() => ownedCallbackResultProducerClosure(missing));
		assert.throws(() => ownedCallbackResultProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
});

test("callback producer replay reproduces native and Wasm models, adapters and public packages", async () => {
	const retained = await record(), reports = unpackOwnedCallbackReports(retained.archive);
	const replay = await ownedCallbackResultReplay(retained.sources);
	const get = name => reports[`build/owned-callback-results/${name}.json`];
	const checkWasm = (item, input, inventory, name, combined) => {
		const model = replay.createOwnedJavaScriptWasmModel({ ...input, ...options(true, combined) });
		assert.deepEqual(model, item.model);
		const adapters = replay.generateOwnedJavaScriptWasmLeanAdapters(model);
		const generated = replay.generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters);
		assert.deepEqual(generated.receipt, item.receipt.ownedGraph);
		const files = replay.generateJavaScriptPackage(model.bindingIr);
		for(const path of ["index.mjs", "index.d.ts"])
			assert.equal(sha256(files[path]), inventory[`${name}/${path}`].sha256);
	};
	for(const mode of ["ordinary", "reviewed"])
	{
		const metadata = get(`metadata-${mode}`);
		for(const [index, model] of metadata.models.entries())
			assert.deepEqual(replay.createCompiledNativeModel(metadata.input, nativeOptions(Boolean(index))), model);
		for(const callbacks of [false, true])
		{
			const runtime = get(`runtime-${mode}-${callbacks}`);
			assert.equal(sha256(replay.generateOwnedCPackage(runtime.input).source), runtime.sourceSha256);
			const wasm = get(`wasm-${mode}-${callbacks}`);
			const native = replay.generateOwnedNativeValueAdapters({ ...wasm.input, wordBits: 32, ...options(callbacks) });
			const component = replay.generateOwnedWasmComponent(native);
			assert.deepEqual(component.privateAbi, wasm.privateAbi);
			assert.equal(sha256(replay.ownedJavaScriptWasmNativeProbe(component)), wasm.sourceSha256);
		}
		const c = get(`${mode}-c-package`), combined = get(`${mode}-combined-package`);
		const nativePackages = [
			[c, c.model
			, { metadata: c.metadata, sourceIdentity: c.model.sourceIdentity
				, component: c.model.component }
				, c.receipt, false]
			, [combined, combined.native.model, combined.nativeInput, combined.native.receipt, true]
		];
		for(const [item, model, input, receipt, combinedMode] of nativePackages)
		{
			assert.deepEqual(replay.createCompiledNativeModel({ ...input, moduleName: model.moduleName }
				, nativeOptions(true, combinedMode)), model);
			const adapters = replay.generateCompiledNativeLeanAdapters(model);
			assert.equal(sha256(adapters.header), receipt.headerSha256);
			assert.equal(sha256(adapters.leanSource), receipt.adaptersSha256);
			assert.equal(sha256(adapters.callbackSource), receipt.callbackSourceSha256);
			const generated = replay.generateOwnedCPackage({ ...input, ...options(true, combinedMode) });
			assert.equal(sha256(generated.publicHeader), item.manifest.ownedValues.headerSha256);
			assert.equal(sha256(generated.source), item.manifest.ownedValues.sourceSha256);
		}
		checkWasm(combined.wasm, combined.wasmInput, combined.inventory
			, `@owned/${mode}-callback-combinations`, true);
	}
	for(const item of get("npm-package").reports)
		checkWasm(item, item.input, item.inventory
			, `@owned/${item.reviewed ? "reviewed" : "ordinary"}-callback-results`, false);
});

test("callback replay keeps fresh generators live and authenticates deferred historical reads", async () => {
	const retained = await record(), sources = { ...retained.sources };
	const historical = await ownedCallbackResultReplay(sources);
	const fresh = await ownedCallbackResultReplay();
	assert.equal(fresh.createCompiledNativeModel, createCompiledNativeModel);
	assert.notEqual(historical.createCompiledNativeModel, fresh.createCompiledNativeModel);
	const deferredPaths = [
		"docs/javascript-typescript.md", "src/release/owned-wasm-callbacks.mjs"
		, "tests/fixtures/onboarding/owned-aggregates/Owned.lean"
		, "tests/fixtures/structured-types/owned-callback-results.c"
	];
	for(const path of deferredPaths)
	{
		const original = await historical.readSource(path);
		assert.equal(sha256(original), retained.sources[path], path);
		assert.equal(await fresh.readSource(path), await readFile(path, "utf8"), path);
		delete sources[path];
		await assert.rejects(historical.readSource(path));
		sources[path] = "0".repeat(64);
		await assert.rejects(historical.readSource(path));
		sources[path] = retained.sources[path];
		assert.equal(await historical.readSource(path), original, path);
	}
	assert.equal(sha256(canonicalJson(retained.sources)), sha256(canonicalJson(sources)));
	await assert.rejects(ownedCallbackResultReplay(null));
});
