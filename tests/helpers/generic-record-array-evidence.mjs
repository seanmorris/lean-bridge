/**
 * Authenticate the local installed C, C++ and Python Array fields and results over alias-named generic records
 * (VO #1439): one c5e9760 producer run with three serial selections, every original record, and the producer's Git
 * sources, from which each composed consumer is rebuilt. Nothing here is hosted, promoted or other-host acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { genericRecordArrayConsumer } from "./generic-record-arrays.mjs";

export const arrayEvidenceDirectory = "docs/evidence/generic-record-arrays-20261009";
const archived = name => `${arrayEvidenceDirectory}/${name}`;
export const arrayEvidenceRevision = "c5e9760f92ae7e5ece9d561ee39585e94ceb9952";
const tree = "1cc4cbadfbfa665fbc7b72d8d59eda5eb15b31a1";
const runnerSha256 = "89f75f834ab4708dd99e99608e5faf05dbbd65f039951eedf60330b97af525c0";
const title = "relocated source-free native packages carry Array fields and results over alias-named generic records";
const module = "GenericRecords";
/** The three serial selections exactly as the runner declared them. */
export const arraySelections = Object.freeze([
	{ name: "c-cpp", profiles: ["c", "cpp"], report: "array-c-cpp.json" }
	, { name: "python311", profiles: ["python"], report: "array-python.json", python: "/app/.toolchains/python311/bin/python3", version: "3.11.16" }
	, { name: "python312", profiles: ["python"], report: "array-python312.json", python: "/app/.toolchains/python312/bin/python3", version: "3.12.14" }
]);
// Exact totals and composed consumers, as the runner pinned them independently of the reports.
const expected = Object.freeze({
	c: { checks: 2078, consumerSha256: "956323f95b7feb88299757af0691d4496aefa27bd899d1b161272ae62da1af94", base: 1029, extension: "c", marker: "  for (unsigned long i" }
	, cpp: { checks: 2058, consumerSha256: "c23c4154526af37d44326a05536965deca3ac57d941905eacd0dfe8432a05b28", base: 1024, extension: "cpp", marker: "  for (unsigned i" }
	, python: { checks: 2144, consumerSha256: "33fadefa74cf39963ffa1c0c5b733a16c9d83a915bb75aca18f8adde44374c80", base: 1036, extension: "py", marker: "for i in range(1000):" }
});
const named = id => ({ kind: "named", id });
const nat = { kind: "primitive", name: "nat" };
const array = element => ({ kind: "apply", constructor: "array", arguments: [element] });
/** Original records of the run, generated from the producer's output directory. */
export const arrayEvidenceFiles = Object.freeze({
	"queue.json": { original: "build/vo1439-generic-record-arrays-c5e9760/queue.json", sha256: "23d548aa3b9a69f9038e92d84535e53c313edf243843a77b69aeada6f7d90d9d", bytes: 7385 }
	, "runner.mjs.txt": { original: "build/run-vo1439-generic-record-arrays-c5e9760.mjs", sha256: "89f75f834ab4708dd99e99608e5faf05dbbd65f039951eedf60330b97af525c0", bytes: 10174 }
	, "runner-output.txt": { original: "build/vo1439-generic-record-arrays-c5e9760.runner.log", sha256: "3a72e27312b20faa0cd5ffc995809147ef93b47539cbd029ce0f888998420efd", bytes: 1505 }
	, "c-cpp/start.json": { original: "build/vo1439-generic-record-arrays-c5e9760/c-cpp/start.json", sha256: "9826c94d35971858147397ac5faaefde8ccdf0b3248a1caaf6582eedefae2a9b", bytes: 83 }
	, "c-cpp/end.json": { original: "build/vo1439-generic-record-arrays-c5e9760/c-cpp/end.json", sha256: "a7eac2ae85a5d3becf914d7e1a6e6091642f04cc5f2e8c5ce86a1465c02b9186", bytes: 211 }
	, "c-cpp/run.tap": { original: "build/vo1439-generic-record-arrays-c5e9760/c-cpp/run.tap", sha256: "546c1f3678c91c4fb2709f79ebd5be63072094301cc362187d431b6f33798941", bytes: 526 }
	, "python311/start.json": { original: "build/vo1439-generic-record-arrays-c5e9760/python311/start.json", sha256: "93b02205267216812e6d58023651ba1257510ab0cb5a97372ce215f11a235898", bytes: 83 }
	, "python311/end.json": { original: "build/vo1439-generic-record-arrays-c5e9760/python311/end.json", sha256: "eae5cb7f4e00019c3965c7efca56f5486ef70b2b67129889ae3917257e748c14", bytes: 211 }
	, "python311/run.tap": { original: "build/vo1439-generic-record-arrays-c5e9760/python311/run.tap", sha256: "63e6723e6e54a0e7ffa4f6fbae8da5b967768394cdea186b363a8bb3cf5de21b", bytes: 491 }
	, "python312/start.json": { original: "build/vo1439-generic-record-arrays-c5e9760/python312/start.json", sha256: "0ba527edb1f47ce96700728a79426aec2c82276fe08b6e7a47091282a5bde1b6", bytes: 83 }
	, "python312/end.json": { original: "build/vo1439-generic-record-arrays-c5e9760/python312/end.json", sha256: "5b71d9385278b5e138d286f5a75dba19c0a6c3f11cfa2a8e2489eea2b377a963", bytes: 211 }
	, "python312/run.tap": { original: "build/vo1439-generic-record-arrays-c5e9760/python312/run.tap", sha256: "24b69a9fb595c33b606ea7ec1bfe9d18d342db14a92f1f4d2582101e021ad995", bytes: 489 }
	, "array-c-cpp.json": { original: "build/vo1439-generic-record-arrays-c5e9760/array-c-cpp.json", sha256: "d212121d2d05462d3547a5937a4947c9aa52d5502e2ee6eb4586529964de1fb0", bytes: 14113 }
	, "array-python.json": { original: "build/vo1439-generic-record-arrays-c5e9760/array-python.json", sha256: "1a92ed30da2e36338b8e7843a14f4124087d246b0ceaad9edb21210e83af0433", bytes: 7374 }
	, "array-python312.json": { original: "build/vo1439-generic-record-arrays-c5e9760/array-python312.json", sha256: "3fcfe5d9bfe14e33ccf6ae82351bc2d4ae9a07bcceb60f8e3134e84a22ac929c", bytes: 7374 }
});
/** Every source the runner authenticated at c5e9760. */
export const arrayEvidenceSources = Object.freeze({
	"tests/generic-record-arrays.test.mjs": "670765fc8fbce045d87741d85569198ec0c5b1208c8e0a8108f0bbddc4646590"
	, "tests/helpers/generic-record-arrays.mjs": "432a988e832a72483fc326d3036b19117328d26f8ead43e142e08c2070fcfaca"
	, "tests/fixtures/generic-record-array-consumers/c.c": "6170d7b32244465dfe1fe7cffbe0d96c83837a17af4ebe39cedbae5913a3061c"
	, "tests/fixtures/generic-record-array-consumers/cpp.cpp": "5ca9ee39b74bd7b2ab9b6748c29bae8f4de0cfcbc42a05d3ef899dfc6bfd2ecb"
	, "tests/fixtures/generic-record-array-consumers/python.py": "8396fc1b42e790bfab538074fd4459ba06bf81c6520ed593a0d654cdbc45a6ba"
	, "tests/fixtures/generic-record-browser/GenericRecordArrays.lean": "a372869e7b472ee4fb5db20f2f34984aeddb94d9727fe64d8163559f20ffa7ec"
	, "tests/fixtures/generic-record-specializations.lean": "26e73e3a2f872d4a3399aa313cbb88da96992b36681e383a18818aefd552cce9"
	, "tests/fixtures/onboarding/generic-records/GenericRecords.lean": "01e2a3c3c4d7eb9552a32191d5ae69aad7b713a82607507c8f702a0cc624cf5f"
	, "tests/fixtures/generic-record-consumers/c.c": "3c6d5fb6bc446900e64a09a660d9de3fc86d64b7b3007ee849e2a17683465e70"
	, "tests/fixtures/generic-record-consumers/cpp.cpp": "28b7951075e73d958db4608538c9c047546bbc28145eeb037165e7b27f0faa17"
	, "tests/fixtures/generic-record-consumers/python.py": "10c90a85fa986251612e69a8fa9dfe67006d3ba8d04329ed42a6626b61f291ca"
	, "tests/fixtures/generic-record-specialization-consumers/c.c": "4ca635d51219e560bc45c98f97d05495db460372843fa63151764028fbdd8733"
	, "tests/fixtures/generic-record-specialization-consumers/cpp.cpp": "50f2248465f34075d1e8d3c852813764534d64c722a978f01a51248a557ddab4"
	, "tests/fixtures/generic-record-specialization-consumers/python.py": "c8d01e1ad3e136204a09490be165bb5e1e0c2bbca9f6ddd21c2f6f13de355fdd"
	, "tests/helpers/generic-record-browser.mjs": "6164fda2a59a4d0ec1cf0bf638570ecbb270ca943fd395f5f3b898b46d1bfcc5"
	, "tests/helpers/generic-record-packages.mjs": "749c6404fde73b89fe03054c40f39b3de20a49c428e8ba3f4e241681546835dd"
	, "tests/helpers/generic-record-specializations.mjs": "a8c06844daddc89b331f65eb330f59f19eaf7e9ab032294a826d5fefe857120f"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "tests/helpers/package-set.mjs": "8613cb6fa1e7cb6bce93444160cf3a4503973064f52b644984637e909e5da82c"
	, "src/build/canonical-build.mjs": "17e88b02d75c81379c0a8f6e6b14ab583fabfaa8b7fdb747174505256ca48e7c"
	, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
	, "src/backends/c/gmp-projection.mjs": "1669f605cfc646ac96e0c2258de26bb10630f9621cfd582cbfe986663a3b6e82"
	, "src/backends/c/gmp-values.mjs": "aa7bc5a2819b2eeb37741ae22f3beafb0e3c5404277cdadcb9081441d46830b6"
	, "src/backends/cpp/primitives.mjs": "6aaf142530630bc7a21bdea06b5072d18b190381becadd80933b191d84d61ec9"
	, "src/backends/cpp/copied-values.mjs": "ca8300d00227c4789b34ffbad22b33c64769a31856bc86b64e9d5d56c6ea331c"
	, "src/backends/python/generate.mjs": "68b032ac2da7c45b55de1d5f68ff0d310c475ef6998503be8e761eea73eae39c"
	, "src/backends/python/copied-conversions.mjs": "658271a8cfad111215b7072f8df29189f71f56dc15e3f7104e82bd8b50f2f936"
	, "src/release/package-set-receipt.mjs": "d0b945554b03e9d0f93149b12ddf808c33243cbb0ff5495a7a8a68e683fc71ed"
});

