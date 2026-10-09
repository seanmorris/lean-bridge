/**
 * Authenticate the local installed C++ scalar Fin entry-counter acceptance (b9dde63) and the earlier failed
 * attempt it corrects (797d494), without claiming hosted acceptance or a C++ raw-adapter caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const cppDispatchDirectory = "docs/evidence/cpp-fin-dispatch-20261009";
export const cppDispatchRevisions = Object.freeze({ succeeded: "b9dde6393f8f813157ae582735fc404f04e4de92", failed: "797d4945a99edea8b3945b5efc2d0a95f5a0b7f4" });
const archived = name => `${cppDispatchDirectory}/${name}`;
const run = { succeeded: "build/vo1438-cpp-fin-dispatch-b9dde63", failed: "build/vo1438-cpp-fin-dispatch-797d494" };
export const cppDispatchOriginals = Object.freeze({
	"succeeded/queue.json": { original: `${run.succeeded}/queue.json`, sha256: "8a9a4374437be1e719e9a6c9bcf136661f47ee0dda06d13f8de280afdaa39c59" }
	, "succeeded/end.json": { original: `${run.succeeded}/end.json`, sha256: "25e96878a829efce85a906819d52a18040c307a346b9a69c14fa2efa542a719c" }
	, "succeeded/run.tap": { original: `${run.succeeded}/run.tap`, sha256: "60b994737373aa6d02e248a4d146fa3a81f1d9f8f35869d0901b5913f03a6b16" }
	, "succeeded/native.json": { original: `${run.succeeded}/native.json`, sha256: "940637af0c48770cab06cd82fc3b407f50f4507afcc2da0d3950836cff2da2ee" }
	, "succeeded/native-reviewed.json": { original: `${run.succeeded}/native-reviewed.json`, sha256: "3a21a08864c719e2f33efd7d1a368ff439fab6074d5658ec99d5f18df4a3c6b0" }
	, "succeeded/runner.mjs.txt": { original: "build/run-vo1438-cpp-fin-dispatch-b9dde63.mjs", sha256: "06a26e4a20dab8ae8a3cb87526ae7a1eac5126e3fd5c85292555018ed0a93b90" }
	, "failed/queue.json": { original: `${run.failed}/queue.json`, sha256: "ff51d22df98b4024cef879c063b723baca4e8a3da27cd562422edad2394aa987" }
	, "failed/end.json": { original: `${run.failed}/end.json`, sha256: "4a095cfb0be9cbcdc98046d5b8152031eed2fcf25b6683af85d4858161b812b3" }
	, "failed/run.tap": { original: `${run.failed}/run.tap`, sha256: "1daf810033f40b447c72cbef8c22060f6953a8de3e9a951d37ed20a5412712f3" }
	, "failed/native.json": { original: `${run.failed}/native.json`, sha256: "f398b0f6d178f70a72ff168c999057584dfb1404abb8c9808258410d0a573607" }
	, "failed/runner.mjs.txt": { original: "build/run-vo1438-cpp-fin-dispatch-797d494.mjs", sha256: "ca456b1e5bf3503fb804a66bc565ebd7f7c94ba22443aa5968d1c8b9acbba616" }
	, "audit/audit.mjs.txt": { original: "build/audit-vo1438-cpp-fin-dispatch-b9dde63.mjs", sha256: "4f41459cbcbb9b2c2cdbe92b733f6e1703678d58a1a7bfed35c55fa9cab38982" }
	, "audit/audit.json": { original: "build/vo1438-cpp-fin-dispatch-b9dde63-audit.log", sha256: "e11be75723123430921c565cfa8362f5c6f758277dcf5a968efd89c091f0ccea" }
	, "audit/failed-audit.mjs.txt": { original: "build/audit-vo1438-cpp-fin-dispatch-797d494.mjs", sha256: "59df1c5f7de98b811c3b503f2979012f5d0e15b431ae30371ccc40a07c5e3d92" }
});
export const cppDispatchSources = Object.freeze({
	succeeded: Object.freeze({
		"tests/native-fin.test.mjs": "6641496c3a13b6bb0512c6c5757ebc8bb04be0f9545f67861812c25d4bf78b31"
		, "tests/helpers/cpp-fin-dispatch.mjs": "f19610c6f710366a0ca458eed771810fe7c3f2168c2ced2aff57003e7a1950d3"
		, "tests/helpers/cpp-fin-dispatch-tests.mjs": "3b69bdbcc7f46c22f0525342764537601b46c3c0ae6a4a1eaf8a459acfca8d00"
		, "tests/helpers/native-fin-dispatch.mjs": "e1b7105b020665d1ff624baa09f0ab62101b3a3eaba5d9f79cc56895105fb0bc"
		, "tests/helpers/native-fin-consumers.mjs": "a0437bc542bfed6a765692cceff76f68b39d5f7e537263d1d1ab8a0d2de556fd"
		, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
		, "tests/helpers/reviewed-fin-fixture.mjs": "92f3a2cbc3230bf54b591af49cfa4f1b07defd70073f648a0fd622b5c4aaebc1"
		, "tests/fixtures/onboarding/native-fin/NativeFin.lean": "7399d8119ceced0dca35994130e85636025cb2340d7265dff9dd9062e4e17c3b"
		, "src/build/native-project.mjs": "b941e848c291a05a4fab3e93f2d9f5d3a5c9380f9a290c5668378c05ae5b5cf7"
		, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
		, "src/build/canonical-build.mjs": "17e88b02d75c81379c0a8f6e6b14ab583fabfaa8b7fdb747174505256ca48e7c"
		, "src/backends/c/native-copied-values.mjs": "ba14b12ba6d0f7df8ff091f472d70fd74c003e78e1ac6e58dc8170eee2163640"
		, "src/backends/cpp/primitives.mjs": "6aaf142530630bc7a21bdea06b5072d18b190381becadd80933b191d84d61ec9"
		, "src/release/native-c-family.mjs": "5cf7bd9e3f4ff817bb75de384cbf5b6db8865ecc7cddebbe2653a09039a7611a"
		, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
		, "src/backends/c/generate.mjs": "2b7283f0fdd4b0f911c51b984c81a7f769af09b9044dca7988bfbdd9e59e7518"
		, "src/backends/c/primitive-surface.mjs": "893d7f649bf489c766e5d38f04ce4e1b7cb7967acc8f63bf6f82b9b6f5cd64df"
		, "tests/helpers/type-corpus-reviewed-ir.mjs": "621813a636c435e89184359b349227f98710bb7c0c6a15a921cbfc40e78274f7"
	})
	, failed: Object.freeze({
		"tests/native-fin.test.mjs": "6641496c3a13b6bb0512c6c5757ebc8bb04be0f9545f67861812c25d4bf78b31"
		, "tests/helpers/cpp-fin-dispatch.mjs": "dc21591bded978da2da025d7428ff3c601a9692ea0b412a7b4f559bd98e1284b"
		, "tests/helpers/cpp-fin-dispatch-tests.mjs": "be12bc6d23c917b44c57f26d510c845cc02a3001851016c6701f600c48d48f1d"
		, "tests/helpers/native-fin-dispatch.mjs": "e1b7105b020665d1ff624baa09f0ab62101b3a3eaba5d9f79cc56895105fb0bc"
		, "tests/helpers/native-fin-consumers.mjs": "a0437bc542bfed6a765692cceff76f68b39d5f7e537263d1d1ab8a0d2de556fd"
		, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
		, "tests/helpers/reviewed-fin-fixture.mjs": "92f3a2cbc3230bf54b591af49cfa4f1b07defd70073f648a0fd622b5c4aaebc1"
		, "tests/fixtures/onboarding/native-fin/NativeFin.lean": "7399d8119ceced0dca35994130e85636025cb2340d7265dff9dd9062e4e17c3b"
		, "src/build/native-project.mjs": "b941e848c291a05a4fab3e93f2d9f5d3a5c9380f9a290c5668378c05ae5b5cf7"
		, "src/build/native-model.mjs": "aa8cd31583063c8a1d3fdc1aeba71d7cc46aaf21dbe4ff270318d5b646106a13"
		, "src/build/canonical-build.mjs": "17e88b02d75c81379c0a8f6e6b14ab583fabfaa8b7fdb747174505256ca48e7c"
		, "src/backends/c/native-copied-values.mjs": "ba14b12ba6d0f7df8ff091f472d70fd74c003e78e1ac6e58dc8170eee2163640"
		, "src/backends/cpp/primitives.mjs": "6aaf142530630bc7a21bdea06b5072d18b190381becadd80933b191d84d61ec9"
		, "src/release/native-c-family.mjs": "5cf7bd9e3f4ff817bb75de384cbf5b6db8865ecc7cddebbe2653a09039a7611a"
		, "src/build/native-artifacts.mjs": "5fd01aa0ad402df7512b90a63a22b1cacb97ff0a06f2a44e1bd9a5089f7ffbc4"
	})
});
/**
 * Archive path of one exact producer source.
 *
 * @param attempt - "succeeded" or "failed".
 * @param path - Repository-relative source identity.
 */
