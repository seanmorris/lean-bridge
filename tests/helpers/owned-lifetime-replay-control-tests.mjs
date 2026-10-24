/**
 * Keep fresh checks live and reject source substitutions in archived CLI replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel } from "../../src/build/native-graph-model.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { ownedJvmCallNative } from "./owned-jvm-call-fixture.mjs";
import { ownedJvmReceiverGcReplay } from "./owned-jvm-receiver-gc-evidence.mjs";
import { ownedLifetimeProducers } from "./owned-lifetime-producers.mjs";

test("JVM GC replay keeps fresh generators live and authenticates historical data reads", async () => {
	const live = await ownedJvmReceiverGcReplay();
	assert.equal(live.createCompiledNativeModel, createCompiledNativeModel);
	assert.equal(live.generateOwnedJvmPackage, generateOwnedJvmPackage);
	assert.equal(live.ownedJvmCallNative, ownedJvmCallNative);
	const record = JSON.parse(await readFile("docs/evidence/owned-jvm-receiver-gc-20261001.json"));
	const sources = { ...record.sources }, historical = await ownedJvmReceiverGcReplay(sources);
	assert.notEqual(historical.createCompiledNativeModel, live.createCompiledNativeModel);
	for(const path of ownedLifetimeProducers.jvmGc.dataPaths)
	{
		assert.equal(await live.readSource(path), await readFile(path, "utf8"));
		assert.equal(sha256(await historical.readSource(path)), record.sources[path]);
		delete sources[path];
		await assert.rejects(() => historical.readSource(path));
		sources[path] = "0".repeat(64);
		await assert.rejects(() => historical.readSource(path));
		sources[path] = record.sources[path];
		assert.equal(sha256(await historical.readSource(path)), record.sources[path]);
	}
	assert.deepEqual(sources, record.sources);
	await assert.rejects(() => ownedJvmReceiverGcReplay(null));
});

const cases = [
	{
		name: "Rust receiver", file: "owned-rust-receivers-20261001"
		, module: "./owned-rust-receiver-evidence.mjs"
		, method: "assertOwnedRustReceiverExecution"
		, report: record => record.packages[0].cli
	}
	, {
		name: "WIT receiver", file: "wit-owned-receivers-20261001"
		, module: "./wit-owned-receiver-evidence.mjs"
		, method: "assertOwnedWitReceiverExecution"
		, report: record => record.packages[0].installedCli.report
	}
];
for(const item of cases)
	test(`${item.name} replay rejects missing config hashes and rehashed CLI forgeries`, async () => {
		const verify = (await import(item.module))[item.method];
		const original = JSON.parse(await readFile(`docs/evidence/${item.file}.json`));
		const missing = structuredClone(original);
		delete missing.sources["config/cli-package.v1.json"];
		await assert.rejects(() => verify(missing));
		for(const key of ["sha256", "bytes"])
		{
			const changed = structuredClone(original), report = item.report(changed);
			const file = report.files.find(file => file.path === "SECURITY.md");
			assert.ok(file);
			file[key] = key === "sha256" ? "0".repeat(64) : file.bytes + 1;
			const inventory = { ...report };
			for(const name of ["archive", "inventorySha256", "externalRegistryWrites"])
				delete inventory[name];
			report.inventorySha256 = sha256(canonicalJson(inventory));
			await assert.rejects(() => verify(changed)
				, error => error.code === "ERR_ASSERTION" && error.message.includes("SECURITY.md"));
		}
	});
