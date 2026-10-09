/**
 * Authenticate the local installed C, C++ and Python Fin container edge run (VO #1454): one dc6b8b8 producer run
 * with three serial selections, every original record, and the producer's Git sources, from which each composed
 * consumer and the Lean fixture are rebuilt. Nothing here is hosted, other-host or expanded dispatch acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, finContainerEdgeSource } from "./fin-container-edges.mjs";

export const edgeEvidenceDirectory = "docs/evidence/fin-container-edges-20261009";
const archived = name => `${edgeEvidenceDirectory}/${name}`;
export const edgeEvidenceRevision = "dc6b8b8d615c6cf1073d697057cd012c6a1c4b3b";
const tree = "e5d84091a1c5ec3d205e0600a0af5b7fd4289be4";
const runnerSha256 = "2eb8d3a9b0d58131c799a4d73f9db0169d32cbb30ce22ec68442b86404c48c40";
const title = "installed source-free native packages execute zero-bound and nested-position Fin edge cases";
/** The three serial selections exactly as the runner declared them. */
export const edgeSelections = Object.freeze([
	{ name: "c-cpp", profiles: ["c", "cpp"], report: "edges-c-cpp.json" }
	, { name: "python311", profiles: ["python"], report: "edges-python311.json", python: "/app/.toolchains/python311/bin/python3", version: "3.11.16" }
	, { name: "python312", profiles: ["python"], report: "edges-python312.json", python: "/app/.toolchains/python312/bin/python3", version: "3.12.14" }
]);
// Exact totals and composed consumers, as the runner pinned them independently of the reports.
const expected = Object.freeze({
	c: { checks: 14114, consumerSha256: "b9df0c88e8085e2ea605b4295811c966991e3efb6186f02a168f8224a751eb4d", extension: "c", marker: '  printf("fin-container-ok:%u\\n", checks);' }
	, cpp: { checks: 14099, consumerSha256: "2243247b9aa590e001ee9b9290e6e00ca1914f2031a9bf2f9ce947b6bd53dead", extension: "cpp", marker: '  std::printf("fin-container-ok:%u\\n", checks);' }
	, python: { checks: 14095, consumerSha256: "9e32423234dc8e8ab93451cba3858de7a55b9da23df980e8d076dea0f2ad1ba7", extension: "py", marker: "print('fin-container-ok:' + str(checks))" }
});
const fin = bound => ({ kind: "fin", bound });
const inside = (kind, child) => ({ kind, arguments: [child] });
/** The four additive exports and their exact refinement trees on both sides. */
const additions = Object.freeze({
	"FinContainers.emptyArray": inside("array", fin("0"))
	, "FinContainers.emptyList": inside("list", fin("0"))
	, "FinContainers.emptyOption": inside("option", fin("0"))
	, "FinContainers.optionalDigits": inside("option", inside("list", fin("10")))
});
/** Original records of the run, generated from the producer's output directory. */
export const edgeEvidenceFiles = Object.freeze({
	"queue.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/queue.json", sha256: "ccf0a0f59b46d913b9f6fbc5dac28bccb2a3e093bc59f3429d654b04d20e7b22", bytes: 6986 }
	, "runner.mjs.txt": { original: "build/run-vo1454-fin-container-edges-dc6b8b8.mjs", sha256: "2eb8d3a9b0d58131c799a4d73f9db0169d32cbb30ce22ec68442b86404c48c40", bytes: 9086 }
	, "runner-output.txt": { original: "build/vo1454-fin-container-edges-dc6b8b8.runner.log", sha256: "df08c9f37f6d8f908c72364aba5e87318bdfa6e91c90ef50655c8621e34182b0", bytes: 1512 }
	, "c-cpp/start.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/c-cpp/start.json", sha256: "757670c2bcbbe1021ea56ab50c9da84752a9a9d4b5e640acaae4f1598cc98641", bytes: 83 }
	, "c-cpp/end.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/c-cpp/end.json", sha256: "f4832498884ca41210c7f56d9705a7f7accef758abafacbd6cc68f0541f8b848", bytes: 211 }
	, "c-cpp/run.tap": { original: "build/vo1454-fin-container-edges-dc6b8b8/c-cpp/run.tap", sha256: "dfa92aaf20e963a619b6c673f6f83d7345702cd3436bcffae510afab740f3f9a", bytes: 430 }
	, "python311/start.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/python311/start.json", sha256: "7febaa67d5f651b1ab78132f22bacbe5a7926b1097f0ac9a39bd8f746325814b", bytes: 83 }
	, "python311/end.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/python311/end.json", sha256: "b71f39be365d031596f833d812e51fb58af41a5f27fe1032591947060f665501", bytes: 211 }
	, "python311/run.tap": { original: "build/vo1454-fin-container-edges-dc6b8b8/python311/run.tap", sha256: "24ad88522ef09d709f1f3c93a8a4f3899f216eab6fcee216f542b4245c24da0e", bytes: 430 }
	, "python312/start.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/python312/start.json", sha256: "8086caf1e9e20822a8aa0de7dba9c312f680a32d300e539c6bfe44787eb68b96", bytes: 83 }
	, "python312/end.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/python312/end.json", sha256: "51992e001eb4575f854c3e7cdb216489cc172334a8703da78c712d31bbd00103", bytes: 211 }
	, "python312/run.tap": { original: "build/vo1454-fin-container-edges-dc6b8b8/python312/run.tap", sha256: "84e38f22028b8cd9f89c6a0c1ea768a4ac7f56abd83140aabb35f14984597706", bytes: 430 }
	, "edges-c-cpp.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/edges-c-cpp.json", sha256: "a3109be8b136e7511b08e8d5e2879827310542dc052944c7fee5627a40302430", bytes: 15944 }
	, "edges-python311.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/edges-python311.json", sha256: "38551f22f4278fcaf8c31f900a2a9da6ec7b7c517d7770cd70cf10cd5e34b52f", bytes: 7966 }
	, "edges-python312.json": { original: "build/vo1454-fin-container-edges-dc6b8b8/edges-python312.json", sha256: "bdeb74f53d9f88442fd530cb82c5f8bec8c1ea76b88b7ab76227b670dd9a558e", bytes: 7966 }
});
/** Every source the runner authenticated at dc6b8b8. */
export const edgeEvidenceSources = Object.freeze({
	"tests/fin-container-edges.test.mjs": "c22cdd1d20e90498bf5ee0b6829878b090eb5ff208e168e1e6cca2b5cb2749af"
	, "tests/helpers/fin-container-edges.mjs": "3f2af08f59520ece2180ebd85ee57d5b7af53e18dbf89c50a94b37e2a30aef08"
	, "tests/helpers/fin-container-edge-install.mjs": "f6d1bf014ac2a711c6da9c06bd9e91c57ac180ffd5dce1a23b0aef05f8c6bb75"
	, "tests/fixtures/fin-container-edges.lean": "6c2b2250f52557b39b0267762b029af38ba695dccd63065c01a069a6b37cea45"
	, "tests/fixtures/onboarding/native-fin-containers/FinContainers.lean": "f10a680c805bac2f8357b488c41d6f805cd394a9286e28bdcc7c356cedb014be"
	, "tests/fixtures/fin-container-consumers/c.c": "5e75156d9b1ab58fc1d981f8b6ab2ab8eb72be9e2e1d023508faa4dfb5dcf2b4"
	, "tests/fixtures/fin-container-edge-consumers/c.c": "bfc0c35df92db0abe5e24003068b6dd1d1559f53a5ec4ccd9d7691a52c9fbdcd"
	, "tests/fixtures/fin-container-consumers/cpp.cpp": "0b1b4a5454c9d7eabc7b9eb81fb6e84a43f9b561a57ed2743e46d3db56542fec"
	, "tests/fixtures/fin-container-edge-consumers/cpp.cpp": "123d127829c3d2e38b9169ae3a0c3b5fce4f5bf67ddeee03c2629218b7fc2a7f"
	, "tests/fixtures/fin-container-consumers/python.py": "ee267c0ba444e24710624cd1e090cb4d5c8cd6bcad17201bbc7622cb2a780261"
	, "tests/fixtures/fin-container-edge-consumers/python.py": "689c606d91f8e2e49e9f231f660e65cd7cd995e5a87628a25447ca60f9955b75"
	, "tests/helpers/fin-container-install.mjs": "2024d6c6a44687293750c3ee5c25f092d689065e17beb8d535610963921c9329"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "tests/helpers/package-set.mjs": "8613cb6fa1e7cb6bce93444160cf3a4503973064f52b644984637e909e5da82c"
	, "tests/helpers/lake-workspace.mjs": "56d4cb8097c41158f01ef4ae6ea0542dc188afab50894a49586528e366d3f082"
	, "src/build/canonical-build.mjs": "17e88b02d75c81379c0a8f6e6b14ab583fabfaa8b7fdb747174505256ca48e7c"
	, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
	, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
	, "src/backends/c/gmp-projection.mjs": "1669f605cfc646ac96e0c2258de26bb10630f9621cfd582cbfe986663a3b6e82"
	, "src/backends/c/gmp-values.mjs": "aa7bc5a2819b2eeb37741ae22f3beafb0e3c5404277cdadcb9081441d46830b6"
	, "src/backends/cpp/primitives.mjs": "6aaf142530630bc7a21bdea06b5072d18b190381becadd80933b191d84d61ec9"
	, "src/backends/cpp/copied-values.mjs": "ca8300d00227c4789b34ffbad22b33c64769a31856bc86b64e9d5d56c6ea331c"
	, "src/backends/python/generate.mjs": "68b032ac2da7c45b55de1d5f68ff0d310c475ef6998503be8e761eea73eae39c"
	, "src/backends/python/copied-conversions.mjs": "658271a8cfad111215b7072f8df29189f71f56dc15e3f7104e82bd8b50f2f936"
	, "src/release/native-c-family.mjs": "5cf7bd9e3f4ff817bb75de384cbf5b6db8865ecc7cddebbe2653a09039a7611a"
	, "src/release/package-set-receipt.mjs": "d0b945554b03e9d0f93149b12ddf808c33243cbb0ff5495a7a8a68e683fc71ed"
});

