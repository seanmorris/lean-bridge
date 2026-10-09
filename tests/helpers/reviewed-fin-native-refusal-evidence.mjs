/**
 * Authenticate the completed local native fresh-Lean refusal run without promoting host support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { reviewedFinRefusalExpectations, reviewedFinRefusalFixtures } from "./reviewed-fin-refusals.mjs";

export const nativeRefusalDirectory = "docs/evidence/reviewed-fin-native-refusals-20261009";
export const nativeRefusalRevision = "b6b06ef9518aa556528e9bd6768a2ee1a648daa6";
const run = "build/vo1438-native-refusals-b6b06ef";
const archived = name => `${nativeRefusalDirectory}/${name}`;
export const nativeRefusalOriginals = Object.freeze({
	"queue.json": { original: `${run}/queue.json`, sha256: "9da0c7580b7da60bd5e2f29efcc0671d32cf1ea1121b55f47534baa02db3754a" }
	, "end.json": { original: `${run}/end.json`, sha256: "d3e16cfc57eec89a36c24bc9538c11545e7e85f5f33e8bf848e33a0e9566b189" }
	, "run.tap": { original: `${run}/run.tap`, sha256: "81e7e0517fc1b0524be8acf6fe7ce52ba7dda207803f6931194c3b2736c1615e" }
	, "native-fin.json": { original: `${run}/native-fin.json`, sha256: "1a66679a7b884b367de3238e00433c7d092b3253234ae2155fc898a4dd3d6d7c" }
	, "fin-containers.json": { original: `${run}/fin-containers.json`, sha256: "e54fa71b078b66e830c16c1d83e601359102c13f730671be2a649f4ccc6ebd9d" }
	, "runner.mjs.txt": { original: "build/run-vo1438-native-refusals-b6b06ef.mjs", sha256: "3a37edea3b9a2a80200fcbc5e34c6dda6ccc5895237f82ea1c752ba71f4db058" }
	, "audit.mjs.txt": { original: "build/audit-vo1438-native-refusals-b6b06ef.mjs", sha256: "66f98ae56d28ddc8a544ca947af1182a425cf612fb64ee1a7eb49fbfac6ff430" }
	, "audit.json": { original: "build/vo1438-native-refusals-independent-audit.log", sha256: "4aad4dbd3e1f2f083c5ba154c090f1df35558484b27c8bebd1e59644ab47e529" }
});
export const nativeRefusalSources = Object.freeze({
	"tests/reviewed-fin-refusals.test.mjs": "bec62f6158afb23accdb8ec536e2dbff8f918f069c221f6f0ded0548c491f500"
	, "tests/helpers/reviewed-fin-refusals.mjs": "da6cb9e1235c7865edd91029d5c7167389e3319bae1693ebcc1486b3301430cc"
	, "tests/helpers/reviewed-fin-fixture.mjs": "92f3a2cbc3230bf54b591af49cfa4f1b07defd70073f648a0fd622b5c4aaebc1"
	, "tests/helpers/reviewed-fin-container-fixture.mjs": "5e4d92f9bb4ccff65fb9356cc3a6613f5102665e59dbe38b99868e4804c8a132"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
	, "tests/fixtures/onboarding/native-fin/NativeFin.lean": "7399d8119ceced0dca35994130e85636025cb2340d7265dff9dd9062e4e17c3b"
	, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
	, "src/analyze/reviewed-source.mjs": "d3a875e4fc6dca6b7a93e70db62980d01f5b2a68f2e5e8999b93bbf0ca04a462"
	, "src/analyze/semantic-model.mjs": "ec175517574f2e76ed346d961b7f5e3bc2eac96e95b6c0b535cf8e25449b3dcc"
	, "src/analyze/NativeExports.lean": "46b46cbb21fe51d166ab700cde2c41583bc3a093f67cecd07d104cdf649f61ce"
	, "src/build/canonical-build.mjs": "17e88b02d75c81379c0a8f6e6b14ab583fabfaa8b7fdb747174505256ca48e7c"
	, "src/build/native-project.mjs": "b941e848c291a05a4fab3e93f2d9f5d3a5c9380f9a290c5668378c05ae5b5cf7"
	, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
});
/**
 * Archive path for a selected, exact producer source.
 *
 * @param path - Repository-relative source identity.
 */
export const nativeRefusalSnapshot = path => archived(`sources/b6b06ef/${path}.txt`);
export const nativeRefusalPaths = Object.freeze([...Object.keys(nativeRefusalOriginals).map(archived), ...Object.keys(nativeRefusalSources).map(nativeRefusalSnapshot)]);
const controlBindings = ["5326c873df1ad4a1a2fdb14af6b5a998b2fefbdebf2aa8ddb2fa0944134a2821", "ba4b5ca272ca2c0f48de7fe0d85d87b0fbfb54b1d051a552aae2d1ac8df5cc56"];

/**
 * Check observed compiler refusals independently of artifact hashes.
 *
 * @param records - Parsed original records and raw TAP.
 */
