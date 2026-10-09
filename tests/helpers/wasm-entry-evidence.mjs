/**
 * Authenticate the local installed Wasm adapter and Lean source entry measurements of the reviewed Fin npm corpus
 * (VO #1438): the failed ba282ec smoke kept with its actual failure, the ordinary scalar Node smoke at 7c11757, the
 * six remaining Node cases and all eight browser cases at 7eae444. Original and probe modes stay distinct, every
 * report is recounted from its retained transcripts against frozen expectations, and nothing here is hosted.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { gunzipSync } from "node:zlib";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { reviewedFinBrowserProfiles } from "./reviewed-fin-wasm-browser.mjs";
import { accountReviewedFinWasmEntryReport, assertReviewedFinWasmEntryPhases, reviewedFinWasmEntryBrowserPhases, reviewedFinWasmTypeScriptPrelude } from "./reviewed-fin-wasm-entry-producer.mjs";
import { expectReviewedFinWasmEntry } from "./reviewed-fin-wasm-entry.mjs";
import { reviewedFinWasmTypeScript } from "./reviewed-fin-wasm-typescript.mjs";

export const wasmEntryDirectory = "docs/evidence/wasm-entry-20261009";
/** The engines every browser attempt declared, independently of its reports. */
export const wasmEntryEngines = Object.freeze(["chromium", "firefox", "webkit"]);
const archived = name => `${wasmEntryDirectory}/${name}`;
const routes = Object.freeze({ ordinary: "ordinary-source", reviewed: "reviewed-ir" });
const modes = Object.freeze(["original", "probe"]);
const selections = Object.freeze(["scalar", "structural"]);
const failureReasons = Object.freeze({
	"failed-ba282ec-node-smoke": "the producer compared the private ABI with the expected contract in declaration order, which the compiler emits alphabetically, so both ordinary scalar tests failed before any measurement; 7c11757 keys the comparison by binding ID"
});
// Expectations and TypeScript consumers as 7eae444 generates them; 7c11757 and 1406d54 generate identical bytes.
export const wasmEntryFrozen = Object.freeze({
	"expectations/original-scalar.json.gz": { sha256: "7e0d35e5cc99ec9e5779fb16295df3b58308702f5f4d3e9ec08300ea3796935a", bytes: 813756 }
	, "expectations/original-structural.json.gz": { sha256: "47ae0c03d4b29bf6179f06a0f0d95ba0399a56012e203f963f663ff19352b849", bytes: 860060 }
	, "expectations/probe-scalar.json.gz": { sha256: "22430227d153a1ef716de6ea9b06124eb17e5cf041b69042f4ea208bf9e02d4b", bytes: 815038 }
	, "expectations/probe-structural.json.gz": { sha256: "706c1375d16a089e448d226a3741d274cf09be5d121f6aeaa1761a1fe59e03c1", bytes: 861342 }
	, "typescript/scalar.ts.txt": { sha256: "1fff8f0d5b10b2b2ba0fdabfcce22649a9d5929885ea862ec362b829cdddaf45", bytes: 1283 }
	, "typescript/structural.ts.txt": { sha256: "882cb7061c70dc4c7c94a2c0bb1f7d3b729b5410324c2b586a4a9a363952572e", bytes: 2194 }
});
/** Exact identities of every producer attempt, generated from the original run directories. */
export const wasmEntryAttempts = Object.freeze([
	{
		id: "failed-ba282ec-node-smoke"
		, outcome: "failed"
		, revision: "ba282ec4c561ef52d161a4c94884dcacd1798221"
		, tree: "ff0faf5f5eab21069fc45cf26b27976e55054f5b"
		, startedAt: "2026-10-09T09:06:50.155Z"
		, engines: []
		, tests: 2
		, failure: { count: 2, text: "the private ABI is the expected contract's" }
		, reports: []
		, files: {
			"queue.json": { original: "build/vo1438-wasm-entry-ba282ec-smoke/queue.json", sha256: "77a260b9d0d57b18b5668caa1fc103f0ada18859ef18390d7d18d2a3eb1651d3", bytes: 5359 }
			, "start.json": { original: "build/vo1438-wasm-entry-ba282ec-smoke/start.json", sha256: "634f0ae1c68f1ca0cccf0119cf732fcf2fda085211eca7da7fb6564a95a51b16", bytes: 83 }
			, "end.json": { original: "build/vo1438-wasm-entry-ba282ec-smoke/end.json", sha256: "1630d9ead150635ec6100dc7b2eac3bc07efc0aa1088d2eef156e68aec5b91d7", bytes: 211 }
			, "run.tap": { original: "build/vo1438-wasm-entry-ba282ec-smoke/run.tap", sha256: "b34477f5130f11ff30a516b7f72aede9671c2da0f3ef93c5eff7d4097116e121", bytes: 17702 }
			, "runner.mjs.txt": { original: "build/run-vo1438-wasm-entry-ba282ec-smoke.mjs", sha256: "be14337bfa81728edf4f46e6b2245328f511d0b3fe4aa671eb16547c69887358", bytes: 7499 }
			, "runner-output.txt": { original: "build/vo1438-wasm-entry-ba282ec-smoke.runner.log", sha256: "08d052e1f5d6ffc18973d73157fce68e914e3ac394891598dd036798938e2ffe", bytes: 895 }
		}
		, sources: {
			"tests/reviewed-fin-wasm-entry.test.mjs": "bb6b2ca1f9e6bedb0a35240b90e66fc5b7aecd6d82a32eed15619e931d0e2d92"
			, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs": "f8f8419344b34830c51a8b6eec2c96ad751fb78d7485d2ba28196900cd2735e0"
			, "tests/helpers/reviewed-fin-wasm-entry.mjs": "e390267d14e349935a980e24f14a251dd22d3fccb67ca6a6d342920795995488"
			, "tests/helpers/reviewed-fin-wasm-source-entry.mjs": "cd67e53795979d6a5641a2eebef0f605aeba24196b1682850a9c391f9f9cfc41"
			, "tests/helpers/wasm-frame-entry-observer.mjs": "c6677097983d33bb86796837394b44b79a139dd6b0c7ad96f9e1271dfcf37b59"
			, "tests/fixtures/reviewed-fin-wasm/javascript.mjs": "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
			, "tests/fixtures/reviewed-fin-wasm/javascript-entry.mjs": "a0bdeedebdf0ace601e96f8dda1fb35200dc3abdd6cf41b0aabbe62adce832af"
			, "tests/fixtures/reviewed-fin-wasm/entry-observation.mjs": "a7b6d8bf99fad5b40df38484f5a19c8eb46b11247e32d70a862816b655454814"
			, "tests/helpers/reviewed-fin-wasm-install.mjs": "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
			, "tests/helpers/reviewed-fin-wasm-fixture.mjs": "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
			, "tests/helpers/reviewed-fin-wasm-typescript.mjs": "cdfb35044fe6e5ccda580dc5b1df1d2161f026b9c2a99e8a9618949d79d31c77"
			, "tests/helpers/reviewed-fin-wasm-browser.mjs": "cccaf1638b72e653fe637a61af8a17fa381a421e171806f7ffbd75e8fe24c639"
			, "tests/helpers/type-corpus-browser.mjs": "ca503281cfeed8d7968cc866fdb5ee8b0728a6efbc5f79acef4fcf992bf6f932"
			, "tests/helpers/refinement-engine.mjs": "91e69b67d355d2b436fa699a5e4a4692362bdc4f9536634877b6af41e968d3b4"
			, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean": "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
			, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
			, "src/backends/javascript/generate.mjs": "893a39db70644e6989e9f2766a55fe68b9ad90bb8ea9efbee88379f1e9a93014"
			, "src/build/component-callable-adapters.mjs": "958e629d9012f0ef7c94b72318b520a4181bb2f585e5558188ddd72503c96425"
			, "src/build/lake-entry-engine.mjs": "4686cd10fa95b0563c383f9820b17be021e7ef01e5ceda21adb921e20124cc21"
			, "src/build/component-engine.mjs": "bb72f15591546201f2bea8dc4f917fad3c6d2325c0405099ca9e6064228662c7"
			, "src/release/component-runtime.mjs": "34e71aed9cbcfa16d4a6641eb310ba03917207435ae4a4ddb9a834f0c05b67ad"
			, "src/release/component-copied-runtime.mjs": "fd2900bab92704b9d877efbc66567fc71037a3c183cd9dfe4a08678e5c3d8e97"
			, "src/release/component-npm-package.mjs": "f7c4e8196814cdb6dafe16173740f762c9bf2208b6fa10650be8855f12b1b3c4"
		}
	}
	, {
		id: "node-smoke-7c11757"
		, outcome: "passed"
		, revision: "7c117573c61696dc93f98ba83c18162517b72d37"
		, tree: "4065dcbc844cb87a34edee373a0839bc32719112"
		, startedAt: "2026-10-09T09:17:38.785Z"
		, engines: []
		, tests: 2
		, reports: ["original-ordinary-scalar", "probe-ordinary-scalar"]
		, files: {
			"queue.json": { original: "build/vo1438-wasm-entry-7c11757-smoke/queue.json", sha256: "a38ef7d22da74017992bf8d48c10fd6c25c72654155f6e36d6db86a98e8e5a7e", bytes: 5359 }
			, "start.json": { original: "build/vo1438-wasm-entry-7c11757-smoke/start.json", sha256: "b3e38ba79bda32245a5500ebe1eed22d5f39f8dcbd6a375ef33ac3535ee5f2a0", bytes: 83 }
			, "end.json": { original: "build/vo1438-wasm-entry-7c11757-smoke/end.json", sha256: "54cd3b1109755b8066679e2c2d7efc5ee541b42ccf5b58c22b6e6c0f7a59dcc6", bytes: 211 }
			, "run.tap": { original: "build/vo1438-wasm-entry-7c11757-smoke/run.tap", sha256: "e9db3ab000caf67265a6cbc5a97401af5b0a7dd4ee3e97029195090fa1ece43f", bytes: 757 }
			, "runner.mjs.txt": { original: "build/run-vo1438-wasm-entry-7c11757-smoke.mjs", sha256: "d034e1eb201e47db0f6fa8172d682ed0532be9489f20532ec61182111070018c", bytes: 7598 }
			, "runner-output.txt": { original: "build/vo1438-wasm-entry-7c11757-smoke.runner.log", sha256: "f88fa7afaf4854155551e92cffd9e1499f7bbd4cade1984e75562c37e0408a44", bytes: 627 }
			, "original-ordinary-scalar.json.gz": { original: "build/vo1438-wasm-entry-7c11757-smoke/original-ordinary-scalar.json", sha256: "873987d401afa8100de713cdc35f5b31a23c4bbdc06c7fc8de75f8b0bbf55520", bytes: 1644359 }
			, "probe-ordinary-scalar.json.gz": { original: "build/vo1438-wasm-entry-7c11757-smoke/probe-ordinary-scalar.json", sha256: "cce85e8067ecd55a0c4c8ed53f649c0732479bf39db07a29a537d68f92f63f67", bytes: 1683193 }
		}
		, sources: {
			"tests/reviewed-fin-wasm-entry.test.mjs": "872a212379b5457992f5c4045054a6c9605d7fc7f28049b531da96c8a0ead89b"
			, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs": "e379ec40739cc5eacac19c7deb812261ebc6687be24665688ef30f7722dd5a37"
			, "tests/helpers/reviewed-fin-wasm-entry.mjs": "f3e7d24c3582f8af0d0b9ee246edf5c41d7e7a6981a7bd12fc004e3d7e3cd216"
			, "tests/helpers/reviewed-fin-wasm-source-entry.mjs": "cd67e53795979d6a5641a2eebef0f605aeba24196b1682850a9c391f9f9cfc41"
			, "tests/helpers/wasm-frame-entry-observer.mjs": "c6677097983d33bb86796837394b44b79a139dd6b0c7ad96f9e1271dfcf37b59"
			, "tests/fixtures/reviewed-fin-wasm/javascript.mjs": "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
			, "tests/fixtures/reviewed-fin-wasm/javascript-entry.mjs": "a0bdeedebdf0ace601e96f8dda1fb35200dc3abdd6cf41b0aabbe62adce832af"
			, "tests/fixtures/reviewed-fin-wasm/entry-observation.mjs": "a7b6d8bf99fad5b40df38484f5a19c8eb46b11247e32d70a862816b655454814"
			, "tests/helpers/reviewed-fin-wasm-install.mjs": "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
			, "tests/helpers/reviewed-fin-wasm-fixture.mjs": "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
			, "tests/helpers/reviewed-fin-wasm-typescript.mjs": "cdfb35044fe6e5ccda580dc5b1df1d2161f026b9c2a99e8a9618949d79d31c77"
			, "tests/helpers/reviewed-fin-wasm-browser.mjs": "cccaf1638b72e653fe637a61af8a17fa381a421e171806f7ffbd75e8fe24c639"
			, "tests/helpers/type-corpus-browser.mjs": "ca503281cfeed8d7968cc866fdb5ee8b0728a6efbc5f79acef4fcf992bf6f932"
			, "tests/helpers/refinement-engine.mjs": "91e69b67d355d2b436fa699a5e4a4692362bdc4f9536634877b6af41e968d3b4"
			, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean": "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
			, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
			, "src/backends/javascript/generate.mjs": "893a39db70644e6989e9f2766a55fe68b9ad90bb8ea9efbee88379f1e9a93014"
			, "src/build/component-callable-adapters.mjs": "958e629d9012f0ef7c94b72318b520a4181bb2f585e5558188ddd72503c96425"
			, "src/build/lake-entry-engine.mjs": "4686cd10fa95b0563c383f9820b17be021e7ef01e5ceda21adb921e20124cc21"
			, "src/build/component-engine.mjs": "bb72f15591546201f2bea8dc4f917fad3c6d2325c0405099ca9e6064228662c7"
			, "src/release/component-runtime.mjs": "34e71aed9cbcfa16d4a6641eb310ba03917207435ae4a4ddb9a834f0c05b67ad"
			, "src/release/component-copied-runtime.mjs": "fd2900bab92704b9d877efbc66567fc71037a3c183cd9dfe4a08678e5c3d8e97"
			, "src/release/component-npm-package.mjs": "f7c4e8196814cdb6dafe16173740f762c9bf2208b6fa10650be8855f12b1b3c4"
		}
	}
	, {
		id: "node-7eae444"
		, outcome: "passed"
		, revision: "7eae44484e981a83092bc94fc46585130b3ad733"
		, tree: "f1aee0bd50d84d79b379a5a6292565ee058b38b5"
		, startedAt: "2026-10-09T09:25:42.592Z"
		, engines: []
		, tests: 6
		, reports: ["original-reviewed-scalar", "original-ordinary-structural", "original-reviewed-structural", "probe-reviewed-scalar", "probe-ordinary-structural", "probe-reviewed-structural"]
		, files: {
			"queue.json": { original: "build/vo1438-wasm-entry-7eae444-node/queue.json", sha256: "20b93e06d70e0dfd06c08d86b531592e98437f11fec6a0e6823d0e5748ad4a5a", bytes: 5556 }
			, "start.json": { original: "build/vo1438-wasm-entry-7eae444-node/start.json", sha256: "fc0f5d50708dbdccbe80fa3c7d5e0f1d4d2bc00f39dee46273a4dd7bcfd64d7b", bytes: 83 }
			, "end.json": { original: "build/vo1438-wasm-entry-7eae444-node/end.json", sha256: "0a64ec2c12d6a565d892642de4bf78508d5688480e13ec4e84f62ec1b6a5754b", bytes: 211 }
			, "run.tap": { original: "build/vo1438-wasm-entry-7eae444-node/run.tap", sha256: "26eb67bee94828394d6609678c96c0f5078b884b2519fa2c7a4d5ccee4f240c7", bytes: 2204 }
			, "runner.mjs.txt": { original: "build/run-vo1438-wasm-entry-7eae444-node.mjs", sha256: "75dd39d02184d9d71d0a2859ee7df9211aaf89cc916eb26e5a61e9b0622e7520", bytes: 8040 }
			, "runner-output.txt": { original: "build/vo1438-wasm-entry-7eae444-node.runner.log", sha256: "882b1f1c1447e2f6ac02fc2f16a07c5a2593e90d8c68b09ebdcc6b579eef66b9", bytes: 1408 }
			, "original-reviewed-scalar.json.gz": { original: "build/vo1438-wasm-entry-7eae444-node/original-reviewed-scalar.json", sha256: "435bfe05ecbc98520ca74e0d0859e3cc851a8c5e2b731b736ac2b5fa46026b15", bytes: 1644355 }
			, "original-ordinary-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-node/original-ordinary-structural.json", sha256: "97949cf3d2a2f3f8a920d1c93d62c7d486e6482bee8a8edbed1c80f4cb4671b3", bytes: 1733405 }
			, "original-reviewed-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-node/original-reviewed-structural.json", sha256: "bb719020e5810291990b583b2e53a2156d107f797000c07c5e64c22d0d340087", bytes: 1733401 }
			, "probe-reviewed-scalar.json.gz": { original: "build/vo1438-wasm-entry-7eae444-node/probe-reviewed-scalar.json", sha256: "4d133732feb478acca97c90dd0c62f84baa4f3b3dff83d9fd9f3af8ed03ed48e", bytes: 1683189 }
			, "probe-ordinary-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-node/probe-ordinary-structural.json", sha256: "82d4d0612b0ca660b3c8db28748da1ed3dba8a903dd115cf92c82d64c3c12bb5", bytes: 1819351 }
			, "probe-reviewed-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-node/probe-reviewed-structural.json", sha256: "4eda1e40be103ac805010642f6373133d6bebf68f9e1eb3da7f7f7882fef0302", bytes: 1819347 }
		}
		, sources: {
			"tests/reviewed-fin-wasm-entry.test.mjs": "872a212379b5457992f5c4045054a6c9605d7fc7f28049b531da96c8a0ead89b"
			, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs": "e379ec40739cc5eacac19c7deb812261ebc6687be24665688ef30f7722dd5a37"
			, "tests/helpers/reviewed-fin-wasm-entry.mjs": "f3e7d24c3582f8af0d0b9ee246edf5c41d7e7a6981a7bd12fc004e3d7e3cd216"
			, "tests/helpers/reviewed-fin-wasm-source-entry.mjs": "cd67e53795979d6a5641a2eebef0f605aeba24196b1682850a9c391f9f9cfc41"
			, "tests/helpers/wasm-frame-entry-observer.mjs": "c6677097983d33bb86796837394b44b79a139dd6b0c7ad96f9e1271dfcf37b59"
			, "tests/fixtures/reviewed-fin-wasm/javascript.mjs": "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
			, "tests/fixtures/reviewed-fin-wasm/javascript-entry.mjs": "a0bdeedebdf0ace601e96f8dda1fb35200dc3abdd6cf41b0aabbe62adce832af"
			, "tests/fixtures/reviewed-fin-wasm/entry-observation.mjs": "a7b6d8bf99fad5b40df38484f5a19c8eb46b11247e32d70a862816b655454814"
			, "tests/helpers/reviewed-fin-wasm-install.mjs": "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
			, "tests/helpers/reviewed-fin-wasm-fixture.mjs": "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
			, "tests/helpers/reviewed-fin-wasm-typescript.mjs": "cdfb35044fe6e5ccda580dc5b1df1d2161f026b9c2a99e8a9618949d79d31c77"
			, "tests/helpers/reviewed-fin-wasm-browser.mjs": "cccaf1638b72e653fe637a61af8a17fa381a421e171806f7ffbd75e8fe24c639"
			, "tests/helpers/type-corpus-browser.mjs": "ca503281cfeed8d7968cc866fdb5ee8b0728a6efbc5f79acef4fcf992bf6f932"
			, "tests/helpers/refinement-engine.mjs": "91e69b67d355d2b436fa699a5e4a4692362bdc4f9536634877b6af41e968d3b4"
			, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean": "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
			, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
			, "src/backends/javascript/generate.mjs": "893a39db70644e6989e9f2766a55fe68b9ad90bb8ea9efbee88379f1e9a93014"
			, "src/build/component-callable-adapters.mjs": "958e629d9012f0ef7c94b72318b520a4181bb2f585e5558188ddd72503c96425"
			, "src/build/lake-entry-engine.mjs": "4686cd10fa95b0563c383f9820b17be021e7ef01e5ceda21adb921e20124cc21"
			, "src/build/component-engine.mjs": "bb72f15591546201f2bea8dc4f917fad3c6d2325c0405099ca9e6064228662c7"
			, "src/release/component-runtime.mjs": "34e71aed9cbcfa16d4a6641eb310ba03917207435ae4a4ddb9a834f0c05b67ad"
			, "src/release/component-copied-runtime.mjs": "fd2900bab92704b9d877efbc66567fc71037a3c183cd9dfe4a08678e5c3d8e97"
			, "src/release/component-npm-package.mjs": "f7c4e8196814cdb6dafe16173740f762c9bf2208b6fa10650be8855f12b1b3c4"
		}
	}
	, {
		id: "browser-scalar-7eae444"
		, outcome: "passed"
		, revision: "7eae44484e981a83092bc94fc46585130b3ad733"
		, tree: "f1aee0bd50d84d79b379a5a6292565ee058b38b5"
		, startedAt: "2026-10-09T09:50:22.660Z"
		, engines: wasmEntryEngines
		, tests: 2
		, reports: ["original-ordinary-scalar", "probe-ordinary-scalar"]
		, files: {
			"queue.json": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar/queue.json", sha256: "40ca4e41b07da28c0d8276e3ae729bcab5892efc1b14be96a9f65f7e1f92b849", bytes: 6583 }
			, "start.json": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar/start.json", sha256: "754362cf063c0ca93c4fd3e96f88722740897851c0edf042adf77b7d4460301d", bytes: 83 }
			, "end.json": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar/end.json", sha256: "7535684599a11f02c419b9a8bb9cfe1e60b023e2d4f4821f2dc09cdae9fe2173", bytes: 211 }
			, "run.tap": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar/run.tap", sha256: "9751159707e5cd0231c283790dbc4aee974b4f8da5f45e169aee5faa8643715a", bytes: 758 }
			, "runner.mjs.txt": { original: "build/run-vo1438-wasm-entry-7eae444-browser-scalar.mjs", sha256: "f5b097c191eb03695de522a092f1cb83ba12ddc86bc942831e5f3b7b3b8c0131", bytes: 9358 }
			, "runner-output.txt": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar.runner.log", sha256: "3c5604a4673f1dc463eccaf0d93e382a55a1e6de611c07385129324eb33c29da", bytes: 720 }
			, "preflight.json": { original: "build/vo1438-browser-preflight-7eae444/preflight.json", sha256: "64dfd9f567319bc63ad3ef0cc3f96dc25146f4c5fa77a1081b844ba88e5d2ed5", bytes: 2108 }
			, "original-ordinary-scalar.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar/original-ordinary-scalar.json", sha256: "acf5b78e71e2dd68421f761993cf650efeea34719679f6b35f988ef22053bc8f", bytes: 9404115 }
			, "probe-ordinary-scalar.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-scalar/probe-ordinary-scalar.json", sha256: "2b1fdaf53960465a7b9c27291c3f18bb3c6c3cb9d47cf9d82762d163308ec2c5", bytes: 9716657 }
		}
		, sources: {
			"tests/reviewed-fin-wasm-entry.test.mjs": "872a212379b5457992f5c4045054a6c9605d7fc7f28049b531da96c8a0ead89b"
			, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs": "e379ec40739cc5eacac19c7deb812261ebc6687be24665688ef30f7722dd5a37"
			, "tests/helpers/reviewed-fin-wasm-entry.mjs": "f3e7d24c3582f8af0d0b9ee246edf5c41d7e7a6981a7bd12fc004e3d7e3cd216"
			, "tests/helpers/reviewed-fin-wasm-source-entry.mjs": "cd67e53795979d6a5641a2eebef0f605aeba24196b1682850a9c391f9f9cfc41"
			, "tests/helpers/wasm-frame-entry-observer.mjs": "c6677097983d33bb86796837394b44b79a139dd6b0c7ad96f9e1271dfcf37b59"
			, "tests/fixtures/reviewed-fin-wasm/javascript.mjs": "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
			, "tests/fixtures/reviewed-fin-wasm/javascript-entry.mjs": "a0bdeedebdf0ace601e96f8dda1fb35200dc3abdd6cf41b0aabbe62adce832af"
			, "tests/fixtures/reviewed-fin-wasm/entry-observation.mjs": "a7b6d8bf99fad5b40df38484f5a19c8eb46b11247e32d70a862816b655454814"
			, "tests/helpers/reviewed-fin-wasm-install.mjs": "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
			, "tests/helpers/reviewed-fin-wasm-fixture.mjs": "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
			, "tests/helpers/reviewed-fin-wasm-typescript.mjs": "cdfb35044fe6e5ccda580dc5b1df1d2161f026b9c2a99e8a9618949d79d31c77"
			, "tests/helpers/reviewed-fin-wasm-browser.mjs": "cccaf1638b72e653fe637a61af8a17fa381a421e171806f7ffbd75e8fe24c639"
			, "tests/helpers/type-corpus-browser.mjs": "ca503281cfeed8d7968cc866fdb5ee8b0728a6efbc5f79acef4fcf992bf6f932"
			, "tests/helpers/type-corpus.mjs": "d76e871b4f76c524d44a2be6fda23d73a9b3162d9bca9eafe113f1a38f9f4f43"
			, "tests/helpers/refinement-engine.mjs": "91e69b67d355d2b436fa699a5e4a4692362bdc4f9536634877b6af41e968d3b4"
			, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean": "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
			, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
			, "src/backends/javascript/generate.mjs": "893a39db70644e6989e9f2766a55fe68b9ad90bb8ea9efbee88379f1e9a93014"
			, "src/build/component-callable-adapters.mjs": "958e629d9012f0ef7c94b72318b520a4181bb2f585e5558188ddd72503c96425"
			, "src/build/lake-entry-engine.mjs": "4686cd10fa95b0563c383f9820b17be021e7ef01e5ceda21adb921e20124cc21"
			, "src/build/component-engine.mjs": "bb72f15591546201f2bea8dc4f917fad3c6d2325c0405099ca9e6064228662c7"
			, "src/release/component-runtime.mjs": "34e71aed9cbcfa16d4a6641eb310ba03917207435ae4a4ddb9a834f0c05b67ad"
			, "src/release/component-copied-runtime.mjs": "fd2900bab92704b9d877efbc66567fc71037a3c183cd9dfe4a08678e5c3d8e97"
			, "src/release/component-npm-package.mjs": "f7c4e8196814cdb6dafe16173740f762c9bf2208b6fa10650be8855f12b1b3c4"
		}
	}
	, {
		id: "browser-remaining-7eae444"
		, outcome: "passed"
		, revision: "7eae44484e981a83092bc94fc46585130b3ad733"
		, tree: "f1aee0bd50d84d79b379a5a6292565ee058b38b5"
		, startedAt: "2026-10-09T09:58:00.079Z"
		, engines: wasmEntryEngines
		, tests: 6
		, reports: ["original-reviewed-scalar", "original-ordinary-structural", "original-reviewed-structural", "probe-reviewed-scalar", "probe-ordinary-structural", "probe-reviewed-structural"]
		, files: {
			"queue.json": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/queue.json", sha256: "c3f0ecacbcff30d6eed7b9310249e1bdfacf622971e28a7c1caf304eee167d82", bytes: 6790 }
			, "start.json": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/start.json", sha256: "cac2bcf86de431723e626f52e44e03811b01e12af66efde7df50cb28f73cbbb9", bytes: 83 }
			, "end.json": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/end.json", sha256: "3c7b45cdd5a78c5d3d74d4e555fcca20dc4712d2cf86b9b4e69910a4cb39fd4c", bytes: 211 }
			, "run.tap": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/run.tap", sha256: "1ba8442244ed4c136f33ab660e0dad2cb0eb64479e83bf33cd85b77a102c2204", bytes: 2207 }
			, "runner.mjs.txt": { original: "build/run-vo1438-wasm-entry-7eae444-browser-remaining.mjs", sha256: "6812babb5d5a45e6dbd38bf0af08f78e7c69da95f6b67eb0d9aed27030ca854a", bytes: 9617 }
			, "runner-output.txt": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining.runner.log", sha256: "37f309e2dd9f132a0b70bb6bb24ff78614f8ac912cf30df5d7abbae2b2af8a1b", bytes: 1433 }
			, "original-reviewed-scalar.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/original-reviewed-scalar.json", sha256: "81cd173b6db2dc3e6d601898b06c2883cf2a9cb6ad63edeb574fd90d034fab1c", bytes: 9404111 }
			, "original-ordinary-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/original-ordinary-structural.json", sha256: "92a732ee3ee77100030ae621039f4eb7952b3e99b156ee09007771393ef0653b", bytes: 10590365 }
			, "original-reviewed-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/original-reviewed-structural.json", sha256: "d831d385377c0907d66c90676f6598408570ddbfe2cdc3c6ad7f6d22c260d160", bytes: 10590361 }
			, "probe-reviewed-scalar.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/probe-reviewed-scalar.json", sha256: "87b4dba84dc2e68f4f3b56f927c4fafddab2c45a3d02b7e5634d718ebac30f88", bytes: 9716653 }
			, "probe-ordinary-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/probe-ordinary-structural.json", sha256: "7fcb71bbe8e9b805ad7bc7e3cbb1a0fd17dd75f965e201cd026f03fff89a50be", bytes: 11268958 }
			, "probe-reviewed-structural.json.gz": { original: "build/vo1438-wasm-entry-7eae444-browser-remaining/probe-reviewed-structural.json", sha256: "d2922ee3ae51d20e62b0eb905c63ea65b6849c9041763064b41e5d16f489caf8", bytes: 11268954 }
		}
		, sources: {
			"tests/reviewed-fin-wasm-entry.test.mjs": "872a212379b5457992f5c4045054a6c9605d7fc7f28049b531da96c8a0ead89b"
			, "tests/helpers/reviewed-fin-wasm-entry-producer.mjs": "e379ec40739cc5eacac19c7deb812261ebc6687be24665688ef30f7722dd5a37"
			, "tests/helpers/reviewed-fin-wasm-entry.mjs": "f3e7d24c3582f8af0d0b9ee246edf5c41d7e7a6981a7bd12fc004e3d7e3cd216"
			, "tests/helpers/reviewed-fin-wasm-source-entry.mjs": "cd67e53795979d6a5641a2eebef0f605aeba24196b1682850a9c391f9f9cfc41"
			, "tests/helpers/wasm-frame-entry-observer.mjs": "c6677097983d33bb86796837394b44b79a139dd6b0c7ad96f9e1271dfcf37b59"
			, "tests/fixtures/reviewed-fin-wasm/javascript.mjs": "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
			, "tests/fixtures/reviewed-fin-wasm/javascript-entry.mjs": "a0bdeedebdf0ace601e96f8dda1fb35200dc3abdd6cf41b0aabbe62adce832af"
			, "tests/fixtures/reviewed-fin-wasm/entry-observation.mjs": "a7b6d8bf99fad5b40df38484f5a19c8eb46b11247e32d70a862816b655454814"
			, "tests/helpers/reviewed-fin-wasm-install.mjs": "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
			, "tests/helpers/reviewed-fin-wasm-fixture.mjs": "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
			, "tests/helpers/reviewed-fin-wasm-typescript.mjs": "cdfb35044fe6e5ccda580dc5b1df1d2161f026b9c2a99e8a9618949d79d31c77"
			, "tests/helpers/reviewed-fin-wasm-browser.mjs": "cccaf1638b72e653fe637a61af8a17fa381a421e171806f7ffbd75e8fe24c639"
			, "tests/helpers/type-corpus-browser.mjs": "ca503281cfeed8d7968cc866fdb5ee8b0728a6efbc5f79acef4fcf992bf6f932"
			, "tests/helpers/type-corpus.mjs": "d76e871b4f76c524d44a2be6fda23d73a9b3162d9bca9eafe113f1a38f9f4f43"
			, "tests/helpers/refinement-engine.mjs": "91e69b67d355d2b436fa699a5e4a4692362bdc4f9536634877b6af41e968d3b4"
			, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean": "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
			, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
			, "src/backends/javascript/generate.mjs": "893a39db70644e6989e9f2766a55fe68b9ad90bb8ea9efbee88379f1e9a93014"
			, "src/build/component-callable-adapters.mjs": "958e629d9012f0ef7c94b72318b520a4181bb2f585e5558188ddd72503c96425"
			, "src/build/lake-entry-engine.mjs": "4686cd10fa95b0563c383f9820b17be021e7ef01e5ceda21adb921e20124cc21"
			, "src/build/component-engine.mjs": "bb72f15591546201f2bea8dc4f917fad3c6d2325c0405099ca9e6064228662c7"
			, "src/release/component-runtime.mjs": "34e71aed9cbcfa16d4a6641eb310ba03917207435ae4a4ddb9a834f0c05b67ad"
			, "src/release/component-copied-runtime.mjs": "fd2900bab92704b9d877efbc66567fc71037a3c183cd9dfe4a08678e5c3d8e97"
			, "src/release/component-npm-package.mjs": "f7c4e8196814cdb6dafe16173740f762c9bf2208b6fa10650be8855f12b1b3c4"
		}
	}
]);

