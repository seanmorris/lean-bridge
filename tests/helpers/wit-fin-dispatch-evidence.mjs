/**
 * Authenticate the installed WIT/WASI Fin dispatch-counter run (VO #1425): its original queue, TAP, end
 * record and both ordinary and reviewed reports, and the ten producer sources at dac615e. Paths are
 * checked before any read. Older observed:false evidence is separate and left untouched.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const witDispatchArchiveDirectory = "docs/evidence/wit-fin-dispatch-20261008";
export const witDispatchRevision = "dac615e032e47ee604782257522563277a3eb985";
const archived = name => `${witDispatchArchiveDirectory}/${name}`;
const run = "build/vo1425-wit-dispatch-dac615e";

/** Original producer outputs, relative to the producing checkout, with their posted digests. */
export const witDispatchOriginals = Object.freeze({
	"queue.json": { original: `${run}/queue.json`, sha256: "4628d78f44c69171b528237f68d0f32c9685fe64fb24d8b149be8762aa88c770" }
	, "run.tap": { original: `${run}/run.tap`, sha256: "246bbf6869aa41b9c1a6768aab61abb87cac64c2f7267b8dd1f4bdeb6fbc42d5" }
	, "end.txt": { original: `${run}/end.txt`, sha256: "dd91b26f599a6b974272dc9b82b06696fdaddbec73ab989d2a5822497246f88a" }
	, "wit.json": { original: `${run}/wit.json`, sha256: "dff385d9fb5348a424aba0b1bad16b633b71216ab4d6dd647c1f6d0ca0730bb5" }
	, "wit-reviewed.json": { original: `${run}/wit-reviewed.json`, sha256: "ab71f60816b5e5c58cb9480642491fc05c8bd660ba68250dd3be6758a095102b" }
});
/** The ten producer sources the queue pinned. */
export const witDispatchSources = Object.freeze({
	"tests/wit-fin.test.mjs": "002505d7e71e398484a0c2d82ad7a12935fcd8e51e79535e73afc48f895a1199"
	, "tests/helpers/native-fin-dispatch.mjs": "e1b7105b020665d1ff624baa09f0ab62101b3a3eaba5d9f79cc56895105fb0bc"
	, "tests/helpers/native-fin-dispatch-tests.mjs": "7ed7bc8353591017d8bdb6afd44221036b898381ea2d0c6446e4bb5f24175a8b"
	, "tests/helpers/native-fin-count-interposer.mjs": "4bbb43a5ed86ffeb001c764f32114c0104d0649cb94ec7e2d341aea4eca226c4"
	, "tests/helpers/native-fin-consumers.mjs": "a0437bc542bfed6a765692cceff76f68b39d5f7e537263d1d1ab8a0d2de556fd"
	, "tests/helpers/type-corpus-wit.mjs": "2cf8c27c2401bb5aea78a9a172cdb5044f4f1a1e023d0efc6a02891d84aff378"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "src/backends/wit/copied-host.mjs": "d93a198b62f7b70f3756abe6d305902abfb02087faca2b56fb063ef553c7bfdf"
	, "src/build/native-wit-projection.mjs": "2154c3c3752f39547d1cdeeee4ebed6cb3579513ecbf7d293eee26ed46877397"
	, "src/build/native-component.mjs": "2798e4cad749111193445a470704201c350819241a293a155c4baff59f135867"
});

/**
 * Where an archived producer source lives.
 *
 * @param path - Repository-relative source path.
 */
export const witDispatchSnapshot = path => archived(`sources/dac615e/${path}.txt`);

/** The archive's exact path set besides its receipt. */
export const witDispatchArchivePaths = Object.freeze([...Object.keys(witDispatchOriginals).map(archived), ...Object.keys(witDispatchSources).map(witDispatchSnapshot)]);