/**
 * Archive path of one producer source as Git held it at dc6b8b8.
 *
 * @param path - Repository path.
 */
export const edgeEvidenceSnapshot = path => archived(`sources/dc6b8b8/${path}.txt`);
export const edgeEvidencePaths = Object.freeze([
	...Object.keys(edgeEvidenceFiles).map(archived)
	, ...Object.keys(edgeEvidenceSources).map(edgeEvidenceSnapshot)
]);

/**
 * Rebuild one composed consumer from the archived sources: the original consumer with the edge fragment inserted
 * once before its complete final output line.
 *
 * @param profile - C, C++ or Python.
 * @param text - Archived source text by repository path.
 */
export const composeEdgeEvidenceConsumer = (profile, text) => {
	const { extension, marker } = expected[profile];
	const original = text(`tests/fixtures/fin-container-consumers/${profile}.${extension}`);
	const fragment = text(`tests/fixtures/fin-container-edge-consumers/${profile}.${extension}`);
	const at = original.indexOf(marker);
	assert.ok(at >= 0 && original.indexOf(marker, at + marker.length) < 0, `${profile}: one insertion site`);
	assert.ok((at === 0 || original[at - 1] === "\n") && original[at + marker.length] === "\n", `${profile}: a complete line`);
	assert.ok(!fragment.includes(marker), `${profile}: the fragment adds no insertion site`);
	return original.slice(0, at) + fragment + "\n" + original.slice(at);
};

