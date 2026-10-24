/**
 * Replay original C++ callback observations without rebuilding installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedCppCallbackReport } from "./owned-cpp-callback-result-evidence.mjs";
import {
	ownedCppCallbackProducer, ownedCppCallbackProducerEntries
	, ownedCppCallbackProducerAssets, ownedCppCallbackProducerClosure, ownedCppCallbackReplay
} from "./owned-cpp-callback-result-replay.mjs";

let retained;
const record = async () => {
	if(retained) return retained;
	const bytes = await readFile("docs/evidence/owned-cpp-callback-results-20261002.json");
	assert.equal(sha256(bytes), "c73d31a18b168626bca6e1087b485f4af4b39b86bb7d110e1429aea6b13009a7");
	const value = JSON.parse(bytes);
	retained = { ...value, reports: unpackOwnedCallbackReports(value.archive) };
	return retained;
};

test("C++ callback replay binds every imported producer and fixture source", async () => {
	const { sources } = await record();
	assert.equal(ownedCppCallbackProducer, "93589825d4b4c028724390e4c8d886213cbc92d8");
	assert.equal(ownedCppCallbackProducerEntries.length, 6);
	const closure = ownedCppCallbackProducerClosure(sources);
	assert.deepEqual(closure, [...new Set(closure)].sort());
	assert.equal(closure.length, 87);
	assert.deepEqual(ownedCppCallbackProducerAssets, {
		"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
	});
	for(const [path, digest] of Object.entries(ownedCppCallbackProducerAssets))
	{
		assert.ok(closure.includes(path), path);
		assert.equal(Object.hasOwn(sources, path), false);
		assert.throws(() => ownedCppCallbackProducerClosure({ ...sources, [path]: digest }));
		assert.throws(() => ownedCppCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	const modulePaths = [
		"src/build/native-graph-model.mjs", "src/analyze/callback-signature.mjs"
		, "src/backends/cpp/owned-callables.mjs"
		, "tests/helpers/owned-callback-result-fixture.mjs"
	];
	for(const path of modulePaths)
	{
		assert.ok(closure.includes(path), path);
		const missing = { ...sources }; delete missing[path];
		assert.throws(() => ownedCppCallbackProducerClosure(missing));
		assert.throws(() => ownedCppCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	await assert.rejects(ownedCppCallbackReplay(null));
});

test("C++ callback replay preserves live generation and authenticates deferred sources", async () => {
	const original = await record();
	const sources = { ...original.sources };
	const historical = await ownedCppCallbackReplay(sources);
	const fresh = await ownedCppCallbackReplay();
	assert.equal(fresh.createCompiledNativeModel, createCompiledNativeModel);
	assert.notEqual(historical.createCompiledNativeModel, fresh.createCompiledNativeModel);
	const deferredPaths = ["docs/consume/cpp.md", "docs/javascript-typescript.md"
		, "tests/fixtures/structured-types/owned-cpp-callback-results.cpp"];
	for(const path of deferredPaths)
	{
		const expected = sources[path];
		assert.equal(sha256(await historical.readSource(path)), expected);
		assert.equal(await fresh.readSource(path), await readFile(path, "utf8"));
		delete sources[path];
		await assert.rejects(historical.readSource(path));
		sources[path] = "0".repeat(64);
		await assert.rejects(historical.readSource(path));
		sources[path] = expected;
	}
	const license = original.reports["build/owned-cpp-callback-results/ordinary-combined-package.json"]
		.cli.files.find(file => file.path === "LICENSE");
	assert.equal(sources[license.path], undefined);
	await assert.rejects(historical.readSource(license.path));
	assert.equal(sha256(await historical.readSource(license.path, license.sha256)), license.sha256);
	await assert.rejects(historical.readSource(license.path, "0".repeat(64)));
	await assert.rejects(historical.readSource("docs/consume/cpp.md", "0".repeat(64)));
	const binary = original.reports["build/owned-cpp-callback-results/ordinary-combined-package.json"]
		.cli.files.find(file => file.path === "src/backends/c/gmp.source.tar.xz");
	const bytes = await historical.readBytes(binary.path, binary.sha256);
	assert.ok(Buffer.isBuffer(bytes));
	assert.equal(bytes.length, binary.bytes);
	assert.equal(sha256(bytes), binary.sha256);
	assert.notEqual(sha256(bytes.toString("utf8")), binary.sha256);
	assert.deepEqual(await fresh.readBytes(binary.path), await readFile(binary.path));
	await assert.rejects(historical.readBytes(binary.path, "0".repeat(64)));
});

const variants = ["base-host", "base-nohost", "combined"
	, "combined-package", "no-host-package", "combined-release"];
for(const mode of ["ordinary", "reviewed"])
	for(const variant of variants)
	{
		test("C++ original callback report: " + mode + "-" + variant, async () => {
			const original = await record();
			const path = "build/owned-cpp-callback-results/" + mode + "-" + variant + ".json";
			await assertOwnedCppCallbackReport(path, original.reports[path], original.sources);
		});
	}