/**
 * Archive path of one producer source as Git held it at c5e9760.
 *
 * @param path - Repository path.
 */
export const arrayEvidenceSnapshot = path => archived(`sources/c5e9760/${path}.txt`);
export const arrayEvidencePaths = Object.freeze([
	...Object.keys(arrayEvidenceFiles).map(archived)
	, ...Object.keys(arrayEvidenceSources).map(arrayEvidenceSnapshot)
]);

/**
 * Rebuild one composed consumer from the archived sources: the accepted consumer, then the specialization fragment,
 * then the Array fragment, each inserted once before the language's own loop marker.
 *
 * @param profile - C, C++ or Python.
 * @param text - Archived source text by repository path.
 */
export const composeArrayEvidenceConsumer = (profile, text) => {
	const { extension, marker } = expected[profile];
	let consumer = text(`tests/fixtures/generic-record-consumers/${profile}.${extension}`);
	for(const directory of ["generic-record-specialization-consumers", "generic-record-array-consumers"])
	{
		const fragment = text(`tests/fixtures/${directory}/${profile}.${extension}`);
		assert.equal(consumer.split(marker).length, 2, `${profile}: one insertion site`);
		assert.ok(!fragment.includes(marker), `${profile}: ${directory} adds no insertion site`);
		consumer = consumer.replace(marker, `${fragment}\n${marker}`);
	}
	return consumer;
};