/** Lean source entries for mirror, impossible and label, then the nativefin@1.0.0 adapters in the same order. */
export const witDispatchColumns = Object.freeze([
	"l_NativeFin_mirror"
	, "l_NativeFin_impossible"
	, "l_NativeFin_label"
	, "lb_b59f358d1c9475f24bd43985"
	, "lb_5597f18ac5ddcf489aa03c3d"
	, "lb_97e49b166fad657a61e68249"
]);
const zero = [0, 0, 0, 0, 0, 0], one = [1, 0, 1, 1, 0, 1];
/** The exact cumulative rows observed in both the ordinary and reviewed installed hosts. */
export const witDispatchRows = Object.freeze([
	["start", "ok", zero]
	, ["invalid-mirror-bound", "rejected:arg0<10", zero]
	, ["invalid-mirror-huge", "rejected:arg0<10", zero]
	, ["invalid-impossible-zero", "rejected:arg0<0", zero]
	, ["invalid-label-late", "rejected:arg1<4", zero]
	, ["valid-mirror", "ok:6", [1, 0, 0, 1, 0, 0]]
	, ["valid-label", "ok:slot:8", one]
	, ["recovery-invalid-mirror", "rejected:arg0<10", one]
	, ["recovery-invalid-impossible", "rejected:arg0<0", one]
	, ["recovery-invalid-label", "rejected:arg1<4", one]
	, ["recovery-valid-mirror", "ok:0", [2, 0, 1, 2, 0, 1]]
	, ["recovery-valid-label", "ok:slot:5", [2, 0, 2, 2, 0, 2]]
]);
const routes = ["public WIT exports mirror, impossible and label through the installed nativefin_wasmtime_call host API, the embedded Wasmtime component and its host imports into the bundled C adapter"];
const positiveControl = "valid public WIT calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column";
const probeSha256 = "0b7e94310b4f6546649648cd2c6d3437d01ded29c1122216192a82ca22baf582";
const interposerSha256 = "8ae86dd2ad7d6de5c37d9d0cf8e1ec5c3c3c71f85948bb4fa043f4bda7e23682";
export const witDispatchTests = Object.freeze([
	"the parametrized interposer reproduces the measured native-fin interposer byte for byte"
	, "the dispatch steps separate rejections from positive controls"
	, "the dispatch reader accepts only the exact ordered per-step rows"
	, "WIT/WASI host packages are checked Fin consumers beside the other C-adapter hosts"
	, "WIT bound docs come only from checked refinement metadata and leave the WIT text unchanged"
	, "the WIT dispatch rows spell each rejection by parameter and bound and each result by value"
	, "the WIT dispatch probe counts a stand-in C-adapter host exactly and refuses a missing counter, a foreign host and a leaking host"
	, "relocated source-free WIT/WASI hosts check Fin bounds through the bundled C adapter"
	, "independently reviewed Wit packages check scalar Fin through installed consumers"
]);

/**
 * Recount rows independently of the pinned table: each rejected step changes no column, each successful step
 * enters exactly its own source and adapter once, and the Fin 0 columns never move.
 *
 * @param observed - Recorded rows.
 */
export const assertWitDispatchDeltas = observed => {
	assert.deepEqual(observed[0], ["start", "ok", zero]);
	const own = { mirror: [0, 3], label: [2, 5] };
	for(let index = 1; index < observed.length; index++)
	{
		const [step, status, counts] = observed[index], previous = observed[index - 1][2];
		const delta = counts.map((count, column) => count - previous[column]);
		if(status.startsWith("rejected:")) assert.deepEqual(delta, zero, step);
		else
		{
			const [source, adapter] = own[step.split("-").at(-1)];
			assert.deepEqual(delta, zero.map((_, column) => column === source || column === adapter ? 1 : 0), step);
		}
		assert.equal(counts[1] + counts[4], 0, `${step}: Fin 0 never enters`);
	}
};

/**
 * The exact pinned rows, which must also pass the independent recount.
 *
 * @param observed - Recorded rows.
 */
export const assertWitDispatchRows = observed => {
	assert.deepEqual(observed, witDispatchRows);
	assertWitDispatchDeltas(observed);
};

const isolation = ["sourcesRemovedBeforeInstall", "installedSourcesRemoved", "offline", "runtimeOverridesDisabled", "publicHeadersOnly", "compilerFreeExecution", "localLibraries"];

/**
 * Validate one installed report, ordinary or reviewed.
 *
 * @param text - Original report text.
 * @param path - Expected source path.
 */
