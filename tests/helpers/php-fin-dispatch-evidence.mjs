/**
 * Authenticate the installed native PHP Fin dispatch-counter run (VO #1425): its original queue, TAP,
 * end record and both ordinary and reviewed reports, and the five producer sources at 5926094. Paths are
 * checked before any read. Older observed:false evidence is separate and left untouched.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const phpDispatchArchiveDirectory = "docs/evidence/php-fin-dispatch-20261008";
export const phpDispatchRevision = "592609416c71b2a52d72c5ad00d31b2440b88732";
const archived = name => `${phpDispatchArchiveDirectory}/${name}`;
const run = "build/vo1425-php-dispatch-5926094";

/** Original producer outputs, relative to the producing checkout, with their posted digests. */
export const phpDispatchOriginals = Object.freeze({
	"queue.json": { original: `${run}/queue.json`, sha256: "8b37732e04fb2c01bbab4241ce9e2e4650e186a0a44599bd8ba18ebacaf1d5c7" }
	, "run.tap": { original: `${run}/run.tap`, sha256: "f11febeff30efd2bf90241eceba299f4a6f7c7794a6649003e4a0fd20ec5a57e" }
	, "end.txt": { original: `${run}/end.txt`, sha256: "cc713c28152c383986c952573ba02d7ba40d73f01e921f1dbf6355218a1fec73" }
	, "php.json": { original: `${run}/php.json`, sha256: "6111649002d7111c814f2c9b237f618727eb36f665fc313b1bb2f6630ededf5b" }
	, "php-reviewed.json": { original: `${run}/php-reviewed.json`, sha256: "9a3df65fdbf46b8ad4cebb0bb8220857cd745cfd3f9b6deea35db7ed6e686f62" }
});
/** The five producer sources the queue pinned. */
export const phpDispatchSources = Object.freeze({
	"tests/php-fin.test.mjs": "ebf0ce859e6883891bc43dc082b02d4c789be521f292a8a737a9e0ad99394502"
	, "tests/helpers/native-fin-count-interposer.mjs": "4bbb43a5ed86ffeb001c764f32114c0104d0649cb94ec7e2d341aea4eca226c4"
	, "tests/helpers/native-fin-consumers.mjs": "a0437bc542bfed6a765692cceff76f68b39d5f7e537263d1d1ab8a0d2de556fd"
	, "src/backends/php/copied-assets.mjs": "7c17badd4f5232adc70fb13dea0a06d9bdcf929cd20fe10d7f63762f3afc1de1"
	, "src/build/native-component.mjs": "2798e4cad749111193445a470704201c350819241a293a155c4baff59f135867"
});

/**
 * Where an archived producer source lives.
 *
 * @param path - Repository-relative source path.
 */
export const phpDispatchSnapshot = path => archived(`sources/5926094/${path}.txt`);

/** The archive's exact path set besides its receipt. */
export const phpDispatchArchivePaths = Object.freeze([...Object.keys(phpDispatchOriginals).map(archived), ...Object.keys(phpDispatchSources).map(phpDispatchSnapshot)]);

/** Lean source entries for mirror, impossible and label, then their C adapters in the same order. */
export const phpDispatchColumns = Object.freeze([
	"l_NativeFin_mirror"
	, "l_NativeFin_impossible"
	, "l_NativeFin_label"
	, "lb_b703515a10173a97c2e27e46"
	, "lb_1d7e0c72a4d6e1cde32466e4"
	, "lb_9afacce322a81504ba9eb75b"
]);
const zero = [0, 0, 0, 0, 0, 0], one = [1, 0, 1, 1, 0, 1];
/** The exact cumulative rows observed in both the ordinary and reviewed installed consumers. */
export const phpDispatchRows = Object.freeze([
	["start", "ok", zero]
	, ["invalid-mirror-bound", "rejected:1:arg0<10", zero]
	, ["invalid-mirror-huge", "rejected:1:arg0<10", zero]
	, ["invalid-impossible-zero", "rejected:1:arg0<0", zero]
	, ["invalid-label-late", "rejected:1:arg1<4", zero]
	, ["valid-mirror", "ok:6", [1, 0, 0, 1, 0, 0]]
	, ["valid-label", "ok:slot:8", one]
	, ["recovery-invalid-mirror", "rejected:1:arg0<10", one]
	, ["recovery-invalid-impossible", "rejected:1:arg0<0", one]
	, ["recovery-invalid-label", "rejected:1:arg1<4", one]
	, ["recovery-valid-mirror", "ok:0", [2, 0, 1, 2, 0, 1]]
	, ["recovery-valid-label", "ok:slot:5", [2, 0, 2, 2, 0, 2]]
]);
const routes = ["public PHP functions LeanNativeFin\\mirror, LeanNativeFin\\impossible and LeanNativeFin\\label through Composer autoload and PHP FFI into the bundled C adapter"];
const positiveControl = "valid public PHP calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column";
const probeSha256 = "560f67fef54a7de86605cc99507be9892b60eb1c5c62790168f93fec2640f344";
const interposerSha256 = "a6584dcb1a98f5d517680e475ad039e255d1ff15a1bfdb4e0ab49414651da710";
export const phpDispatchTests = Object.freeze([
	"native PHP packages are checked Fin consumers beside the other C-adapter hosts"
	, "generated PHP bound docs come only from checked refinement metadata"
	, "the PHP dispatch expectations separate rejections from positive controls"
	, "the PHP dispatch parser accepts only the exact ordered per-step rows"
	, "the PHP dispatch probe parses and refuses a process without the counter"
	, "relocated source-free native PHP packages check Fin bounds through the bundled C adapter"
	, "independently reviewed Php packages check scalar Fin through installed consumers"
]);

