/**
 * Replay the retained .NET milestone without running compilers or consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedDotnetCallbackReport } from "./owned-dotnet-callback-result-acceptance.mjs";
import {
	ownedDotnetCallbackProducer, ownedDotnetCallbackProducerEntries
	, ownedDotnetCallbackProducerAssets, ownedDotnetCallbackProducerClosure
	, ownedDotnetCallbackReplay
} from "./owned-dotnet-callback-result-replay.mjs";

let retained;
const record = async () => {
	if(retained) return retained;
	const bytes = await readFile("docs/evidence/owned-dotnet-callback-results-20261002.json");
	assert.equal(sha256(bytes), "7e1f8db50586d487923415a199c6680f00d4c80346e8c6f27900f8616b68e764");
	const value = JSON.parse(bytes);
	retained = { ...value, reports: unpackOwnedCallbackReports(value.archive) };
	assert.equal(Object.keys(retained.reports).length, 26);
	return retained;
};
let selected;
const replay = async () => selected ??= await ownedDotnetCallbackReplay((await record()).sources);

test(".NET replay authenticates all 189 imports and refuses altered source identities", async () => {
	const { sources } = await record();
	assert.equal(ownedDotnetCallbackProducer, "72d123d69917f1145ec03d8624b6a08c3b2be6bc");
	assert.equal(ownedDotnetCallbackProducerEntries.length, 29);
	const closure = ownedDotnetCallbackProducerClosure(sources);
	assert.deepEqual(closure, [...new Set(closure)].sort());
	assert.equal(closure.length, 189);
	for(const path of ownedDotnetCallbackProducerEntries) assert.ok(closure.includes(path), path);
	assert.deepEqual(ownedDotnetCallbackProducerAssets, {
		"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
		, LICENSE: "0228993956219f4b7635fc90bdd7e8713e47973c34b0de1f19f8225ec8907996"
	});
	const paths = ["src/build/native-graph-model.mjs"
		, "src/backends/dotnet/owned-calls.mjs"
		, "src/backends/python/owned-package.mjs"
		, "tests/helpers/owned-dotnet-callback-result-fixture.mjs"];
	for(const path of paths)
	{
		const missing = { ...sources }; delete missing[path];
		assert.throws(() => ownedDotnetCallbackProducerClosure(missing));
		assert.throws(() => ownedDotnetCallbackProducerClosure({ ...sources, [path]: "0".repeat(64) }));
	}
	const boost = "src/backends/cpp/boost.source.json";
	assert.ok(closure.includes(boost));
	assert.equal(Object.hasOwn(sources, boost), false);
	assert.throws(() => ownedDotnetCallbackProducerClosure({ ...sources, [boost]: "0".repeat(64) }));
	await assert.rejects(ownedDotnetCallbackReplay(null));
});

test(".NET replay preserves live generation and authenticates deferred text and binary inputs", async () => {
	const original = await record();
	const sources = { ...original.sources };
	const historical = await ownedDotnetCallbackReplay(sources);
	const fresh = await ownedDotnetCallbackReplay();
	assert.equal(fresh.createCompiledNativeModel, createCompiledNativeModel);
	assert.notEqual(historical.createCompiledNativeModel, fresh.createCompiledNativeModel);
	const paths = ["docs/consume/dotnet.md", "docs/publish/nuget.md"
		, "tests/fixtures/structured-types/owned-dotnet-callback-lifetimes.cs"];
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
	const lifetime = original.reports["build/owned-dotnet-callback-results/ordinary-combined-lifetime.json"];
	assert.equal(sha256(await historical.ownedDotnetCallbackLifetimeProbe(true, true)), lifetime.probeSha256);
	const cli = original.reports["build/owned-dotnet-callback-results/ordinary-combined-package.json"].cli;
	for(const path of ["LICENSE", "src/backends/c/gmp.source.tar.xz"])
	{
		const file = cli.files.find(file => file.path === path);
		const bytes = await historical.readBytes(path, file.sha256);
		assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes);
		assert.equal(sha256(bytes), file.sha256);
		assert.deepEqual(await fresh.readBytes(path), await readFile(path));
		await assert.rejects(historical.readBytes(path, "0".repeat(64)));
		if(path.endsWith(".xz")) assert.notEqual(sha256(bytes.toString("utf8")), file.sha256);
	}
});

const variants = ["combined", "host", "no-host"];
const cases = variants.flatMap(variant => [
	["runtime", variant], ["runtime", variant + "-lifetime"]
	, ...variant === "host" ? [] : [
		["runtime", variant + "-sanitizers"], ["runtime", variant + "-process"]
		, ["package", variant + "-package"]
	]
]);
cases.push(["release", "combined-release"]);
for(const mode of ["ordinary", "reviewed"])
	for(const [kind, variant] of cases)
	{
		test(".NET retained " + kind + ": " + mode + "-" + variant, async () => {
			const original = await record();
			const path = "build/owned-dotnet-callback-results/" + mode + "-" + variant + ".json";
			await assertOwnedDotnetCallbackReport(path, original.reports[path], await replay());
		});
	}