export const wasmEntryRevisions = Object.freeze([...new Set(wasmEntryAttempts.map(attempt => attempt.revision))]);
/**
 * Archive path of one producer source as Git held it at a revision.
 *
 * @param revision - Producer commit.
 * @param path - Repository path.
 */
export const wasmEntrySnapshot = (revision, path) => archived(`sources/${revision.slice(0, 7)}/${path}.txt`);
const collectSources = () => {
	const all = new Map();
	for(const attempt of wasmEntryAttempts) for(const [path, digest] of Object.entries(attempt.sources))
	{
		const key = `${attempt.revision}\0${path}`;
		assert.ok(!all.has(key) || all.get(key).sha256 === digest, `${path} differs within ${attempt.revision}`);
		all.set(key, { revision: attempt.revision, path, sha256: digest });
	}
	return [...all.values()].sort((a, b) => `${a.revision}${a.path}`.localeCompare(`${b.revision}${b.path}`));
};
/** Distinct producer sources by revision, in archive order. */
export const wasmEntrySources = Object.freeze(collectSources());
export const wasmEntryPaths = Object.freeze([
	...wasmEntryAttempts.flatMap(attempt => Object.keys(attempt.files).map(name => archived(`${attempt.id}/${name}`)))
	, ...Object.keys(wasmEntryFrozen).map(archived)
	, ...wasmEntrySources.map(source => wasmEntrySnapshot(source.revision, source.path))
]);