/**
 * Recount rows independently of the pinned table: each rejected step changes no column, each successful step
 * enters exactly its own source and adapter once, and the Fin 0 columns never move.
 *
 * @param observed - Recorded rows.
 */
export const assertPhpDispatchDeltas = observed => {
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
export const assertPhpDispatchRows = observed => {
	assert.deepEqual(observed, phpDispatchRows);
	assertPhpDispatchDeltas(observed);
};

/**
 * Validate one installed report, ordinary or reviewed.
 *
 * @param text - Original report text.
 * @param path - Expected source path.
 */
export const assertPhpDispatchReport = (text, path) => {
	const report = JSON.parse(text);
	assert.deepEqual(Object.keys(report), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true); assert.equal(report.reports.length, 1);
	assert.deepEqual(Object.keys(report.archives).sort(), ["archives/lean-bridge-fixtures-native-fin-1.0.0-linux-x86_64.zip", "archives/native-fin-1.0.0-c.tar.gz"]);
	const [item] = report.reports;
	assert.equal(item.path, path); assert.equal(item.profile, "php-native"); assert.equal(item.checks, 2028);
	for(const flag of ["compilerFreePath", "offlineInstall", "relocatedInstallation", "repeatExecution", "sourceRemovedBeforeInstallation"]) assert.equal(item[flag], true, flag);
	assert.equal(path === "reviewed-ir", typeof item.reviewedSourceSha256 === "string");
	assert.deepEqual(item.packages.map(pkg => [pkg.name, pkg.version, pkg.target, pkg.role]), [["lean-bridge-fixtures/native-fin", "1.0.0", "php-native", "component"]]);
	const dispatch = item.dispatch;
	assert.deepEqual(Object.keys(dispatch).sort(), ["columns", "interposer", "interposerSha256", "observed", "positiveControl", "probeSha256", "routes"]);
	assert.deepEqual(dispatch.columns, phpDispatchColumns); assert.equal(dispatch.interposer, "LD_PRELOAD");
	assert.deepEqual(dispatch.routes, routes); assert.equal(dispatch.positiveControl, positiveControl);
	assert.equal(dispatch.probeSha256, probeSha256); assert.equal(dispatch.interposerSha256, interposerSha256);
	assertPhpDispatchRows(dispatch.observed);
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
export const assertPhpDispatchRun = ({ queue, tap, end }) => {
	const record = JSON.parse(queue);
	assert.equal(record.node, 1425); assert.equal(record.revision, phpDispatchRevision);
	assert.equal(record.selection, "tests/php-fin.test.mjs (both gated tests: ordinary and independently reviewed)");
	assert.equal(record.command, "env -u FORCE_COLOR NO_COLOR=1 LEAN_BRIDGE_PHP_FIN_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests/php-fin.test.mjs");
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.environment, { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_PHP_FIN_TEST: "1", LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36", TMPDIR: "(unset: /tmp)" });
	assert.deepEqual(record.sources, phpDispatchSources);
	assert.deepEqual(Object.keys(record.versions), ["node", "lean", "php", "composer", "cc", "nm"]);
	assert.match(record.versions.php, /^PHP 8\.2\.33 \(cli\)/u);
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), phpDispatchTests.map((name, index) => ["ok", String(index + 1), name]));
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["7"]);
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	for(const [key, count] of Object.entries({ tests: 7, pass: 7, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], `TAP ${key}`);
	const ended = /^end=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ exit=(\d+) minFree=(\d+)M\n$/u.exec(end);
	assert.ok(ended, "end record"); assert.equal(ended[1], "0", "exit 0"); assert.ok(Number(ended[2]) >= 1024, "free-space floor");
};

/** Lines of the producer test that make each gated run refuse a process without the counter, then demand the exact rows. */
const refusalLines = Object.freeze([
	"const missingCounter = \"native_fin_dispatch_count is not resolvable in this PHP process: Failed resolving C function 'native_fin_dispatch_count'\\n\";"
	, "	await assert.rejects(runCopied(command, args, relocated), error => /exited with status 2/.test(error.message)"
	, "		&& error.details.stdout === \"\" && error.details.stderr === missingCounter);"
	, "	const run = await runCopied(command, args, relocated, { ...copiedCleanEnvironment, LD_PRELOAD: interposer });"
	, "	assert.deepEqual(observed, phpFinDispatchExpected);"
	, "	for(const symbol of nativeFinDispatchColumns) assert.ok(defined.has(symbol), symbol);"
]);

/**
 * The producer test refuses a process without the counter before the preloaded run and checks every symbol.
 *
 * @param source - Archived producer test source.
 */
export const assertPhpDispatchTestSource = source => {
	for(const line of refusalLines) assert.equal(source.split(line).length, 2, line);
	for(const name of phpDispatchTests) assert.equal(source.split(`test("${name}"`).length, 2, name);
};

/**
 * The receipt's fixed statement of scope; artifacts come from the archived bytes.
 *
 * @param artifacts - Archived file references.
 */
export const phpDispatchReceipt = artifacts => ({
	schemaVersion: 1
	, planNode: 1425
	, execution: "local"
	, revision: phpDispatchRevision
	, sources: phpDispatchSources
	, scope: {
		host: "native PHP (php-native) installed packages, ordinary source and independently reviewed IR"
		, counter: "LD_PRELOAD interposer counting three Lean source entries and three C adapters per step"
		, routes
		, missingCounter: "each gated run first requires the probe to refuse a process without the counter"
		, otherHosts: false
		, hostedCi: false
		, olderEvidence: "docs/evidence/native-fin-hosts-20261006.md and its observed:false records are unchanged; this is a separately dated measurement"
	}
	, artifacts
	, remaining: ["Inventory promotion and source history belong to main.", "WIT, Ruby, .NET and JVM counters remain."]
});

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writePhpDispatchArtifact = async (path, bytes) => {
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
export const assertPhpDispatchArchive = async (receipt, read, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...phpDispatchArchivePaths].sort(), "the exact archive path set");
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt, phpDispatchReceipt(receipt.artifacts));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path] = bytes.toString();
	}
	for(const [name, file] of Object.entries(phpDispatchOriginals))
	{
		const artifact = receipt.artifacts.find(item => item.path === archived(name));
		assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
	}
	for(const [path, digest] of Object.entries(phpDispatchSources))
	{
		const artifact = receipt.artifacts.find(item => item.path === phpDispatchSnapshot(path));
		assert.equal(artifact.originalPath, `git:${phpDispatchRevision}:${path}`); assert.equal(artifact.sha256, digest, path);
	}
	assertPhpDispatchRun({ queue: files[archived("queue.json")], tap: files[archived("run.tap")], end: files[archived("end.txt")] });
	const ordinary = assertPhpDispatchReport(files[archived("php.json")], "ordinary-source");
	const reviewed = assertPhpDispatchReport(files[archived("php-reviewed.json")], "reviewed-ir");
	assert.deepEqual(reviewed.dispatch, ordinary.dispatch, "the same counters in both routes");
	assertPhpDispatchTestSource(files[phpDispatchSnapshot("tests/php-fin.test.mjs")]);
	for(const path of currentSources ? Object.keys(phpDispatchSources) : [])
	{
		const source = beforeFinRefinementSource(path, await read(path), phpDispatchSources[path]);
		assert.equal(sha256(source), phpDispatchSources[path], path);
		assert.equal(source.toString(), files[phpDispatchSnapshot(path)], `${path} snapshot`);
	}
};