/**
 * Check one selection's records: start and end, the exact unskipped TAP, and its report.
 *
 * @param selection - Declared selection.
 * @param records - Parsed archive members.
 * @param records.queue - Run queue.
 * @param records.start - Process identity when the selection began.
 * @param records.end - Exit, disk floor and TAP digest when it finished.
 * @param records.tap - The unskipped test transcript.
 * @param records.report - Installed observations for each profile.
 * @param consumers - Composed consumer text by profile.
 */
export const assertArraySelection = (selection, { queue, start, end, tap, report }, consumers) => {
	const declared = queue.selections.find(item => item.name === selection.name);
	assert.ok(declared, selection.name);
	assert.deepEqual({ name: declared.name, profiles: declared.profiles, report: declared.report, ...declared.python ? { python: declared.python, version: declared.version } : {} }, selection);
	assert.deepEqual([declared.environment.LEAN_BRIDGE_GENERIC_RECORD_ARRAY_PROFILES, declared.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, declared.environment.LEAN_NUM_THREADS], [selection.profiles.join(","), "2.36", "1"]);
	assert.equal(declared.environment.LEAN_BRIDGE_PYTHON, selection.python, `${selection.name} interpreter`);
	assert.ok(declared.environment.LEAN_BRIDGE_GENERIC_RECORD_ARRAY_REPORT.endsWith(`/${selection.report}`));
	assert.deepEqual(Object.keys(start).sort(), ["pgid", "pid", "startedAt"]);
	assert.equal(start.pid, start.pgid);
	assert.deepEqual([end.code, end.signal, end.stoppedForDisk], [0, null, false], selection.name);
	assert.ok(end.minimumFreeMiB >= queue.stopFloorMiB, `${selection.name} stayed above the floor`);
	assert.equal(end.tapSha256, sha256(tap), `${selection.name} end names this TAP`);
	const lines = tap.split("\n");
	for(const line of [`ok 1 - ${title}`, "# tests 1", "# pass 1", "# fail 0", "# skipped 0", "# cancelled 0", "# todo 0"]) assert.ok(lines.includes(line), `${selection.name}: ${line}`);
	assert.deepEqual([report.schemaVersion, report.profiles, report.reproducible, report.authorRoots], [1, selection.profiles, true, 2], selection.name);
	assert.ok(Object.keys(report.archives).length > 0);
	assert.deepEqual(report.reports.map(item => item.profile), selection.profiles);
	for(const item of report.reports)
	{
		const pinned = expected[item.profile];
		assert.deepEqual([item.path, item.offlineInstall, item.compilerFreePath, item.sourceRemovedBeforeInstallation], ["ordinary-source", true, true, true], item.profile);
		assert.deepEqual([item.checks, item.expectedChecks, item.baseConsumer.checks], [pinned.checks, pinned.checks, pinned.base], item.profile);
		// The consumer that ran is the one rebuilt from the archived sources, and the one the runner pinned.
		assert.equal(item.consumerSha256, sha256(consumers[item.profile]), `${item.profile} rebuilt consumer`);
		assert.equal(item.consumerSha256, pinned.consumerSha256, `${item.profile} pinned consumer`);
		assert.deepEqual([item.instantiations[`lean:${module}.ArrayBox`], item.instantiations[`lean:${module}.RowBox`]]
			, [{ structure: `${module}.Box`, arguments: [array(nat)] }, { structure: `${module}.Box`, arguments: [array(named(`lean:${module}.NatBox`))] }], item.profile);
		assert.deepEqual(item.arrayExports, ["pushCount", "rowTotal", "rowOf", "rowBoxSum"].map(name => `${module}.${name}`));
		assert.equal(item.specializations.length, 9);
		assert.ok(Array.isArray(item.cases) && item.cases.at(-1) === "1000 Array rounds");
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.match(item[field], /^[a-f0-9]{64}$/u, field);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256, artifact.path);
		if(item.profile === "python") assert.deepEqual(item.python, { command: selection.python, version: selection.version });
		else assert.equal(Object.hasOwn(item, "python"), false);
	}
	return report.reports.map(item => [item.profile, item.checks]);
};