export const assertNativeRefusalRecords = records => {
	const { queue, end, tap, reports } = records;
	assert.equal(queue.revision, nativeRefusalRevision);
	assert.equal(queue.tree, "b7069ad3c74c463dd3f7e8416d9d224a19aaeb48");
	assert.deepEqual(queue.sources, nativeRefusalSources);
	assert.deepEqual(queue.command, ["/usr/bin/taskset", "-c", "3", "/usr/bin/node", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/reviewed-fin-refusals.test.mjs"]);
	assert.equal(queue.cwd, "/app/build/worktrees/clean-75a5114");
	assert.equal(queue.scope, "Local fresh-Lean native refusal gates; not hosted release-floor acceptance");
	assert.equal(queue.runnerSha256, nativeRefusalOriginals["runner.mjs.txt"].sha256);
	assert.deepEqual(queue.environment, { NO_COLOR: "1"
		, LEAN_BRIDGE_REVIEWED_FIN_REFUSALS: "native-fin,fin-containers"
		, LEAN_BRIDGE_REVIEWED_FIN_REFUSAL_REPORT_DIR: `/app/${run}`
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
		, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1" });
	assert.deepEqual(queue.unset, ["FORCE_COLOR", "other LEAN_BRIDGE_* variables"]);
	assert.equal(queue.node, "v22.23.2"); assert.equal(queue.glibc, "glibc 2.36");
	assert.equal(queue.lean, "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)");
	assert.equal(queue.stopFloorMiB, 1024); assert.equal(queue.freeMiB, 4685);
	assert.equal(queue.startedAt, "2026-10-09T04:12:55.614Z");
	assert.deepEqual(end, { code: 0, signal: null, stoppedForDisk: false
		, minimumFreeMiB: 4039
		, endedAt: "2026-10-09T04:26:07.405Z", tapSha256: sha256(tap) });
	for(const [label, count] of [["tests", 23], ["pass", 23], ["fail", 0], ["cancelled", 0], ["skipped", 0], ["todo", 0]])
		assert.match(tap, new RegExp(`^# ${label} ${count}$`, "mu"));
	assert.doesNotMatch(tap, /^\s*not ok /mu);
	assert.equal(reports.length, 2);
	for(const [index, entry] of reviewedFinRefusalFixtures.entries())
	{
		const expected = reviewedFinRefusalExpectations(entry);
		assert.deepEqual(reports[index], { schemaVersion: 1, fixture: entry.fixture
			, module: entry.module, target: "c"
			, control: { reviewSha256: sha256(canonicalJson(entry.review())), bindingIrSha256: controlBindings[index], published: true }
			, cases: expected.map(({ label, field, reviewSha256 }) => ({ label, field, reviewSha256, code: "reviewed-ir-source-mismatch", releaseRoot: "ENOENT" })) });
		assert.match(tap, new RegExp(`^ok [0-9]+ - changed ${entry.label} reviews are refused against fresh Lean beside a publishing control$`, "mu"));
		for(const { label } of expected)
			assert.ok(tap.split("\n").some(line => /^ {4}ok [0-9]+ - /u.test(line) && line.endsWith(` - ${label}`)), label);
	}
};

/**
 * Describe only the completed local reconciliation run, not installed host support.
 *
 * @param artifacts - Exact original and source snapshot identities.
 */
export const nativeRefusalReceipt = artifacts => ({ schemaVersion: 1
	, kind: "reviewed-fin-native-fresh-lean-refusals"
	, revision: nativeRefusalRevision
	, scope: { target: "c", fixtures: ["native-fin", "fin-containers"]
		, matchingBuilds: 2, refusedReviews: 19
		, localGlibc: "2.36", hostedCi: false, installedConsumerEvidence: false
		, entryCounterEvidence: false
		, sourceIdentity: "Selected producer sources, not a complete dependency closure" }
	, artifacts
	, sources: Object.entries(nativeRefusalSources).map(([path, sha256]) => ({ path, sha256, snapshot: nativeRefusalSnapshot(path) })) });

/**
 * Validate paths and every immutable byte before reading claims or current source identities.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive-byte reader, injectable for corruption tests.
 * @param options - Whether to authenticate the live producer sources too.
 * @param options.currentSources - False only while staging exact archived Git snapshots.
 */
export const assertNativeRefusalArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(file => file.path);
	assert.deepEqual(paths, nativeRefusalPaths, "exact archive paths, with no duplicates or foreign paths");
	assert.deepEqual(receipt, nativeRefusalReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const original = Object.entries(nativeRefusalOriginals).find(([name]) => archived(name) === file.path)?.[1];
		const source = Object.entries(nativeRefusalSources).find(([path]) => nativeRefusalSnapshot(path) === file.path);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.equal(file.originalPath, original?.original ?? `git:${nativeRefusalRevision}:${source[0]}`);
		assert.equal(file.sha256, original?.sha256 ?? source[1]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const json = name => JSON.parse(files.get(archived(name)));
	assertNativeRefusalRecords({ queue: json("queue.json"), end: json("end.json")
		, tap: files.get(archived("run.tap")).toString()
		, reports: [json("native-fin.json"), json("fin-containers.json")] });
	if(currentSources) for(const [path, digest] of Object.entries(nativeRefusalSources))
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path, "utf8"), digest)), digest, path);
	return receipt;
};

/**
 * Save an artifact once; identical repeats are allowed, but changed bytes never overwrite it.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated content to preserve.
 */
export const writeNativeRefusalArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};
