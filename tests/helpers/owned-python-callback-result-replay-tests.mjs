/**
 * Replay retained Python callback evidence without compilers or consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedPythonCallbackReport } from "./owned-python-callback-result-acceptance.mjs";
import {
	ownedPythonCallbackProducer, ownedPythonCallbackProducerEntries
	, ownedPythonCallbackProducerAssets, ownedPythonCallbackProducerClosure
	, ownedPythonCallbackReplay
} from "./owned-python-callback-result-replay.mjs";

let retained;
const record = async () => {
	if(retained) return retained;
	const bytes = await readFile("docs/evidence/owned-python-callback-results-20261002.json");
	assert.equal(bytes.length, 13998907);
	assert.equal(sha256(bytes), "bacc96203e87a436bca197d4cf8a34b51780a8fee0a4f2e74500429a6aa5e471");
	const value = JSON.parse(bytes);
	retained = { ...value, reports: unpackOwnedCallbackReports(value.archive) };
	assert.equal(Object.keys(retained.reports).length, 13);
	return retained;
};
let selected;
const replay = async () => selected ??= await ownedPythonCallbackReplay((await record()).sources);

test("Python replay authenticates all 135 imports and refuses altered source identities", async () => {
	const { sources } = await record();
	assert.equal(ownedPythonCallbackProducer, "0fc33e4fd17f3347d845847f284709208ada1c9e");
	assert.equal(ownedPythonCallbackProducerEntries.length, 17);
	const closure = ownedPythonCallbackProducerClosure(sources);
	assert.deepEqual(closure, [...new Set(closure)].sort());
	assert.equal(closure.length, 135);
	for(const path of ownedPythonCallbackProducerEntries) assert.ok(closure.includes(path), path);
	assert.deepEqual(ownedPythonCallbackProducerAssets, {
		"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
		, LICENSE: "0228993956219f4b7635fc90bdd7e8713e47973c34b0de1f19f8225ec8907996"
	});
	const paths = ["src/build/native-graph-model.mjs"
		, "src/backends/c/owned-package.mjs"
		, "src/backends/python/owned-callables.mjs"
		, "tests/helpers/owned-python-callback-result-fixture.mjs"];
	for(const path of paths)
	{
		assert.ok(closure.includes(path), path);
		const missing = { ...sources }; delete missing[path];
		assert.throws(() => ownedPythonCallbackProducerClosure(missing));
		assert.throws(() => ownedPythonCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	const boost = "src/backends/cpp/boost.source.json";
	assert.ok(closure.includes(boost));
	assert.equal(Object.hasOwn(sources, boost), false);
	assert.throws(() => ownedPythonCallbackProducerClosure({ ...sources, [boost]: "0".repeat(64) }));
	await assert.rejects(ownedPythonCallbackReplay(null));
});

test("Python replay preserves live generation and authenticates deferred text and binary inputs", async () => {
	const original = await record();
	const sources = { ...original.sources };
	const historical = await ownedPythonCallbackReplay(sources);
	const fresh = await ownedPythonCallbackReplay();
	assert.equal(fresh.createCompiledNativeModel, createCompiledNativeModel);
	assert.equal(fresh.generateOwnedPythonPackage, generateOwnedPythonPackage);
	assert.notEqual(historical.createCompiledNativeModel, fresh.createCompiledNativeModel);
	assert.notEqual(historical.generateOwnedPythonPackage, fresh.generateOwnedPythonPackage);
	const paths = ["docs/consume/python.md", "docs/publish/pypi.md"
		, "tests/fixtures/structured-types/owned-python-callback-results.py"];
	for(const path of paths)
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
	const pkg = original.reports["build/owned-python-callback-results/ordinary-combined-package.json"];
	assert.equal(sha256(await historical.ownedPythonCallbackInstalledProbe(true)), pkg.consumerSha256);
	for(const path of ["LICENSE", "src/backends/c/gmp.source.tar.xz"])
	{
		const file = pkg.cli.files.find(file => file.path === path);
		const bytes = await historical.readBytes(path, file.sha256);
		assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes);
		assert.equal(sha256(bytes), file.sha256);
		assert.deepEqual(await fresh.readBytes(path), await readFile(path));
		await assert.rejects(historical.readBytes(path, "0".repeat(64)));
		if(path.endsWith(".xz")) assert.notEqual(sha256(bytes.toString("utf8")), file.sha256);
	}
	const license = "LICENSE";
	await assert.rejects((await ownedPythonCallbackReplay({
		...original.sources, [license]: ownedPythonCallbackProducerAssets[license]
	})).readBytes(license));
});

const cases = ["ordinary", "reviewed"].flatMap(mode => [
	...["combined", "host", "no-host"].map(variant => ["runtime", "runtime-" + mode + "-" + variant])
	, ...["combined", "no-host"].map(variant => ["package", mode + "-" + variant + "-package"])
	, ["release", mode + "-combined-release"]
]);
cases.push(["typing", "typing"]);
for(const [kind, name] of cases)
	test("Python retained " + kind + ": " + name, async () => {
		const original = await record();
		const path = "build/owned-python-callback-results/" + name + ".json";
		await assertOwnedPythonCallbackReport(path, original.reports[path], await replay());
	});