/**
 * Local scope only, with the producer revision and every member's identity.
 *
 * @param artifacts - Exact original and source snapshot identities.
 */
export const arrayEvidenceReceipt = artifacts => ({ schemaVersion: 1
	, kind: "generic-record-array-native-acceptance"
	, revision: arrayEvidenceRevision
	, selections: arraySelections.map(selection => selection.name)
	, scope: {
		hosts: ["c", "cpp", "python"]
		, pythonFloors: ["3.11.16", "3.12.14"]
		, route: "ordinary-source"
		, cases: ["ArrayBox Array Nat field", "BoxRow Array NatBox input and result", "RowBox Array NatBox field", "negative members at the first, middle and last position", "1000 Array rounds"]
		, localGlibc: "2.36"
		, local: true
		, hostedCi: false
		, otherNativeHosts: false
		, supportPromotion: false
		, retained: "Queue, runner, runner output, per-selection start, end and TAP, reports and Git source snapshots; package archives are identified by digest only"
	}
	, artifacts
	, sources: Object.entries(arrayEvidenceSources).map(([path, digest]) => ({ path, sha256: digest, snapshot: arrayEvidenceSnapshot(path) })) });

/**
 * Validate every path and byte, then every record, rebuilding each consumer from the archived sources.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive-byte reader, injectable for corruption tests.
 * @param options - Whether to compare with the live consumer composition too.
 * @param options.currentSources - False only while staging.
 */