export const assertWitDispatchReport = (text, path) => {
	const report = JSON.parse(text);
	assert.deepEqual(Object.keys(report), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true); assert.equal(report.reports.length, 1);
	assert.deepEqual(Object.keys(report.archives).sort(), ["archives/nativefin-1.0.0-c.tar.gz", "archives/nativefin-1.0.0-wit-wasi.tar.gz"]);
	const [item] = report.reports;
	assert.equal(item.path, path); assert.equal(item.profile, "wit-wasi"); assert.equal(item.sourceRemovedBeforeInstallation, true);
	assert.equal(path === "reviewed-ir", typeof item.reviewedSourceSha256 === "string");
	assert.deepEqual(item.packages.map(pkg => [pkg.name, pkg.version, pkg.target, pkg.role]), [["nativefin", "1.0.0", "wit-wasi", "component"]]);
	assert.equal(item.observation.checks, 2027); assert.equal(item.observation.rejections, 1013); assert.equal(item.observation.hostVersion, "42.0.1");
	for(const flag of isolation) assert.equal(item.wit[flag], true, flag);
	assert.equal(item.wit.repeatExecutions, 2);
	assert.equal(item.wit.archiveSha256, report.archives["archives/nativefin-1.0.0-wit-wasi.tar.gz"]);
	assert.equal(item.sharedNativeLibraries["libnativefin.so"], item.wit.libraries["lib/libnativefin.so"].sha256);
	const dispatch = item.dispatch;
	assert.deepEqual(Object.keys(dispatch).sort(), ["columns", "interposer", "interposerSha256", "observed", "positiveControl", "probeSha256", "routes"]);
	assert.deepEqual(dispatch.columns, witDispatchColumns); assert.equal(dispatch.interposer, "LD_PRELOAD");
	assert.deepEqual(dispatch.routes, routes); assert.equal(dispatch.positiveControl, positiveControl);
	assert.equal(dispatch.probeSha256, probeSha256); assert.equal(dispatch.interposerSha256, interposerSha256);
	assertWitDispatchRows(dispatch.observed);
	return item;
};

/**
 * Validate the original queue, TAP and end record.
 *
 * @param files - Archived run records.
 * @param files.queue - Original queue text.
 * @param files.tap - Original TAP text.
 * @param files.end - Original end record.
 */
export const assertWitDispatchRun = ({ queue, tap, end }) => {
	const record = JSON.parse(queue);
	assert.equal(record.node, 1425); assert.equal(record.revision, witDispatchRevision);
	assert.equal(record.selection, "tests/wit-fin.test.mjs (both gated tests: ordinary and independently reviewed)");
	assert.equal(record.command, "env -u FORCE_COLOR NO_COLOR=1 LEAN_BRIDGE_WIT_FIN_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 LEAN_BRIDGE_WASMTIME_C_API=/app/.toolchains/wasmtime42 taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests/wit-fin.test.mjs");
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.environment, { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_WIT_FIN_TEST: "1", LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36", LEAN_BRIDGE_WASMTIME_C_API: "/app/.toolchains/wasmtime42", TMPDIR: "(unset: /tmp)" });
	assert.deepEqual(record.sources, witDispatchSources);
	assert.deepEqual(Object.keys(record.versions), ["node", "lean", "wasmtime", "libwasmtimeSha256", "wasmTools", "wasmToolsSha256", "cc", "nm"]);
	assert.match(record.versions.wasmtime, /^42\.0\.1 /u); assert.match(record.versions.wasmTools, /^wasm-tools 1\.245\.1 /u);
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), witDispatchTests.map((name, index) => ["ok", String(index + 1), name]));
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["9"]);
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	assert.equal(tap.split("# per-step source and adapter counts in the relocated WIT host process\n").length, 3, "both gated routes counted");
	for(const [key, count] of Object.entries({ tests: 9, pass: 9, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], `TAP ${key}`);
	const ended = /^end=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ exit=(\d+) minFree=(\d+)M\n$/u.exec(end);
	assert.ok(ended, "end record"); assert.equal(ended[1], "0", "exit 0"); assert.ok(Number(ended[2]) >= 1024, "free-space floor");
};

/** Lines of the producer test that make each gated run refuse a missing counter or foreign host, then demand the exact rows. */
const refusalLines = Object.freeze([
	"const missingCounter = \"native_fin_dispatch_count is not resolvable in this WIT host process\\n\";"
	, "	await assert.rejects(runCopied(command, [deployment], probeRoot), error => /exited with status 2/.test(error.message)\n		&& error.details.stdout === \"\" && error.details.stderr === missingCounter);"
	, "	const run = await runCopied(command, [deployment], probeRoot, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });"
	, "	assert.deepEqual(observed, witFinDispatchExpected);"
	, "	for(const symbol of columns) assert.ok(defined.has(symbol), symbol);"
	, "    fputs(\"nativefin_wasmtime_call is not loaded from the deployment\\\\n\", stderr); return 3;"
	, "		assert.equal(model.component.id, \"nativefin@1.0.0\");"
	, "		const dispatch = await observeWitDispatch({ consumer, handoff, pkg, wit: installed.wit, componentId: model.component.id });"
]);