export const cppDispatchSnapshot = (attempt, path) => archived(`sources/${cppDispatchRevisions[attempt].slice(0, 7)}/${path}.txt`);
export const cppDispatchPaths = Object.freeze([
	...Object.keys(cppDispatchOriginals).map(archived)
	, ...Object.entries(cppDispatchSources).flatMap(([attempt, sources]) => Object.keys(sources).map(path => cppDispatchSnapshot(attempt, path)))
]);

const lean = "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)";
const command = [
	"/usr/bin/taskset", "-c", "3"
	, "/usr/bin/node", "--test"
	, "--test-concurrency=1"
	, "--test-reporter=tap"
	, "--test-name-pattern=^(relocated source-free C and C\\+\\+ packages|independently reviewed C and C\\+\\+ Fin packages)"
	, "tests/native-fin.test.mjs"
];
const environment = {
	NO_COLOR: "1"
	, LEAN_BRIDGE_NATIVE_FIN_INSTALLED_TEST: "1"
	, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
	, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
	, LEAN_NUM_THREADS: "1"
	, OMP_NUM_THREADS: "1"
	, MAKEFLAGS: "-j1"
};
const runScope = "Local ordinary/reviewed installed C++ public source/adapter counters; separate existing C raw-adapter checks; glibc 2.36, not hosted release-floor acceptance";
const succeededAttempt = {
	tree: "ed458ba7f1edffd701c8990c54fa183b89038b02"
	, cwd: "/app/build/worktrees/cpp-fin-labels-vo1438"
	, startedAt: "2026-10-09T05:47:58.262Z"
	, freeMiB: 3402
	, end: { code: 0, minimumFreeMiB: 2604, endedAt: "2026-10-09T06:02:49.186Z" }
};
const failedAttempt = {
	tree: "2912f20b68fe61d8ecb0484892a00c087e1a6a0e"
	, cwd: "/app/build/worktrees/cpp-fin-dispatch-vo1438"
	, startedAt: "2026-10-09T05:25:31.753Z"
	, freeMiB: 4005
	, end: { code: 1, minimumFreeMiB: 2907, endedAt: "2026-10-09T05:36:56.943Z" }
};
const attempts = { succeeded: succeededAttempt, failed: failedAttempt };
const ordinaryTest = "relocated source-free C and C++ packages check Fin bounds through public and raw adapters";
const reviewedTest = "independently reviewed C and C++ Fin packages preserve bounds through installed public and raw adapters";
const names = ["mirror", "impossible", "label"];
const columns = [...names.map(name => `l_NativeFin_${name}`), ...names.map(name => `lb_${sha256(`native-fin@1.0.0\0NativeFin.${name}`).slice(0, 24)}`)];
// Public C++ rows; the reviewed contract publishes value labels where the ordinary one publishes arg labels.
const cppRows = [
	["start", "ok", [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-bound", "invalid:1:1:arg0:10", [0, 0, 0, 0, 0, 0]]
	, ["invalid-mirror-huge", "invalid:1:1:arg0:10", [0, 0, 0, 0, 0, 0]]
	, ["invalid-impossible-zero", "invalid:1:1:arg0:0", [0, 0, 0, 0, 0, 0]]
	, ["invalid-label-late", "invalid:1:1:arg1:4", [0, 0, 0, 0, 0, 0]]
	, ["valid-mirror", "ok:6", [1, 0, 0, 1, 0, 0]]
	, ["valid-label", "ok:slot:8", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-mirror", "invalid:1:1:arg0:10", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-impossible", "invalid:1:1:arg0:0", [1, 0, 1, 1, 0, 1]]
	, ["recovery-invalid-label", "invalid:1:1:arg1:4", [1, 0, 1, 1, 0, 1]]
	, ["recovery-valid-mirror", "ok:0", [2, 0, 1, 2, 0, 1]]
	, ["recovery-valid-label", "ok:slot:5", [2, 0, 2, 2, 0, 2]]
];
// The separate C caller's public and raw-adapter rows, recorded beside the C++ ones but never as C++ calls.
const cRows = [
	["start", 0, [0, 0, 0, 0, 0, 0]]
	, ["public-valid-mirror", 0, [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-mirror", 1, [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-impossible", 1, [1, 0, 0, 1, 0, 0]]
	, ["public-invalid-label", 1, [1, 0, 0, 1, 0, 0]]
	, ["public-valid-label", 0, [1, 0, 1, 1, 0, 1]]
	, ["raw-invalid-mirror", 1, [1, 0, 1, 2, 0, 1]]
	, ["raw-invalid-impossible", 1, [1, 0, 1, 2, 1, 1]]
	, ["raw-valid-mirror", 1, [2, 0, 1, 3, 1, 1]]
	, ["raw-invalid-mirror-large", 1, [2, 0, 1, 4, 1, 1]]
];
const probe = { "ordinary-source": "c56e759d1e92de3c7b4bf0089918cd9bc9dd384c12136423203cac194910bb8d", "reviewed-ir": "b6527f5e9593b38cfa86500330e9df73f3eff1a49bd04e86ec8457a546c5bf9c" };
const interposer = "a6584dcb1a98f5d517680e475ad039e255d1ff15a1bfdb4e0ab49414651da710";
const itemKeys = ["bindingIrSha256", "checks", "command", "compilerFreePath", "consumerSha256", "dispatch", "executableSha256", "installedFilesSha256", "installedFilesUnchanged", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "relocatedInstallation", "repeatExecution", "sourceRemovedBeforeInstallation", "sourceTreeSha256"];
const cppDispatchKeys = ["columns", "definers", "executableSha256", "installedFilesUnchanged", "instrument", "interposerSha256", "kind", "libraries", "missingInstrumentRejected", "observed", "packageReceiptSha256", "positiveControl", "probeSha256", "repeatedColdProcess", "routes", "scope"];
const hash = value => assert.match(value, /^[a-f0-9]{64}$/u);

const assertQueue = (queue, attempt, runner) => {
	const expected = attempts[attempt];
	assert.deepEqual(Object.keys(queue).sort(), ["command", "cwd", "environment", "freeMiB", "glibc", "lean", "node", "revision", "runnerSha256", "scope", "sources", "startedAt", "stopFloorMiB", "tree", "unset"]);
	assert.deepEqual([queue.revision, queue.tree, queue.cwd, queue.startedAt, queue.freeMiB], [cppDispatchRevisions[attempt], expected.tree, expected.cwd, expected.startedAt, expected.freeMiB]);
	assert.equal(queue.runnerSha256, runner);
	assert.deepEqual(queue.command, command); assert.deepEqual(queue.environment, environment);
	assert.deepEqual(queue.unset, ["FORCE_COLOR", "other LEAN_BRIDGE_* variables"]);
	assert.deepEqual([queue.node, queue.lean, queue.glibc, queue.stopFloorMiB, queue.scope], ["v22.23.2", lean, "glibc 2.36", 1024, runScope]);
	assert.deepEqual(queue.sources, cppDispatchSources[attempt]);
};
const assertEnd = (end, attempt, tap) => assert.deepEqual(end, { ...attempts[attempt].end, signal: null, stoppedForDisk: false, endedAt: attempts[attempt].end.endedAt, tapSha256: sha256(tap) });
const assertSummary = (tap, counts) => {
	for(const [label, count] of Object.entries(counts)) assert.match(tap, new RegExp(`^# ${label} ${count}$`, "mu"), label);
};

/**
 * One installed report of either route, with its C++ public rows and the separate C caller's rows.
 *
 * @param data - Parsed report.
 * @param route - Route: ordinary-source or reviewed-ir.
 * @param corrected - Whether the observer recorded published parameter labels (b9dde63 onwards).
 */
export const assertCppDispatchReport = (data, route, corrected) => {
	assert.deepEqual(Object.keys(data).sort(), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(data.schemaVersion, 1); assert.equal(data.reproducible, true);
	assert.deepEqual(data.reports.map(item => item.profile), ["c", "cpp"]);
	const [c, cpp] = data.reports;
	for(const item of data.reports)
	{
		assert.deepEqual(Object.keys(item).sort(), [...itemKeys, ...route === "reviewed-ir" ? ["reviewedSourceSha256"] : []].sort());
		assert.equal(item.path, route); assert.equal(item.checks, item.profile === "c" ? 2029 : 2020);
		assert.match(item.command, new RegExp(`^/tmp/lean-bridge-native-fin-consumer-[A-Za-z0-9]{6}/${item.profile}(?:-relocated)?/consumer$`, "u"));
		for(const flag of ["compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "installedFilesUnchanged"])
			assert.equal(item[flag], true, `${route} ${item.profile} ${flag}`);
		assert.equal(item.packages.length, 1);
		const [pkg] = item.packages;
		assert.deepEqual([pkg.name, pkg.version, pkg.target, pkg.runtimeDelivery, pkg.profile], ["native-fin", "1.0.0", item.profile, "embedded", "native-library-v1"]);
		for(const artifact of pkg.artifacts) assert.equal(data.archives[artifact.path], artifact.sha256);
		for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256", "consumerSha256", "executableSha256", "installedFilesSha256"]) hash(item[field]);
		if(route === "reviewed-ir") hash(item.reviewedSourceSha256);
	}
	for(const field of ["bindingIrSha256", "sourceTreeSha256", "modelSha256", "receiptSha256"]) assert.equal(c[field], cpp[field], field);
	assert.deepEqual(Object.keys(c.dispatch).sort(), ["columns", "interposer", "observed", "positiveControl", "runtimeTableChecks"]);
	assert.deepEqual(c.dispatch.columns, columns); assert.deepEqual(c.dispatch.observed, cRows);
	assert.equal(c.dispatch.interposer, "LD_PRELOAD"); assert.ok(Number.isSafeInteger(c.dispatch.runtimeTableChecks) && c.dispatch.runtimeTableChecks > 1000);
	const dispatch = cpp.dispatch, label = route === "ordinary-source" ? "arg" : "value";
	assert.deepEqual(Object.keys(dispatch).sort(), [...cppDispatchKeys, ...corrected ? ["parameterNames"] : []].sort());
	if(corrected) assert.deepEqual(dispatch.parameterNames, { mirror: [`${label}0`], impossible: [`${label}0`], label: [`${label}0`, `${label}1`, `${label}2`] });
	assert.deepEqual([dispatch.kind, dispatch.instrument], ["cpp-public-fin-entry-v1", "LD_PRELOAD"]);
	assert.deepEqual(dispatch.columns, columns);
	assert.deepEqual(dispatch.observed, cppRows.map(([step, status, counts]) => [step, status.replaceAll("arg", label), counts]));
	for(const flag of ["missingInstrumentRejected", "repeatedColdProcess", "installedFilesUnchanged"]) assert.equal(dispatch[flag], true, flag);
	assert.equal(dispatch.scope, "public C++ scalar Fin calls in two cold C++ processes; no raw-adapter caller in this observation");
	assert.equal(dispatch.routes, "native_fin.hpp -> public C ABI -> checked runtime -> typed adapter -> Lean source");
	assert.equal(dispatch.positiveControl, "valid public C++ calls increment source and adapter; invalid calls increment neither");
	assert.deepEqual([dispatch.probeSha256, dispatch.interposerSha256], [probe[route], interposer]);
	hash(dispatch.executableSha256); hash(dispatch.packageReceiptSha256);
	assert.equal(dispatch.definers.length, 6);
	for(const library of dispatch.definers) assert.ok(Object.hasOwn(dispatch.libraries, library), library);
	for(const [path, identity] of Object.entries(dispatch.libraries))
	{
		assert.match(path, /^lib\/[A-Za-z0-9_.-]+\.so(?:\.[0-9]+)*$/u);
		assert.deepEqual(Object.keys(identity).sort(), ["bytes", "sha256"]); hash(identity.sha256); assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes > 0);
	}
};

/**
 * Both attempts' records, independently of artifact hashes.
 *
 * @param records - Parsed originals of both attempts.
 */
export const assertCppDispatchRecords = records => {
	const { succeeded, failed } = records;
	assertQueue(succeeded.queue, "succeeded", cppDispatchOriginals["succeeded/runner.mjs.txt"].sha256);
	assertEnd(succeeded.end, "succeeded", succeeded.tap);
	assertSummary(succeeded.tap, { tests: 2, pass: 2, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
	assert.doesNotMatch(succeeded.tap, /^\s*not ok /mu);
	const lines = succeeded.tap.split("\n");
	for(const line of [`ok 1 - ${ordinaryTest}`, `ok 2 - ${reviewedTest}`]) assert.ok(lines.includes(line), line);
	for(const label of ["build 0: compiling C/GMP and C++ packages", "installing c", "installing cpp", "build 1: compiling C/GMP and C++ packages"])
		assert.equal(lines.filter(line => line === `# ${label}`).length, 2, label);
	assertCppDispatchReport(succeeded.ordinary, "ordinary-source", true);
	assertCppDispatchReport(succeeded.reviewed, "reviewed-ir", true);
	// The earlier attempt passed the ordinary route and failed only the reviewed probe's assumed labels.
	assertQueue(failed.queue, "failed", cppDispatchOriginals["failed/runner.mjs.txt"].sha256);
	assertEnd(failed.end, "failed", failed.tap);
	assertSummary(failed.tap, { tests: 2, pass: 1, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
	assert.ok(failed.tap.split("\n").includes(`ok 1 - ${ordinaryTest}`));
	assert.ok(failed.tap.split("\n").includes(`not ok 2 - ${reviewedTest}`));
	assert.match(failed.tap, /invalid-mirror-bound: unexpected rejection: value0 is not below its Fin 10 bound/u);
	assertCppDispatchReport(failed.ordinary, "ordinary-source", false);
	// The correction changed only the observer: ordinary packages, C rows and C++ rows are those of the first run.
	assert.deepEqual(succeeded.ordinary.archives, failed.ordinary.archives);
	const [firstC, firstCpp] = failed.ordinary.reports, [laterC, laterCpp] = succeeded.ordinary.reports;
	// Only run-owned paths and rebuilt executables differ, plus the labels the corrected observer records.
	assert.deepEqual({ ...laterC, command: null }, { ...firstC, command: null });
	assert.deepEqual({ ...laterCpp, command: null, executableSha256: null, dispatch: null }, { ...firstCpp, command: null, executableSha256: null, dispatch: null });
	const { parameterNames, ...corrected } = laterCpp.dispatch;
	assert.ok(parameterNames);
	assert.deepEqual({ ...corrected, executableSha256: null }, { ...firstCpp.dispatch, executableSha256: null });
};

/**
 * Local scope only: no hosted acceptance, no C++ raw-adapter caller and the failed attempt kept as such.
 *
 * @param artifacts - Exact original and source snapshot identities.
 */
export const cppDispatchReceipt = artifacts => ({ schemaVersion: 1
	, kind: "cpp-public-fin-entry-acceptance"
	, revisions: cppDispatchRevisions
	, scope: { profiles: ["c", "cpp"], routes: ["ordinary-source", "reviewed-ir"]
		, cppPublicRows: 12, separateCRows: 10, cppRawAdapterCaller: false
		, localGlibc: "2.36", hostedCi: false
		, failedAttempts: [{ revision: cppDispatchRevisions.failed, reason: "the reviewed C++ probe assumed arg labels where the reviewed contract publishes value0" }]
		, sourceIdentity: "Selected producer sources, not a complete dependency closure" }
	, artifacts
	, sources: Object.entries(cppDispatchSources).flatMap(([attempt, sources]) => Object.entries(sources).map(([path, digest]) => ({ attempt, path, sha256: digest, snapshot: cppDispatchSnapshot(attempt, path) }))) });

/**
 * Validate every path and byte before interpreting any record or checking current sources.
 *
 * @param receipt - Parsed archive receipt.
 * @param read - Archive-byte reader, injectable for corruption tests.
 * @param options - Whether to authenticate live producer sources too.
 * @param options.currentSources - False only while staging the archived Git snapshots.
 */
export const assertCppDispatchArchive = async (receipt, read = readFile, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	assert.deepEqual(receipt.artifacts.map(file => file.path), cppDispatchPaths, "exact archive paths, with no duplicates or foreign paths");
	assert.deepEqual(receipt, cppDispatchReceipt(receipt.artifacts));
	const files = new Map();
	for(const file of receipt.artifacts)
	{
		const original = Object.entries(cppDispatchOriginals).find(([name]) => archived(name) === file.path)?.[1];
		const source = Object.entries(cppDispatchSources).flatMap(([attempt, sources]) => Object.entries(sources).map(([path, digest]) => [attempt, path, digest]))
			.find(([attempt, path]) => cppDispatchSnapshot(attempt, path) === file.path);
		assert.deepEqual(Object.keys(file).sort(), ["bytes", "originalPath", "path", "sha256"]);
		assert.equal(file.originalPath, original?.original ?? `git:${cppDispatchRevisions[source[0]]}:${source[1]}`);
		assert.equal(file.sha256, original?.sha256 ?? source[2]);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		const bytes = await read(file.path); assert.ok(Buffer.isBuffer(bytes));
		assert.equal(bytes.length, file.bytes); assert.equal(sha256(bytes), file.sha256, file.path);
		files.set(file.path, bytes);
	}
	const json = name => JSON.parse(files.get(archived(name))), text = name => files.get(archived(name)).toString();
	assertCppDispatchRecords({
		succeeded: { queue: json("succeeded/queue.json"), end: json("succeeded/end.json"), tap: text("succeeded/run.tap"), ordinary: json("succeeded/native.json"), reviewed: json("succeeded/native-reviewed.json") }
		, failed: { queue: json("failed/queue.json"), end: json("failed/end.json"), tap: text("failed/run.tap"), ordinary: json("failed/native.json") } });
	if(currentSources) for(const [path, digest] of Object.entries(cppDispatchSources.succeeded))
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path, "utf8"), digest)), digest, path);
	return receipt;
};

/**
 * Save an artifact once; identical repeats are allowed, but changed bytes never overwrite it.
 *
 * @param path - Explicit archive destination.
 * @param bytes - Authenticated content to preserve.
 */
export const writeCppDispatchArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `Refusing to replace an existing artifact: ${path}`);
	}
};