export const assertArrayEvidenceArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	assert.deepEqual(receipt.artifacts.map(file => file.path), arrayEvidencePaths, "exact archive paths, with no duplicates or foreign paths");
	assert.deepEqual(receipt, arrayEvidenceReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const name = Object.keys(arrayEvidenceFiles).find(item => archived(item) === file.path);
		const source = Object.keys(arrayEvidenceSources).find(path => arrayEvidenceSnapshot(path) === file.path);
		const pinned = name ? arrayEvidenceFiles[name] : { original: `git:${arrayEvidenceRevision}:${source}`, sha256: arrayEvidenceSources[source] };
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.deepEqual([file.originalPath, file.sha256], [pinned.original, pinned.sha256], file.path);
		if(pinned.bytes !== undefined) assert.equal(file.bytes, pinned.bytes, file.path);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const text = name => files.get(archived(name)).toString("utf8");
	const queue = JSON.parse(text("queue.json"));
	assert.deepEqual([queue.revision, queue.tree, queue.runnerSha256], [arrayEvidenceRevision, tree, runnerSha256]);
	assert.equal(sha256(files.get(archived("runner.mjs.txt"))), queue.runnerSha256, "the queue names this runner");
	assert.deepEqual(queue.sources, arrayEvidenceSources, "the runner authenticated exactly these sources");
	assert.deepEqual(Object.fromEntries(Object.entries(queue.expected).map(([profile, item]) => [profile, [item.checks, item.consumerSha256]])), Object.fromEntries(Object.entries(expected).map(([profile, item]) => [profile, [item.checks, item.consumerSha256]])));
	assert.deepEqual(queue.selections.map(item => item.name), arraySelections.map(item => item.name));
	assert.match(queue.scope, /^Local ordinary-source installed C, C\+\+ and Python Array fields/u);
	const consumers = Object.fromEntries(Object.keys(expected).map(profile => [profile, composeArrayEvidenceConsumer(profile, path => files.get(arrayEvidenceSnapshot(path)).toString("utf8"))]));
	const checks = [];
	for(const selection of arraySelections)
	{
		const json = name => JSON.parse(text(`${selection.name}/${name}`));
		checks.push(...assertArraySelection(selection, { queue, start: json("start.json"), end: json("end.json"), tap: text(`${selection.name}/run.tap`), report: JSON.parse(text(selection.report)) }, consumers));
	}
	assert.deepEqual(checks, [["c", 2078], ["cpp", 2058], ["python", 2144], ["python", 2144]]);
	if(currentSources) for(const profile of Object.keys(expected)) assert.equal(await genericRecordArrayConsumer(profile), consumers[profile], `live ${profile} consumer`);
	return { receipt, checks };
};

/**
 * Save an artifact once; identical repeats are allowed, but changed bytes never overwrite it.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated content to preserve.
 */
export const writeArrayEvidenceArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};