/**
 * The producer test refuses a missing counter and a foreign host before the preloaded run and checks every
 * symbol; the shared helper tests hold the first three selected tests.
 *
 * @param source - Archived producer test source.
 * @param helperTests - Archived shared dispatch helper tests.
 */
export const assertWitDispatchTestSource = (source, helperTests) => {
	for(const line of refusalLines) assert.equal(source.split(line).length, 2, line);
	assert.equal(source.split("import \"./helpers/native-fin-dispatch-tests.mjs\";").length, 2, "helper tests imported");
	for(const [index, name] of witDispatchTests.entries())
		assert.equal((index < 3 ? helperTests : source).split(`test("${name}"`).length, 2, name);
};

/**
 * The receipt's fixed statement of scope; artifacts come from the archived bytes.
 *
 * @param artifacts - Archived file references.
 */
export const witDispatchReceipt = artifacts => ({
	schemaVersion: 1
	, planNode: 1425
	, execution: "local"
	, revision: witDispatchRevision
	, sources: witDispatchSources
	, scope: {
		host: "WIT/WASI (wit-wasi) installed Wasmtime host packages, ordinary source and independently reviewed IR"
		, counter: "LD_PRELOAD interposer for component nativefin@1.0.0 counting three Lean source entries and three C adapters per step"
		, routes
		, missingCounter: "each gated run first requires the probe to refuse a process without the counter, and the probe refuses a host library outside the relocated deployment"
		, environment: "Local Wasmtime 42.0.1 C API, wasm-tools 1.245.1 and a glibc 2.36 package floor on x86_64 Linux; no other Wasmtime, wasm-tools or glibc floor is established"
		, otherHosts: false
		, hostedCi: false
		, olderEvidence: "docs/evidence/native-fin-hosts-20261006.md and its observed:false records are unchanged; this is a separately dated measurement"
	}
	, artifacts
	, remaining: ["Inventory promotion and source history belong to main.", "Ruby, .NET and JVM counters remain."]
});

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeWitDispatchArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};

/**
 * Authenticate the whole archive: the exact path set before any read, every digest, the fixed receipt, the
 * run records, both reports, the producer test and, unless disabled, the current sources through the
 * historical reader at their producer digests.
 *
 * @param receipt - Parsed receipt.
 * @param read - Read archived or repository bytes for a repository-relative path.
 * @param options - Validation options.
 * @param options.currentSources - Also require the current sources to reach their producer digests.
 */
export const assertWitDispatchArchive = async (receipt, read, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...witDispatchArchivePaths].sort(), "the exact archive path set");
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt, witDispatchReceipt(receipt.artifacts));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path] = bytes.toString();
	}
	for(const [name, file] of Object.entries(witDispatchOriginals))
	{
		const artifact = receipt.artifacts.find(item => item.path === archived(name));
		assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
	}
	for(const [path, digest] of Object.entries(witDispatchSources))
	{
		const artifact = receipt.artifacts.find(item => item.path === witDispatchSnapshot(path));
		assert.equal(artifact.originalPath, `git:${witDispatchRevision}:${path}`); assert.equal(artifact.sha256, digest, path);
	}
	assertWitDispatchRun({ queue: files[archived("queue.json")], tap: files[archived("run.tap")], end: files[archived("end.txt")] });
	const ordinary = assertWitDispatchReport(files[archived("wit.json")], "ordinary-source");
	const reviewed = assertWitDispatchReport(files[archived("wit-reviewed.json")], "reviewed-ir");
	assert.deepEqual(reviewed.dispatch, ordinary.dispatch, "the same counters in both routes");
	assertWitDispatchTestSource(files[witDispatchSnapshot("tests/wit-fin.test.mjs")], files[witDispatchSnapshot("tests/helpers/native-fin-dispatch-tests.mjs")]);
	for(const path of currentSources ? Object.keys(witDispatchSources) : [])
	{
		const source = beforeFinRefinementSource(path, await read(path), witDispatchSources[path]);
		assert.equal(sha256(source), witDispatchSources[path], path);
		assert.equal(source.toString(), files[witDispatchSnapshot(path)], `${path} snapshot`);
	}
};