/**
 * The mode, route and selection a report name declares.
 *
 * @param name - Report name, as the producer test saved it.
 */
export const wasmEntryCase = name => {
	const [mode, route, selection, ...rest] = name.split("-");
	assert.ok(modes.includes(mode) && Object.hasOwn(routes, route) && selections.includes(selection) && !rest.length, name);
	return { mode, path: routes[route], selection };
};

/**
 * Recount one retained report from its transcripts alone, against the frozen expectation and TypeScript consumer and
 * the coverage the attempt declared, never what the report claims.
 *
 * @param report - Retained report.
 * @param expected - Frozen expectation of its mode and selection.
 * @param typescript - Frozen strict TypeScript consumer of its selection.
 * @param engines - Declared browser engines; empty for a Node-only attempt.
 */
export const recountArchivedWasmEntryReport = (report, expected, typescript, engines) => {
	assert.deepEqual([report.mode, report.selection, report.calls], [expected.mode, expected.selection, expected.calls.length]);
	assert.equal(report.typescriptSha256, sha256(typescript), "the strict TypeScript consumer");
	const preludes = { "node-javascript": [], "node-typescript": reviewedFinWasmTypeScriptPrelude(typescript, expected.selection) };
	assert.deepEqual(report.contexts.map(context => context.profile), [...Object.keys(preludes), ...engines.length ? reviewedFinBrowserProfiles : []], "the declared contexts, no more and no fewer");
	for(const context of report.contexts)
	{
		assert.deepEqual([context.mode, context.source, context.calls], [expected.mode, expected.mode === "probe", report.calls], context.profile);
		if(Object.hasOwn(preludes, context.profile)) assert.deepEqual(context.prelude, preludes[context.profile], `${context.profile} prelude`);
		else assert.deepEqual(context.engines, engines, `${context.profile} engines`);
	}
	for(const [digest, text] of Object.entries(report.transcripts)) assert.equal(sha256(text), digest, "a retained transcript is its digest's bytes");
	const transcript = digest => {
		assert.ok(Object.hasOwn(report.transcripts, digest), `transcript ${digest} is retained`);
		return JSON.parse(report.transcripts[digest]);
	};
	let runs = 0;
	for(const context of report.contexts)
	{
		const browser = Object.hasOwn(reviewedFinWasmEntryBrowserPhases, context.profile);
		if(browser)
		{
			assertReviewedFinWasmEntryPhases(context);
			for(const execution of context.executions) transcript(execution.transcriptSha256);
		}
		for(const observation of browser ? context.observations : [context])
		{
			const parsed = transcript(observation.transcriptSha256);
			const accounted = accountReviewedFinWasmEntryReport(expected, browser ? parsed.results : parsed, browser ? [] : preludes[context.profile]);
			assert.deepEqual(accounted, { mode: observation.mode, calls: observation.calls, columns: observation.columns, source: observation.source, prelude: observation.prelude }, `${context.profile} recount`);
			runs++;
		}
	}
	return runs;
};