/**
 * Rebuild the composed Lean fixture: the original module with the edge declarations appended.
 *
 * @param text - Archived source text by repository path.
 */
export const composeEdgeEvidenceFixture = text => text("tests/fixtures/onboarding/native-fin-containers/FinContainers.lean") + "\n" + text("tests/fixtures/fin-container-edges.lean");

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
 * @param rebuilt - Composed consumers by profile and the composed Lean fixture.
 */
export const assertEdgeSelection = (selection, { queue, start, end, tap, report }, rebuilt) => {
	const declared = queue.selections.find(item => item.name === selection.name);
	assert.ok(declared, selection.name);
	assert.deepEqual({ name: declared.name, profiles: declared.profiles, report: declared.report, ...declared.python ? { python: declared.python, version: declared.version } : {} }, selection);
	assert.deepEqual([declared.environment.LEAN_BRIDGE_FIN_CONTAINER_EDGE_PROFILES, declared.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, declared.environment.LEAN_NUM_THREADS], [selection.profiles.join(","), "2.36", "1"]);
	assert.equal(declared.environment.LEAN_BRIDGE_PYTHON, selection.python, `${selection.name} interpreter`);
	assert.ok(declared.environment.LEAN_BRIDGE_FIN_CONTAINER_EDGE_REPORT.endsWith(`/${selection.report}`));
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
		assert.deepEqual([item.path, item.checks], ["ordinary-source", pinned.checks], item.profile);
		for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"]) assert.equal(item[flag], true, `${item.profile} ${flag}`);
		// The consumer and Lean fixture that ran are the ones rebuilt from the archived sources and pinned by the runner.
		assert.deepEqual([item.consumerSha256, item.consumerSha256], [sha256(rebuilt.consumers[item.profile]), pinned.consumerSha256], `${item.profile} consumer`);
		assert.equal(item.fixtureSha256, sha256(rebuilt.fixture), `${item.profile} fixture`);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "installedFilesSha256", "installedReceiptSha256"]) assert.match(item[field], /^[a-f0-9]{64}$/u, field);
		assert.equal(Object.keys(item.refinements).length, 12);
		for(const [name, tree] of Object.entries(additions)) assert.deepEqual(item.refinements[name], { parameters: [tree], result: tree }, `${item.profile} ${name}`);
		assert.equal(canonicalJson(item.refinements), canonicalJson(report.reports[0].refinements), "one refinement map per run");
		assert.deepEqual(item.dispatch.observed, false, "no dispatch claim");
		for(const pkg of item.packages) for(const artifact of pkg.artifacts) assert.equal(report.archives[artifact.path], artifact.sha256, artifact.path);
		if(item.profile === "python")
		{
			assert.equal(item.python, selection.version);
			assert.equal(Object.hasOwn(item, "runtimeSearchPath"), false);
		}
		else
		{
			assert.equal(item.runtimeSearchPath, `$ORIGIN/fincontainers-1.0.0-${item.profile}/lib`);
			assert.match(item.executableSha256, /^[a-f0-9]{64}$/u);
		}
	}
	return report.reports.map(item => [item.profile, item.checks]);
};

