/**
 * Authenticate the local reviewed Wasm acceptance and its earlier missing-header failure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { reviewedFinWasmIr } from "./reviewed-fin-wasm-fixture.mjs";
import { reviewedFinWasmMismatches } from "./reviewed-fin-wasm-mismatches.mjs";
import { reviewedFinWasmTypeScript } from "./reviewed-fin-wasm-typescript.mjs";

export const wasmRefusalDirectory = "docs/evidence/reviewed-fin-wasm-refusals-20261009";
export const wasmRefusalRevision = "d5a61df812a10d4cf22077048e7fa582af35accd";
const run = "build/vo1438-wasm-refusals-d5a61df";
const archived = name => `${wasmRefusalDirectory}/${name}`;
export const wasmRefusalOriginals = Object.freeze({
	"failed/queue.json": { original: `${run}/queue.json`, sha256: "c01f47c993440a526e639b0303bd1ac3e7adc347827e916943ccdf9d03110eab" }
	, "failed/end.json": { original: `${run}/end.json`, sha256: "64af97084a57d04c89d1bee87bfe5493b4f6483e5e196a85f2ca741dd4676a5c" }
	, "failed/run.tap": { original: `${run}/run.tap`, sha256: "e14bb1de43eb6bac5b34416b6f82d70a0ed12f74500c59dbacc3a0507ec4b057" }
	, "failed/runner.mjs.txt": { original: "build/run-vo1438-wasm-refusals-d5a61df.mjs", sha256: "3e590b2d2c409dad92876f81e726d6f74ce4a8b05250698c4d84897d0c435c44" }
	, "queue.json": { original: `${run}-r2/queue.json`, sha256: "32b12b8796335f52ba58103a58f6a3eeb557eefd795a184265b56d3d30499133" }
	, "end.json": { original: `${run}-r2/end.json`, sha256: "2cbb8f1535ceba488385639dee6698e826383dccf7879cf2006f5acb3072a08f" }
	, "run.tap": { original: `${run}-r2/run.tap`, sha256: "29a60e2be5460979713d5787d99e71c97c8ccf36ca4bb21f4f6e8006fbf57841" }
	, "reviewed-scalar.json": { original: `${run}-r2/reviewed-scalar.json`, sha256: "b965a5bae959dd82c4e43405ad0ff7baba8f7d79d597012f49fd76511918281f" }
	, "reviewed-structural.json": { original: `${run}-r2/reviewed-structural.json`, sha256: "c677620259107f876e8a01c66147e00e526505de8842d676fef10a20a2a2ba31" }
	, "runner.mjs.txt": { original: "build/run-vo1438-wasm-refusals-d5a61df-r2.mjs", sha256: "a348b9f5e5b02d84a81f666b4fa689a7e1b4bbf6e336f049f049f9d703b7f772" }
	, "audit.mjs.txt": { original: "build/audit-vo1438-wasm-refusals-d5a61df.mjs", sha256: "afaa08911c3bfa47e3f60d12432ecf204e795965a74f871f2901267eb617ef03" }
	, "audit.json": { original: "build/vo1438-wasm-refusals-independent-audit-accepted.log", sha256: "84abfdd022a3774ea403218bf23c59268640b13859b2549ba029b07798f097c6" }
});
export const wasmRefusalSources = Object.freeze({
	"tests/generic-records.test.mjs": "653fd14d0a26c590615fa5cef113578976df32f1fb7581bb356dde05baa5bcb1"
	, "tests/helpers/reviewed-fin-wasm-installed-tests.mjs": "cc0091f89787963c577ae80b15654311f31d10a15bcb5c63982d06c84b2fdf57"
	, "tests/helpers/reviewed-fin-wasm-mismatches.mjs": "df82d1fcc2c4afc78dafab93db99dfaa4cdec78ddada7a2b32d020d0a6bce0a3"
	, "tests/helpers/reviewed-fin-wasm-install.mjs": "8e0bff658d5ff10d8a62d1021562969d7fcb1a9a95ae2b50ba524b2eb0dc5cd8"
	, "tests/helpers/reviewed-fin-wasm-fixture.mjs": "fbbb18d5875d51ffa74b16d62280bd7d28bf11d85f390429737dd9ae8a4a7625"
	, "tests/helpers/reviewed-fin-wasm-typescript.mjs": "cdfb35044fe6e5ccda580dc5b1df1d2161f026b9c2a99e8a9618949d79d31c77"
	, "tests/helpers/reviewed-fin-wasm-browser.mjs": "cccaf1638b72e653fe637a61af8a17fa381a421e171806f7ffbd75e8fe24c639"
	, "tests/helpers/refinement-engine.mjs": "91e69b67d355d2b436fa699a5e4a4692362bdc4f9536634877b6af41e968d3b4"
	, "tests/fixtures/reviewed-fin-wasm/javascript.mjs": "dcab9f420cd1f7b4d8363cf0de7ddf94f6e6cd610a9a885eefe1987aab86be4a"
	, "tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean": "367274a75a77938d2358e5b7106937cca0737025e3f887578d76544372b9ba07"
	, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
	, "src/build/lake-entry-engine.mjs": "4686cd10fa95b0563c383f9820b17be021e7ef01e5ceda21adb921e20124cc21"
	, "src/build/component-engine.mjs": "bb72f15591546201f2bea8dc4f917fad3c6d2325c0405099ca9e6064228662c7"
});
const runtimeRoot = "/app/build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser";
const runtimeWasm = "d8a9f3861d518d8311340b0e02c6a9aa73ba191b09a7ab4d6ac937d5e3e82d0b";
const runtimeInputs = {
	[`${runtimeRoot}/cmake/include/lean/lean.h`]: "22eed50aa703c4403010fabc12a7231ffa34dc979bd59ca1bfbac13c29a1dad2"
	, [`${runtimeRoot}/source/src/include/lean/lean.h`]: "22eed50aa703c4403010fabc12a7231ffa34dc979bd59ca1bfbac13c29a1dad2"
	, "/app/build/lean-link-spike/lazy/main.mjs": "8b791a4711e58876e29b5e0a7c3fcbab500b02d7550fe6f7c3321020a736be02"
	, "/app/build/lean-link-spike/lazy/main.wasm": runtimeWasm
};
const identities = {
	scalar: { metadata: "500e9c4a968692217a111eb957de88abcdb80b5f21b9151dff92c2925d2b7605"
		, binding: "fbab49ee610a9aeaa1379fb8837416e412a426aa05664a3adf8017e2ae679af2"
		, receipt: "7379003f3bf689d0496b076874ded406ff11c099b6c25bcd2598a06f52ab0abe"
		, declarations: "d68ee14687422dbd1c373cf63f2a80fc567ba5b90b1be17e1f17771cad082c2d" }
	, structural: { metadata: "9412068b15c0f897f6a9fa86f3bc7445c6fccc72ffca99d13e8240a76e3de568"
		, binding: "da8cd7c4c4f070dc09def27f89abb1b15e1a1d65fba93664da141698e9bc65a2"
		, receipt: "998bdc48d4cc2eeddde3141577c226ca36041487ca41f7cd179d8ce5703dfb01"
		, declarations: "3d19b88b40831f89120d5eb84bd3303bd6a553af270dc6bb1e58d03d2d60e3e2" }
};
const selections = ["scalar", "structural"];
/**
 * Locate a selected producer source without using its original absolute directory.
 *
 * @param path - Repository-relative producer source.
 */