/**
 * Accounted runs a report must hold: two Node runs, plus every page, React and worker observation per engine.
 *
 * @param engines - Declared browser engines; empty for a Node-only attempt.
 */
export const wasmEntryRuns = engines => 2 + engines.length * Object.values(reviewedFinWasmEntryBrowserPhases).reduce((sum, item) => sum + item.variants.length * item.phases.length, 0);

/**
 * Check one attempt's original records: its queue, end record, TAP and, for a passing attempt, each report.
 *
 * @param attempt - Pinned attempt identity.
 * @param records - Parsed archive members.
 * @param records.queue - Producer queue.
 * @param records.start - Start record.
 * @param records.end - End record.
 * @param records.tap - Original TAP.
 * @param records.runner - Original runner source.
 * @param records.reports - Report name to parsed report.
 * @param frozen - Frozen expectations by mode and selection, and TypeScript consumers by selection.
 */
export const assertWasmEntryAttempt = (attempt, { queue, start, end, tap, runner, reports }, frozen) => {
	assert.deepEqual([queue.revision, queue.tree, queue.startedAt], [attempt.revision, attempt.tree, attempt.startedAt]);
	assert.deepEqual(queue.sources, attempt.sources, "the producer authenticated exactly these sources");
	assert.equal(queue.runnerSha256, sha256(runner), "the queue names this runner");
	assert.equal(queue.environment.LEAN_NUM_THREADS, "1");
	assert.equal(queue.environment.LEAN_BRIDGE_REVIEWED_FIN_WASM_ENTRY_BROWSER_TEST === "1", attempt.engines.length > 0, "browser gate");
	assert.match(queue.scope, /not locked Nix or hosted acceptance$/u, "local scope only");
	if(attempt.engines.length)
	{
		assert.deepEqual(queue.requiredEngines, attempt.engines);
		assert.equal(queue.environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, attempt.engines.join(","));
		assert.deepEqual(Object.keys(queue.browserPreflight.engines), attempt.engines);
		for(const engine of attempt.engines) assert.equal(queue.browserPreflight.engines[engine].probe, true, engine);
	}
	assert.deepEqual(Object.keys(start).sort(), ["pgid", "pid", "startedAt"]);
	assert.equal(start.pid, start.pgid);
	assert.equal(end.tapSha256, sha256(tap), "the end record names this TAP");
	assert.equal(end.stoppedForDisk, false);
	const lines = tap.split("\n");
	const passed = attempt.outcome === "passed";
	assert.equal(end.code, passed ? 0 : 1);
	for(const line of [`# tests ${attempt.tests}`, `# pass ${passed ? attempt.tests : 0}`, `# fail ${passed ? 0 : attempt.tests}`, "# skipped 0", "# cancelled 0", "# todo 0"]) assert.ok(lines.includes(line), `${attempt.id}: ${line}`);
	assert.equal(lines.filter(line => /^not ok \d+ /u.test(line)).length, passed ? 0 : attempt.failure.count);
	if(!passed)
	{
		assert.equal(tap.split(`    ${attempt.failure.text}\n`).length - 1, attempt.failure.count, "each failure names the same refused comparison");
		assert.deepEqual([attempt.reports, Object.keys(reports)], [[], []], "a failed attempt retains no report");
		return 0;
	}
	assert.deepEqual(Object.keys(reports), attempt.reports);
	assert.equal(attempt.reports.length, attempt.tests);
	let runs = 0;
	for(const [name, report] of Object.entries(reports))
	{
		const declared = wasmEntryCase(name);
		assert.deepEqual([report.mode, report.path, report.selection], [declared.mode, declared.path, declared.selection], name);
		assert.ok(lines.includes(`ok ${attempt.reports.indexOf(name) + 1} - ${declared.mode} ${declared.path === "reviewed-ir" ? "independently reviewed" : "ordinary"} ${declared.selection} Fin entry is accounted in installed npm packages`), name);
		assert.deepEqual([report.schemaVersion, report.offlineInstall, report.compilerFreePath, report.sourceRemovedBeforeInstallation, report.reproducible, report.independentBuilds], [1, true, true, true, true, 2], name);
		assert.equal(Object.hasOwn(report, "instrumentation"), declared.mode === "probe", `${name}: only a probe is instrumented`);
		const counted = recountArchivedWasmEntryReport(report, frozen.expectations[`${declared.mode}-${declared.selection}`], frozen.typescript[declared.selection], attempt.engines);
		assert.equal(counted, wasmEntryRuns(attempt.engines), name);
		runs += counted;
	}
	return runs;
};