/**
 * Local scope only, with the producer revision and every member's identity.
 *
 * @param artifacts - Exact original and source snapshot identities.
 */
export const edgeEvidenceReceipt = artifacts => ({ schemaVersion: 1
	, kind: "fin-container-edge-native-acceptance"
	, revision: edgeEvidenceRevision
	, selections: edgeSelections.map(selection => selection.name)
	, scope: {
		hosts: ["c", "cpp", "python"]
		, pythonFloors: ["3.11.16", "3.12.14"]
		, route: "ordinary-source"
		, cases: ["empty Array, List and Option of Fin 0 round trips", "nonempty or present Fin 0 refused with the exact bound diagnostic", "None and some [] distinct", "every outer and inner invalid position", "structural and negative-Nat controls", "1000 rounds per shape"]
		, relocation: "Complete installed trees move before an identical repeat; C and C++ executables carry only an origin-relative runtime path"
		, localGlibc: "2.36"
		, local: true
		, hostedCi: false
		, otherNativeHosts: false
		, dispatchObserved: false
		, supportPromotion: false
		, retained: "Queue, runner, runner output, per-selection start, end and TAP, reports and Git source snapshots; package archives and executables are identified by digest only"
	}
	, artifacts
	, sources: Object.entries(edgeEvidenceSources).map(([path, digest]) => ({ path, sha256: digest, snapshot: edgeEvidenceSnapshot(path) })) });

