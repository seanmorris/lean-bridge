/**
 * Replay original JVM callbacks with current assertions and original generators.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedJvmCallbackReport } from "./owned-jvm-callback-result-acceptance.mjs";
import { ownedJvmCallbackResultReports } from "./owned-jvm-callback-result-ci.mjs";
import {
	ownedJvmCallbackProducer, ownedJvmCallbackProducerEntries
	, ownedJvmCallbackProducerAssets, ownedJvmCallbackProducerClosure
	, ownedJvmCallbackReplay
} from "./owned-jvm-callback-result-replay.mjs";

let retained;
const record = async () => {
	if(retained) return retained;
	const bytes = await readFile("docs/evidence/owned-jvm-callback-results-20261003.json");
	assert.equal(bytes.length, 22865011);
	assert.equal(sha256(bytes), "ce3855e16ac23fed6c437def1c09a9c27c7c3ac54c2d3298141bad60c78d3310");
	const value = JSON.parse(bytes);
	retained = { ...value, reports: unpackOwnedCallbackReports(value.archive) };
	assert.equal(Object.keys(retained.reports).length, 24);
	assert.deepEqual(Object.keys(retained.reports).sort(), [...ownedJvmCallbackResultReports].sort());
	return retained;
};
let selected;
const replay = async () => selected ??= await ownedJvmCallbackReplay((await record()).sources);

test("JVM replay authenticates all 208 imports and rejects altered source identities", async () => {
	const { sources } = await record();
	assert.equal(ownedJvmCallbackProducer, "95978558fed7e305833175f36a93a140ff84be9e");
	assert.equal(ownedJvmCallbackProducerEntries.length, 37);
	const closure = ownedJvmCallbackProducerClosure(sources);
	assert.deepEqual(closure, [...new Set(closure)].sort());
	assert.equal(closure.length, 208);
	for(const path of ownedJvmCallbackProducerEntries) assert.ok(closure.includes(path), path);
	assert.deepEqual(ownedJvmCallbackProducerAssets, {
		"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
		, "tests/helpers/type-corpus-jvm-tools.mjs": "5f21567ed7dfd107bad21bfe3e57a448d1a525890133b684cf6a7758e4a334a7"
		, LICENSE: "0228993956219f4b7635fc90bdd7e8713e47973c34b0de1f19f8225ec8907996"
	});
	const paths = ["src/build/native-graph-model.mjs"
		, "src/backends/jvm/owned-calls.mjs", "src/backends/python/owned-package.mjs"
		, "tests/helpers/owned-jvm-callback-result-runtime.mjs"];
	for(const path of paths)
	{
		assert.ok(closure.includes(path), path);
		const missing = { ...sources }; delete missing[path];
		assert.throws(() => ownedJvmCallbackProducerClosure(missing));
		assert.throws(() => ownedJvmCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	for(const path of ["src/backends/cpp/boost.source.json", "tests/helpers/type-corpus-jvm-tools.mjs"])
	{
		assert.ok(closure.includes(path), path);
		assert.equal(Object.hasOwn(sources, path), false);
		assert.throws(() => ownedJvmCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	await assert.rejects(ownedJvmCallbackReplay(null));
});

test("JVM replay retains fresh generators and source-bound text and binary reads", async () => {
	const original = await record(), sources = { ...original.sources };
	const historical = await ownedJvmCallbackReplay(sources), fresh = await ownedJvmCallbackReplay();
	assert.equal(fresh.createCompiledNativeModel, createCompiledNativeModel);
	assert.equal(fresh.generateOwnedJvmPackage, generateOwnedJvmPackage);
	assert.notEqual(historical.generateOwnedJvmPackage, fresh.generateOwnedJvmPackage);
	const paths = ["docs/consume/java.md"
		, "tests/fixtures/structured-types/OwnedInstalledAssetsProbe.java"];
	for(const path of paths)
	{
		const expected = sources[path];
		assert.equal(sha256(await historical.readSource(path)), expected);
		assert.equal(sha256(await historical.readFile(path, "utf8")), expected);
		assert.equal(sha256(await historical.readFile(path)), expected);
		assert.equal(await fresh.readSource(path), await readFile(path, "utf8"));
		delete sources[path]; await assert.rejects(historical.readFile(path));
		sources[path] = "0".repeat(64); await assert.rejects(historical.readSource(path));
		sources[path] = expected;
	}
	const cli = original.reports["build/owned-jvm-callback-results/ordinary-combined-package.json"].cli;
	for(const path of ["LICENSE", "SECURITY.md", "src/backends/c/gmp.source.tar.xz"])
	{
		const file = cli.files.find(file => file.path === path);
		const bytes = await historical.readBytes(path, file.sha256);
		assert.ok(Buffer.isBuffer(bytes)); assert.equal(bytes.length, file.bytes);
		assert.equal(sha256(bytes), file.sha256);
		const live = await readFile(path).catch(error => {
			assert.equal(error.code, "ENOENT"); return null;
		});
		if(live === null) await assert.rejects(fresh.readBytes(path), { code: "ENOENT" });
		else assert.deepEqual(await fresh.readBytes(path), live);
		await assert.rejects(historical.readBytes(path, "0".repeat(64)));
		if(path.endsWith(".xz")) assert.notEqual(sha256(bytes.toString("utf8")), file.sha256);
	}
	await assert.rejects((await ownedJvmCallbackReplay({
		...original.sources, LICENSE: ownedJvmCallbackProducerAssets.LICENSE
	})).readBytes("LICENSE"));
});

for(const path of ownedJvmCallbackResultReports)
{
	const name = path.split("/").at(-1);
	const kind = path.includes("-gc/") ? "gc" : path.includes("-faults/") ? "faults"
		: name.endsWith("-combined-release.json") ? "release"
			: name.endsWith("-package.json") ? "package" : "runtime";
	test("JVM retained " + kind + ": " + name, async () => {
		const original = await record(), context = await replay();
		await assertOwnedJvmCallbackReport(path, original.reports[path], context.readBytes, context);
	});
}