export const wasmRefusalSnapshot = path => archived(`sources/d5a61df/${path}.txt`);
export const wasmRefusalPaths = Object.freeze([...Object.keys(wasmRefusalOriginals).map(archived), ...Object.keys(wasmRefusalSources).map(wasmRefusalSnapshot)]);

const assertAttempt = ({ queue, end, tap }, successful) => {
	assert.equal(queue.revision, wasmRefusalRevision);
	assert.equal(queue.tree, "8e6b6f72c843df20d4776b66554a46a1db31175f");
	assert.equal(queue.cwd, "/app/build/worktrees/reviewed-wasm-refusal-vo1438");
	assert.deepEqual(queue.sources, wasmRefusalSources);
	assert.equal(queue.runnerSha256, wasmRefusalOriginals[successful ? "runner.mjs.txt" : "failed/runner.mjs.txt"].sha256);
	assert.deepEqual(queue.command, ["/usr/bin/taskset", "-c", "3"
		, "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap"
		, "--test-name-pattern=^independently reviewed (scalar|structural) Fin runs in source-free installed npm packages$"
		, "tests/generic-records.test.mjs"]);
	const environment = { NO_COLOR: "1"
		, LEAN_BRIDGE_REVIEWED_FIN_WASM_TEST: "1"
		, LEAN_BRIDGE_REVIEWED_FIN_WASM_BROWSER_TEST: "1"
		, LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: "chromium,firefox,webkit"
		, LEAN_BRIDGE_REVIEWED_FIN_WASM_REPORT_DIR: `/app/${run}${successful ? "-r2" : ""}`
		, LEAN_BRIDGE_LAKE_RUNTIME_ROOT: "/app/build/lean-link-spike/lazy"
		, PLAYWRIGHT_BROWSERS_PATH: "/app/.toolchains/playwright"
		, LEAN_BRIDGE_LEAN: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1" };
	if(successful) environment.LEAN_BRIDGE_RUNTIME_ROOT = runtimeRoot;
	assert.deepEqual(queue.environment, environment);
	assert.deepEqual(queue.runtimeInputs, successful ? runtimeInputs : undefined);
	assert.deepEqual(queue.unset, ["FORCE_COLOR", "other LEAN_BRIDGE_* variables"]);
	assert.equal(queue.node, "v22.23.2"); assert.equal(queue.glibc, "glibc 2.36");
	assert.equal(queue.lean, "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)");
	assert.equal(queue.scope, "Local in-process real Lean/Wasm compiler, installed Node JS/TS and three browser engines; not locked Nix or hosted acceptance");
	assert.equal(queue.startedAt, successful ? "2026-10-09T04:28:25.832Z" : "2026-10-09T04:26:39.653Z");
	assert.equal(queue.freeMiB, successful ? 5206 : 5209); assert.equal(queue.stopFloorMiB, 1024);
	assert.deepEqual(end, { code: successful ? 0 : 1
		, signal: null, stoppedForDisk: false
		, minimumFreeMiB: successful ? 4475 : 5195
		, endedAt: successful ? "2026-10-09T04:40:13.588Z" : "2026-10-09T04:28:00.385Z"
		, tapSha256: sha256(tap) });
	for(const [label, count] of [["tests", 2], ["pass", successful ? 2 : 0], ["fail", successful ? 0 : 2], ["cancelled", 0], ["skipped", 0], ["todo", 0]])
		assert.match(tap, new RegExp(`^# ${label} ${count}$`, "mu"));
	assert.match(tap, /^1\.\.2$/mu);
	for(const [index, selection] of selections.entries())
		assert.match(tap, new RegExp(`^${successful ? "ok" : "not ok"} ${index + 1} - independently reviewed ${selection} Fin runs in source-free installed npm packages$`, "mu"));
	if(successful) assert.doesNotMatch(tap, /^\s*not ok /mu);
	else assert.equal(tap.match(/^ {2}code: 'shared-runtime-headers-unavailable'$/gmu)?.length, 2);
};

/**
 * Check fresh compiler refusals and installed observations independently of report hashes.
 *
 * @param records - Successful attempt, failed attempt and the two parsed reports.
 */
export const assertWasmRefusalRecords = records => {
	assertAttempt(records, true); assertAttempt(records.failed, false);
	assert.deepEqual(records.reports.map(report => report.selection), selections);
	for(const report of records.reports)
	{
		const { selection } = report, identity = identities[selection];
		assert.deepEqual(Object.keys(report).sort(), [
			"bindingIrSha256", "browser", "compilerFreePath", "compilerSha256"
			, "consumerSha256", "executions", "independentBuilds", "metadataSha256"
			, "mismatches", "offlineInstall", "path", "privateAbi", "receipt"
			, "receiptSha256", "refinements", "reproducible", "reviewedSourceSha256"
			, "schemaVersion", "selection", "sourceRemovedBeforeInstallation"
			, "sourceSha256", "typescript"]);
		assert.equal(report.schemaVersion, 1); assert.equal(report.path, "reviewed-ir");
		assert.equal(report.privateAbi, selection === "scalar" ? 2 : 6); assert.equal(report.independentBuilds, 2);
		for(const flag of ["reproducible", "sourceRemovedBeforeInstallation", "compilerFreePath", "offlineInstall"]) assert.equal(report[flag], true);
		const expected = reviewedFinWasmIr(selection);
		assert.equal(report.reviewedSourceSha256, sha256(canonicalJson(expected)));
		assert.equal(report.sourceSha256, wasmRefusalSources["tests/fixtures/onboarding/reviewed-fin-wasm/ReviewedFin.lean"]);
		assert.equal(report.consumerSha256, wasmRefusalSources["tests/fixtures/reviewed-fin-wasm/javascript.mjs"]);
		assert.equal(report.compilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
		assert.equal(report.metadataSha256, identity.metadata); assert.equal(report.bindingIrSha256, identity.binding);
		assert.deepEqual(report.refinements, Object.fromEntries(expected.declarations.map(item => [item.source.declaration, item.source.extensions["lean-lang.org/refinements"]])));
		assert.deepEqual(report.mismatches, reviewedFinWasmMismatches(selection).map(({ label, ir, expectedField }) => ({ label
			, reviewedSourceSha256: sha256(canonicalJson(ir))
			, expectedField, fieldObserved: true
			, code: "reviewed-ir-source-mismatch", outputAbsent: true })));
		assert.deepEqual(report.typescript, { strict: true, skipLibCheck: false
			, sourceSha256: sha256(reviewedFinWasmTypeScript(selection))
			, compilerSha256: "e8f349eabd48486bdb2bf9dc1a00c89d58297270c54b745838879e2859194419"
			, declarationsSha256: identity.declarations });
		assert.equal(report.receiptSha256, identity.receipt); assert.equal(sha256(canonicalJson(report.receipt)), identity.receipt);
		assert.equal(report.receipt.bindingIrSha256, report.bindingIrSha256);
		const result = { module: "reviewed-fin", selection, checks: selection === "scalar" ? 50 : 200, rejections: selection === "scalar" ? 126 : 270 };
		assert.deepEqual(report.executions, ["node-javascript", "node-typescript"].map(profile => ({ profile, hostVersion: records.queue.node, result })));
		assert.deepEqual(report.browser.map(item => item.profile), ["browser-javascript", "browser-react", "browser-worker"]);
		for(const { profile, browser } of report.browser)
		{
			assert.deepEqual(browser.requestedEngines, ["chromium", "firefox", "webkit"]);
			assert.equal(browser.externalNetworkBlocked, true); assert.equal(browser.installedSourcesRemoved, true);
			const variants = profile === "browser-react" ? ["production", "strict"] : ["production"];
			assert.deepEqual(browser.executions.map(item => `${item.engine}:${item.variant}`), browser.requestedEngines.flatMap(engine => variants.map(variant => `${engine}:${variant}`)));
			for(const execution of browser.executions)
			{
				assert.equal(execution.observation.profile, profile); assert.deepEqual(execution.observation.results, result);
				assert.equal(execution.observation.module, "reviewed-fin"); assert.equal(execution.observation.schemaVersion, 1);
				assert.equal(execution.observation.realm, profile === "browser-worker" ? "dedicated-worker" : "window");
				assert.equal(typeof execution.observation.hostVersion, "string"); assert.ok(execution.observation.hostVersion.length > 0);
				assert.equal(execution.failedAssetRecovery, true);
				assert.deepEqual([...new Set(execution.assets.map(asset => asset.sha256))].sort(), [runtimeWasm, report.receipt.componentArtifactSha256].sort());
				for(const asset of execution.assets)
				{
					assert.equal(asset.status, 200); assert.equal(asset.mime, "application/wasm");
					assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0); assert.match(asset.path, /^\/corpus\/nested\/assets\/[^/]+\.wasm$/u);
				}
				if(profile === "browser-react") assert.equal(execution.pendingUnmount, true);
				if(profile === "browser-worker") assert.deepEqual(execution.lifecycle, { created: 2, live: 0, terminated: 2 });
			}
		}
	}
};

/**
 * Record local compiler and installed execution evidence without claiming dispatch counters.
 *
 * @param artifacts - Exact original records and selected Git snapshots.
 */
export const wasmRefusalReceipt = artifacts => ({ schemaVersion: 1
	, kind: "reviewed-fin-wasm-fresh-lean-refusals"
	, revision: wasmRefusalRevision
	, scope: { selections, privateAbis: [2, 6]
		, matchingBuilds: 4, refusedReviews: 18, mismatchFieldsObserved: true
		, nodeExecutions: 4, browserExecutions: 24, localGlibc: "2.36"
		, hostedCi: false, lockedNix: false, entryCounterEvidence: false
		, failedAttempts: 1, failure: "shared-runtime-headers-unavailable"
		, sourceIdentity: "Selected producer sources, not a complete dependency closure"
		, runtimeIdentity: "Recorded header/runtime hashes, not archived runtime binaries" }
	, artifacts
	, sources: Object.entries(wasmRefusalSources).map(([path, sha256]) => ({ path, sha256, snapshot: wasmRefusalSnapshot(path) })) });

/**
 * Authenticate every artifact before interpreting observations or checking current sources.
 *
 * @param receipt - Parsed immutable archive receipt.
 * @param read - Reader for repository-relative archive paths only.
 * @param options - Whether current source identities should also be checked.
 * @param options.currentSources - False only when staging authenticated original Git snapshots.
 */
export const assertWasmRefusalArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	assert.deepEqual(receipt.artifacts.map(file => file.path), wasmRefusalPaths);
	assert.deepEqual(receipt, wasmRefusalReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const original = Object.entries(wasmRefusalOriginals).find(([name]) => archived(name) === file.path)?.[1];
		const source = Object.entries(wasmRefusalSources).find(([path]) => wasmRefusalSnapshot(path) === file.path);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.equal(file.originalPath, original?.original ?? `git:${wasmRefusalRevision}:${source[0]}`);
		assert.equal(file.sha256, original?.sha256 ?? source[1]); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path); files.set(file.path, bytes);
	}
	const json = name => JSON.parse(files.get(archived(name)));
	assertWasmRefusalRecords({ queue: json("queue.json"), end: json("end.json")
		, tap: files.get(archived("run.tap")).toString()
		, failed: { queue: json("failed/queue.json"), end: json("failed/end.json"), tap: files.get(archived("failed/run.tap")).toString() }
		, reports: selections.map(selection => json(`reviewed-${selection}.json`)) });
	if(currentSources) for(const [path, digest] of Object.entries(wasmRefusalSources))
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path, "utf8"), digest)), digest, path);
	return receipt;
};