/**
 * Validate every path and byte, then every record, rebuilding each consumer and the fixture from the archive.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive-byte reader, injectable for corruption tests.
 * @param options - Whether to compare with the live composition too.
 * @param options.currentSources - False only while staging.
 */
export const assertEdgeEvidenceArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	assert.deepEqual(receipt.artifacts.map(file => file.path), edgeEvidencePaths, "exact archive paths, with no duplicates or foreign paths");
	assert.deepEqual(receipt, edgeEvidenceReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const name = Object.keys(edgeEvidenceFiles).find(item => archived(item) === file.path);
		const source = Object.keys(edgeEvidenceSources).find(path => edgeEvidenceSnapshot(path) === file.path);
		const pinned = name ? edgeEvidenceFiles[name] : { original: `git:${edgeEvidenceRevision}:${source}`, sha256: edgeEvidenceSources[source] };
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.deepEqual([file.originalPath, file.sha256], [pinned.original, pinned.sha256], file.path);
		if(pinned.bytes !== undefined) assert.equal(file.bytes, pinned.bytes, file.path);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const text = name => files.get(archived(name)).toString("utf8");
	const queue = JSON.parse(text("queue.json"));
	assert.deepEqual([queue.revision, queue.tree, queue.runnerSha256], [edgeEvidenceRevision, tree, runnerSha256]);
	assert.equal(sha256(files.get(archived("runner.mjs.txt"))), queue.runnerSha256, "the queue names this runner");
	assert.deepEqual(queue.sources, edgeEvidenceSources, "the runner authenticated exactly these sources");
	assert.deepEqual(Object.fromEntries(Object.entries(queue.expected).map(([profile, item]) => [profile, [item.checks, item.consumerSha256]])), Object.fromEntries(Object.entries(expected).map(([profile, item]) => [profile, [item.checks, item.consumerSha256]])));
	assert.deepEqual(queue.selections.map(item => item.name), edgeSelections.map(item => item.name));
	assert.match(queue.scope, /^Local ordinary-source installed C\/C\+\+\/Python Fin zero-bound/u);
	assert.match(queue.scope, /Not hosted, release-floor, other-host or expanded dispatch acceptance\.$/u);
	const source = path => files.get(edgeEvidenceSnapshot(path)).toString("utf8");
	const rebuilt = { consumers: Object.fromEntries(Object.keys(expected).map(profile => [profile, composeEdgeEvidenceConsumer(profile, source)])), fixture: composeEdgeEvidenceFixture(source) };
	const checks = [];
	for(const selection of edgeSelections)
	{
		const json = name => JSON.parse(text(`${selection.name}/${name}`));
		checks.push(...assertEdgeSelection(selection, { queue, start: json("start.json"), end: json("end.json"), tap: text(`${selection.name}/run.tap`), report: JSON.parse(text(selection.report)) }, rebuilt));
	}
	assert.deepEqual(checks, [["c", 14114], ["cpp", 14099], ["python", 14095], ["python", 14095]]);
	if(currentSources)
	{
		for(const profile of Object.keys(expected)) assert.equal(await finContainerEdgeConsumer(profile), rebuilt.consumers[profile], `live ${profile} consumer`);
		assert.equal(await finContainerEdgeSource(), rebuilt.fixture, "live fixture");
		const report = JSON.parse(text(edgeSelections[0].report));
		assert.equal(canonicalJson(report.reports[0].refinements), canonicalJson(finContainerEdgeRefinements), "live refinement contract");
	}
	return { receipt, checks };
};

/**
 * Save an artifact once; identical repeats are allowed, but changed bytes never overwrite it.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated content to preserve.
 */
export const writeEdgeEvidenceArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};
