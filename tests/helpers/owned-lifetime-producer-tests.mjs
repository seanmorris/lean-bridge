/**
 * Require immutable producer closures for retained lifetime and width evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { bytesAtProducer } from "./producer-source.mjs";
import {
	ownedLifetimeProducers, ownedLifetimeProducerClosure, ownedLifetimeReplay
} from "./owned-lifetime-producers.mjs";

const receipts = [
	{
		name: "cppBorrow", file: "owned-cpp-borrows-20260930", count: 70
		, revision: "dec8d558423d1b1c2ec4b95999ea8779adb60091"
		, sha256: "11ffd4420610aa9bc235646d160c097956554d589f324c66c654bbe643ec6940"
		, supplements: { "src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c" }
	}
	, {
		name: "rustReceiver", file: "owned-rust-receivers-20261001", count: 77
		, revision: "18324f5a302fb99238b8a503114b3f5a5294d3cd"
		, sha256: "49f0a64551d0fac12b5890d7dbff730a7dab78bef23bb819e315eb954906fc3e"
		, supplements: {}
	}
	, {
		name: "jvmGc", file: "owned-jvm-receiver-gc-20261001", count: 103
		, revision: "a53368d1bb94f7651cdd571365e8e7a5e6212cd2"
		, sha256: "aa71717e00fa100a2a7c8a8bb2c54a69f99b9a31f2d780ea94480b638d2444fc"
		, supplements: { "tests/helpers/type-corpus-jvm-tools.mjs": "5f21567ed7dfd107bad21bfe3e57a448d1a525890133b684cf6a7758e4a334a7" }
	}
	, {
		name: "witReceiver", file: "wit-owned-receivers-20261001", count: 94
		, revision: "2ce50a51702a6510821197c0476eb95b08a0e359"
		, sha256: "d8621ed8b0744f9a9ac9bb5ddb1da200b3f7b85f5bab801a54c248e4b36e0262"
		, supplements: {}
	}
	, {
		name: "wasm32", file: "owned-wasm32-transport-20260928", count: 38
		, revision: "4815b87d04ba4c217a17ca33e1bdff39f2e499ee"
		, sha256: "393808a4f571ac4a80aae15ffad26f2913e1a42add5fd0021479eb9cfa813088"
		, supplements: { "src/analyze/spdx-data.json": "20dda7478849c88845a6e15ee9998b1ccdba84687e86473353a13142c07634d5" }
	}
];

for(const receipt of receipts)
	test(`${receipt.name} lifetime replay authenticates the original receipt and complete closure`, async () => {
		const path = `docs/evidence/${receipt.file}.json`, bytes = await readFile(path);
		assert.equal(sha256(bytes), receipt.sha256);
		assert.deepEqual(bytesAtProducer(receipt.revision, path, receipt.sha256), bytes);
		const { sources } = JSON.parse(bytes), producer = ownedLifetimeProducers[receipt.name];
		assert.equal(producer.revision, receipt.revision);
		const closure = ownedLifetimeProducerClosure(receipt.name, sources);
		assert.equal(closure.length, receipt.count);
		assert.deepEqual(closure.filter(path => !Object.hasOwn(sources, path))
			, Object.keys(receipt.supplements).sort());
		assert.deepEqual(producer.supplementalSources ?? {}, receipt.supplements);
		const refusals = [...producer.entries, ...producer.dataPaths ?? []
			, "src/capsule/node.mjs"];
		for(const path of refusals)
		{
			assert.ok(closure.includes(path), path);
			const missing = { ...sources }; delete missing[path];
			assert.throws(() => ownedLifetimeProducerClosure(receipt.name, missing), undefined, path);
			assert.throws(() => ownedLifetimeProducerClosure(receipt.name
				, { ...sources, [path]: "0".repeat(64) }), undefined, path);
		}
		for(const [path, expected] of Object.entries(receipt.supplements))
		{
			assert.equal(sha256(bytesAtProducer(receipt.revision, path)), expected);
			assert.throws(() => ownedLifetimeProducerClosure(receipt.name
				, { ...sources, [path]: "0".repeat(64) }), undefined, path);
		}
		for(const invalid of [undefined, null, [], "sources", Object.create(sources)])
			await assert.rejects(() => ownedLifetimeReplay(receipt.name, invalid));
	});

test("lifetime replay refuses unregistered or inherited producer names", async () => {
	for(const name of [undefined, "unknown", "__proto__", "toString", "constructor"])
		await assert.rejects(() => ownedLifetimeReplay(name, {}));
});