/**
 * Local scope only: the failed attempt is retained as failed, nothing is hosted or promoted, and the installed trees,
 * packages and builds are identified by digest only.
 *
 * @param artifacts - Exact original, frozen and source snapshot identities.
 */
export const wasmEntryReceipt = artifacts => ({ schemaVersion: 1
	, kind: "reviewed-fin-wasm-entry-acceptance"
	, revisions: wasmEntryRevisions
	, attempts: wasmEntryAttempts.map(attempt => ({ id: attempt.id, outcome: attempt.outcome, revision: attempt.revision, engines: attempt.engines, reports: attempt.reports }))
	, scope: {
		modes: ["original: the unmodified packages, observed at their Wasm adapter frames", "probe: separately built dbgTrace-instrumented Lean source plus an unrefined control export"]
		, routes: Object.values(routes)
		, selections
		, nodeContexts: ["node-javascript", "node-typescript"]
		, browserContexts: reviewedFinBrowserProfiles
		, engines: wasmEntryEngines
		, cases: 8
		, local: true
		, hostedCi: false
		, lockedNix: false
		, supportPromotion: false
		, retained: "Reports with every transcript, queues, start and end records, TAP, runners, runner output, frozen expectations and TypeScript consumers, and Git source snapshots; reports and expectations are gzip members authenticated by their inflated digests"
		, failedAttempts: wasmEntryAttempts.filter(attempt => attempt.outcome === "failed").map(attempt => ({ id: attempt.id, revision: attempt.revision, reason: failureReasons[attempt.id] }))
	}
	, artifacts
	, sources: wasmEntrySources.map(source => ({ ...source, snapshot: wasmEntrySnapshot(source.revision, source.path) })) });

