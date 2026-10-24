/**
 * Refuse incomplete or substituted sources for historical transfer/borrow replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { bytesAtProducer } from "./producer-source.mjs";
import {
	ownedTransferBorrowProducers, ownedTransferBorrowProducerClosure
	, ownedTransferBorrowReplay
} from "./owned-transfer-borrow-producers.mjs";

const receipts = [
	{
		name: "cpp", path: "docs/evidence/owned-cpp-transfers-20260929.json"
		, sha256: "34bf2c588a390306e517285d12020c10bd442cc46aec57c6507488e01eea4a07"
		, revision: "5384a754d1bf356c6b6f3e587d80bb88767dbeb4", count: 69
	}
	, {
		name: "dotnet", path: "docs/evidence/owned-dotnet-transfers-20260929.json"
		, sha256: "2197870f2abacb53b7bc38715e65ee2e09765bf2975869494120c21fe22810e2"
		, revision: "7dd8a21aa6a245693fbd27fbadb3895b10b8d174", count: 78
	}
	, {
		name: "wit", path: "docs/evidence/wit-owned-borrows-20261001.json"
		, sha256: "1cbcf73fbad42679441371ff5448379c0513dab5ba17892095dbaa37efef2e01"
		, revision: "1e6f7f5f5f916461dae4a567916db3dc6d4cfa6d", count: 67
	}
];

for(const receipt of receipts)
	test(`${receipt.name} transfer/borrow replay authenticates its complete producer closure`, async () => {
		const bytes = await readFile(receipt.path), { sources } = JSON.parse(bytes);
		assert.equal(sha256(bytes), receipt.sha256);
		assert.deepEqual(bytesAtProducer(receipt.revision, receipt.path, receipt.sha256), bytes);
		const producer = ownedTransferBorrowProducers[receipt.name];
		assert.equal(producer.revision, receipt.revision);
		const closure = ownedTransferBorrowProducerClosure(receipt.name, sources);
		assert.equal(closure.length, receipt.count);
		const refusals = [...producer.entries, ...producer.dataPaths ?? []
			, "src/analyze/spdx-data.json"];
		for(const path of refusals)
		{
			assert.ok(closure.includes(path), path);
			const missing = { ...sources }; delete missing[path];
			assert.throws(() => ownedTransferBorrowProducerClosure(receipt.name, missing), undefined, path);
			assert.throws(() => ownedTransferBorrowProducerClosure(receipt.name
				, { ...sources, [path]: "0".repeat(64) }), undefined, path);
		}
		const supplements = closure.filter(path => !Object.hasOwn(sources, path));
		assert.deepEqual(supplements, receipt.name === "cpp" ? ["src/backends/cpp/boost.source.json"] : []);
		assert.deepEqual(Object.keys(producer.supplementalSources ?? {}), supplements);
		for(const path of supplements)
		{
			assert.equal(producer.supplementalSources[path]
				, "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c");
			assert.equal(sha256(bytesAtProducer(receipt.revision, path)), producer.supplementalSources[path]);
			assert.throws(() => ownedTransferBorrowProducerClosure(receipt.name
				, { ...sources, [path]: "0".repeat(64) }));
		}
		for(const invalid of [undefined, null, [], "sources"])
			await assert.rejects(() => ownedTransferBorrowReplay(receipt.name, invalid));
	});

test("transfer/borrow replay refuses unknown or inherited producer names", async () => {
	for(const name of ["unknown", "toString", "constructor", "__proto__", undefined])
		await assert.rejects(() => ownedTransferBorrowReplay(name, {}));
});

test("WIT producer replay rejects missing configuration pins and rehashed CLI forgeries", async () => {
	const { assertOwnedWitBorrowExecution } = await import("./wit-owned-borrow-evidence.mjs");
	const original = JSON.parse(await readFile(receipts.find(item => item.name === "wit").path));
	for(const expected of [undefined, "0".repeat(64)])
	{
		const changed = structuredClone(original);
		changed.sources["config/cli-package.v1.json"] = expected;
		await assert.rejects(() => assertOwnedWitBorrowExecution(changed));
	}
	for(const key of ["sha256", "bytes"])
	{
		const changed = structuredClone(original);
		const report = changed.packages[0].installedCli.report;
		const file = report.files.find(item => item.path === "SECURITY.md");
		assert.ok(file);
		file[key] = key === "sha256" ? "0".repeat(64) : file.bytes + 1;
		const inventory = { ...report };
		for(const name of ["archive", "inventorySha256", "externalRegistryWrites"])
			delete inventory[name];
		report.inventorySha256 = sha256(canonicalJson(inventory));
		await assert.rejects(() => assertOwnedWitBorrowExecution(changed)
			, error => error.code === "ERR_ASSERTION" && error.message.includes("SECURITY.md"));
	}
});