/**
 * The original bytes of a member; gzip members are inflated within their declared size.
 *
 * @param path - Archive path.
 * @param bytes - Archived bytes.
 * @param expected - Pinned original size.
 */
const inflate = (path, bytes, expected) => path.endsWith(".gz") ? gunzipSync(bytes, { maxOutputLength: expected }) : bytes;

/**
 * Validate every path and byte before interpreting any record, then recount every report.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive-byte reader, injectable for corruption tests.
 * @param options - Whether to compare the frozen members with the live generators too.
 * @param options.currentSources - False only while staging.
 */
export const assertWasmEntryArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	assert.deepEqual(receipt.artifacts.map(file => file.path), wasmEntryPaths, "exact archive paths, with no duplicates or foreign paths");
	assert.deepEqual(receipt, wasmEntryReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const owner = wasmEntryAttempts.find(attempt => file.path.startsWith(archived(`${attempt.id}/`)));
		const frozen = Object.keys(wasmEntryFrozen).find(name => archived(name) === file.path);
		const source = wasmEntrySources.find(item => wasmEntrySnapshot(item.revision, item.path) === file.path);
		const expected = owner ? owner.files[file.path.slice(archived(`${owner.id}/`).length)]
			: frozen ? { original: "7eae444 generator", ...wasmEntryFrozen[frozen] } : { original: `git:${source.revision}:${source.path}`, sha256: source.sha256 };
		assert.ok(expected, file.path);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalBytes", "originalPath", "originalSha256", "path", "sha256"]);
		assert.deepEqual([file.originalPath, file.originalSha256], [expected.original, expected.sha256], file.path);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0 && Number.isSafeInteger(file.originalBytes) && file.originalBytes > 0);
		if(expected.bytes !== undefined) assert.equal(file.originalBytes, expected.bytes, file.path);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		const original = inflate(file.path, bytes, file.originalBytes);
		assert.equal(original.length, file.originalBytes); assert.equal(sha256(original), file.originalSha256, `${file.path} inflates to the original`);
		assert.equal(file.path.endsWith(".gz") || file.sha256 === file.originalSha256, true, file.path);
		files.set(file.path, original);
	}
	const text = name => files.get(archived(name)).toString("utf8");
	const frozen = {
		expectations: Object.fromEntries(modes.flatMap(mode => selections.map(selection => [`${mode}-${selection}`, JSON.parse(text(`expectations/${mode}-${selection}.json.gz`))])))
		, typescript: Object.fromEntries(selections.map(selection => [selection, text(`typescript/${selection}.ts.txt`)]))
	};
	for(const [key, expected] of Object.entries(frozen.expectations)) assert.deepEqual([expected.mode, expected.selection], key.split("-"), key);
	let runs = 0;
	for(const attempt of wasmEntryAttempts)
	{
		const member = name => text(`${attempt.id}/${name}`);
		const reports = Object.fromEntries(attempt.reports.map(name => [name, JSON.parse(member(`${name}.json.gz`))]));
		runs += assertWasmEntryAttempt(attempt, { queue: JSON.parse(member("queue.json")), start: JSON.parse(member("start.json")), end: JSON.parse(member("end.json")), tap: member("run.tap"), runner: member("runner.mjs.txt"), reports }, frozen);
	}
	// Every mode, route and selection passed in Node and, on every declared engine, in every browser context.
	const covered = engines => wasmEntryAttempts.filter(attempt => attempt.outcome === "passed" && attempt.engines.length === engines.length).flatMap(attempt => attempt.reports).sort();
	const all = modes.flatMap(mode => Object.keys(routes).flatMap(route => selections.map(selection => `${mode}-${route}-${selection}`))).sort();
	assert.deepEqual([covered([]), covered(wasmEntryEngines)], [all, all]);
	assert.equal(runs, 8 * wasmEntryRuns([]) + 8 * wasmEntryRuns(wasmEntryEngines));
	if(currentSources)
	{
		for(const mode of modes) for(const selection of selections)
			assert.equal(canonicalJson(await expectReviewedFinWasmEntry(selection, mode)), text(`expectations/${mode}-${selection}.json.gz`), `live ${mode} ${selection} expectation`);
		for(const selection of selections) assert.equal(reviewedFinWasmTypeScript(selection), text(`typescript/${selection}.ts.txt`), `live ${selection} TypeScript consumer`);
	}
	return { receipt, runs };
};

/**
 * Save an artifact once; identical repeats are allowed, but changed bytes never overwrite it.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated content to preserve.
 */
export const writeWasmEntryArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};
