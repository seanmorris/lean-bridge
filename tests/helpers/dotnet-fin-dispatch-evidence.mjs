/**
 * Authenticate the installed .NET Fin dispatch-counter run (VO #1425): its original queue, TAP, end record and
 * both ordinary and reviewed reports, and the nine producer sources at 75a5114. Paths are checked before any
 * read. The older observed:false .NET evidence is separate and left untouched.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const dotnetDispatchArchiveDirectory = "docs/evidence/dotnet-fin-dispatch-20261009";
export const dotnetDispatchRevision = "75a51146adad19a4fb0f253be66bf980e5fbd965";
const archived = name => `${dotnetDispatchArchiveDirectory}/${name}`;
const run = "build/vo1425-dotnet-dispatch-75a5114";

/** Original producer outputs, relative to the producing checkout, with their posted digests. */
export const dotnetDispatchOriginals = Object.freeze({
	"queue.json": { original: `${run}/queue.json`, sha256: "00389e1afe26c2cc52c46590753f029b564bf8387644453a58de7badb8080f94" }
	, "run.tap": { original: `${run}/run.tap`, sha256: "c072c582044fd38a331abff46d0f0dfec20c5a318f36c2ff921609b7e1ace9a9" }
	, "end.txt": { original: `${run}/end.txt`, sha256: "83e61ab900998e678376bea045a0184f18d1a2258cd81515a709f15dd08ed740" }
	, "dotnet.json": { original: `${run}/dotnet.json`, sha256: "09d07a8ea5b9fe8f4a465f321fc77beba1457f0d0871e0c91013dcedbc0ebaf7" }
	, "dotnet-reviewed.json": { original: `${run}/dotnet-reviewed.json`, sha256: "c401d6c12c99ba205aac261d4a72704bee0248e5a4f311577f4a26e5c0572926" }
});
/** The nine producer sources the queue pinned. */
export const dotnetDispatchSources = Object.freeze({
	"tests/dotnet-fin.test.mjs": "0e875c02e5ec5a1e6c4b00c3d51d919b3db5aabd1037945b3cc613686e787b63"
	, "tests/helpers/native-fin-dispatch-gdb-run.mjs": "edbbfc38de53667bbd09b435ee5d1c73fdf9ce247625f139abe2dcf4b10c4690"
	, "tests/helpers/native-fin-dispatch-gdb.mjs": "71905e87090421e3346652b49ef2a35528e96568e605b84c5e8649a1dd773792"
	, "tests/helpers/native-fin-dispatch.mjs": "e1b7105b020665d1ff624baa09f0ab62101b3a3eaba5d9f79cc56895105fb0bc"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "src/backends/dotnet/verified-assets.mjs": "972aa8ddd973f71fa7e8177fcada0eceaf567c1d3b4519da0591157f646332ff"
	, "src/backends/dotnet/copied-values.mjs": "b4ec94f1da85ad3cab476520ca0ce19d1e4807c54dab25fef7370c46295fc82c"
	, "src/backends/dotnet/copied-model.mjs": "ae2c93521614952d4c96748e8d5bdabb803f1a4663299cf3542ddd0add073d4b"
	, "src/build/native-component.mjs": "2798e4cad749111193445a470704201c350819241a293a155c4baff59f135867"
});

/**
 * Where an archived producer source lives.
 *
 * @param path - Repository-relative source path.
 */
export const dotnetDispatchSnapshot = path => archived(`sources/75a5114/${path}.txt`);

/** The archive's exact path set besides its receipt. */
export const dotnetDispatchArchivePaths = Object.freeze([...Object.keys(dotnetDispatchOriginals).map(archived), ...Object.keys(dotnetDispatchSources).map(dotnetDispatchSnapshot)]);

/** Lean source entries for mirror, impossible and label, then the native-fin@1.0.0 adapters in the same order. */
export const dotnetDispatchColumns = Object.freeze([
	"l_NativeFin_mirror"
	, "l_NativeFin_impossible"
	, "l_NativeFin_label"
	, "lb_b703515a10173a97c2e27e46"
	, "lb_1d7e0c72a4d6e1cde32466e4"
	, "lb_9afacce322a81504ba9eb75b"
]);
const component = "libcomponent_3f006a55a2dafabb9196.so";
/** The single verified definition of each column, as nm listed it and GDB armed it, in column order. */
export const dotnetDispatchOffsets = Object.freeze(["0x23f0", "0x22f0", "0x2780", "0x2bd0", "0x29b0", "0x2a40"]);
/** Every library in the probe's verified runtimes/linux-x64/native root, with its content digest. */
export const dotnetDispatchLibraries = Object.freeze({
	[component]: "1dc7c7fefd12e9b23c58a55d588a03213594055c6f27c501eca3fbff0d3de420"
	, "liblean_bridge_native.so": "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7"
	, "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"
	, "libnative_fin.so": "a969da07861f6e1074a6b994808e8132ecfa2e05268aa175a076b72fc01c4a9b"
});
const zero = [0, 0, 0, 0, 0, 0], one = [1, 0, 1, 1, 0, 1];
/** The exact cumulative rows observed in both the ordinary and reviewed installed processes. */
export const dotnetDispatchRows = Object.freeze([
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
const routes = ["public .NET methods LeanBridge.NativeFin.Api.Mirror, .Impossible and .Label through the verified RTLD_DEEPBIND NuGet loader and DllImport into the bundled C adapter"];
const loadTrigger = "Api.Only(0) == 7: a public call outside the six counted columns, after a record with nothing armed and no entries, and before a record with all six armed and still no entries";
const positiveControl = "valid public .NET calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column";
const instrumentation = "in-memory int3 breakpoints at each verified definition; deployed files and the production loader are unchanged";
const gdb = Object.freeze({ sha256: "762f9d48202dd341e170d8302543f35622417b4e39bfce9a270d06943702e754", version: "GNU gdb (Debian 13.1-3) 13.1" });
const probeSha256 = "3509e5ac85f8e599b016cd4bbc879995eaa0fd1716b0a61b687cd10b42b77524";
export const dotnetDispatchTests = Object.freeze([
	".NET packages are checked Fin consumers beside C, C++, Python, Rust and Ruby"
	, "generated .NET bound docs come only from checked refinement metadata"
	, "GDB entry breakpoints count a deep-bound .NET stand-in after its explicit load trigger and refuse missing, early, stale, foreign and leaking runs"
	, "relocated source-free .NET packages check Fin bounds through the bundled C adapter"
	, "independently reviewed Dotnet packages check scalar Fin through installed consumers"
]);

/**
 * The GDB identity digest, recomputed from the report's own columns, libraries and definers.
 *
 * @param dispatch - One report's dispatch record.
 */
export const dotnetDispatchConfig = dispatch => sha256(canonicalJson({
	schemaVersion: 1
	, platform: "x86_64-linux-gnu"
	, instrument: "gdb-breakpoints"
	, componentId: "native-fin@1.0.0"
	, columns: dispatch.columns
	, libraries: Object.keys(dispatch.libraries).sort()
	, definers: dispatch.definers
}));

/**
 * Recount rows independently of the pinned table: each rejected step changes no column, each successful step
 * enters exactly its own source and adapter once, and the Fin 0 columns never move.
 *
 * @param observed - Recorded rows.
 */
export const assertDotnetDispatchDeltas = observed => {
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
export const assertDotnetDispatchRows = observed => {
	assert.deepEqual(observed, dotnetDispatchRows);
	assertDotnetDispatchDeltas(observed);
};

/**
 * Validate one installed report, ordinary or reviewed.
 *
 * @param text - Original report text.
 * @param path - Expected source path.
 * @param scriptSha256 - Digest of the GDB script text in the archived producer helper.
 */
export const assertDotnetDispatchReport = (text, path, scriptSha256) => {
	const report = JSON.parse(text);
	assert.deepEqual(Object.keys(report), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true); assert.equal(report.reports.length, 1);
	assert.deepEqual(Object.keys(report.archives).sort(), ["archives/native-fin-1.0.0-c.tar.gz", "archives/native-fin.1.0.0.nupkg"]);
	const [item] = report.reports;
	const keys = ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "dispatch", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "relocatedInstallation", "repeatExecution", "sharedNativeLibraries", "sourceRemovedBeforeInstallation", "sourceTreeSha256"];
	assert.deepEqual(Object.keys(item).sort(), [...keys, ...path === "reviewed-ir" ? ["reviewedSourceSha256"] : []].sort());
	assert.equal(item.path, path); assert.equal(item.profile, "dotnet"); assert.equal(item.checks, 2022);
	for(const flag of ["sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "offlineInstall", "compilerFreePath"]) assert.equal(item[flag], true, flag);
	assert.deepEqual(item.packages.map(pkg => [pkg.name, pkg.version, pkg.target, pkg.role]), [["native-fin", "1.0.0", "nuget", "component"]]);
	assert.equal(item.packages[0].artifacts[0].sha256, report.archives["archives/native-fin.1.0.0.nupkg"]);
	assert.deepEqual(item.sharedNativeLibraries, dotnetDispatchLibraries);
	const dispatch = item.dispatch;
	assert.deepEqual(Object.keys(dispatch).sort(), ["breakpoints", "columns", "configSha256", "definers", "gdb", "instrument", "instrumentation", "libraries", "loadTrigger", "observed", "positiveControl", "probeSha256", "routes", "scope", "scriptSha256"]);
	assert.deepEqual(dispatch.columns, dotnetDispatchColumns); assert.equal(dispatch.instrument, "gdb-breakpoints"); assert.equal(dispatch.instrumentation, instrumentation);
	assert.deepEqual(dispatch.routes, routes); assert.equal(dispatch.loadTrigger, loadTrigger); assert.equal(dispatch.positiveControl, positiveControl);
	assert.equal(dispatch.scope, "x86_64 Linux with GDB and ptrace");
	assert.equal(dispatch.probeSha256, probeSha256); assert.equal(dispatch.scriptSha256, scriptSha256);
	assert.deepEqual(dispatch.gdb, gdb);
	// Every column has one verified definer in the root, at its pinned nm offset, under the recomputed identity.
	assert.deepEqual(dispatch.libraries, dotnetDispatchLibraries);
	assert.deepEqual(dispatch.definers, Array(6).fill(component));
	assert.deepEqual(dispatch.breakpoints, dotnetDispatchColumns.map((symbol, k) => ({ library: component, offset: dotnetDispatchOffsets[k], symbol })));
	assert.equal(dispatch.configSha256, dotnetDispatchConfig(dispatch));
	assertDotnetDispatchRows(dispatch.observed);
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
export const assertDotnetDispatchRun = ({ queue, tap, end }) => {
	const record = JSON.parse(queue);
	assert.equal(record.node, 1425); assert.equal(record.revision, dotnetDispatchRevision); assert.equal(record.go, "board 2211");
	assert.equal(record.selection, "tests/dotnet-fin.test.mjs (all five tests: two ungated unit tests, the gated stand-in controls and both gated installed routes)");
	assert.equal(record.command, "env -u FORCE_COLOR NO_COLOR=1 LEAN_BRIDGE_DOTNET_FIN_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests/dotnet-fin.test.mjs");
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.environment, { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_DOTNET_FIN_TEST: "1", LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36", LEAN_BRIDGE_DOTNET: "(unset: .toolchains/dotnet/dotnet)", LEAN_BRIDGE_GDB: "(unset: /usr/bin/gdb)", TMPDIR: "(unset: /tmp)" });
	assert.deepEqual(record.sources, dotnetDispatchSources);
	assert.deepEqual(Object.keys(record.versions), ["node", "lean", "dotnetSdk", "dotnetRuntimes", "dotnetHostSha256", "glibc", "gdb", "gdbSha256", "ptraceScope", "cc", "nm", "readelf"]);
	assert.equal(record.versions.dotnetSdk, "8.0.424"); assert.match(record.versions.dotnetRuntimes, /Microsoft\.NETCore\.App 8\.0\.30 /u);
	assert.match(record.versions.glibc, / 2\.36$/u); assert.equal(record.versions.gdb, gdb.version); assert.equal(record.versions.gdbSha256, gdb.sha256);
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), dotnetDispatchTests.map((name, index) => ["ok", String(index + 1), name]));
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["5"]);
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	assert.equal(tap.split("# per-step source and adapter counts in a relocated .NET process under GDB entry breakpoints\n").length, 3, "both gated routes counted");
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], `TAP ${key}`);
	const ended = /^end=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ exit=(\d+) minFree=(\d+)M\n$/u.exec(end);
	assert.ok(ended, "end record"); assert.equal(ended[1], "0", "exit 0"); assert.ok(Number(ended[2]) >= 1024, "free-space floor");
};

/** Lines of the producer test that make the probe gate on nothing armed, trigger once and refuse an uncovered root. */
const probeLines = Object.freeze([
	"        if (!Ours(before) || !Quiet(before, 0))"
	, "        try { return Api.Only(0) == 7; }"
	, "        if (!Ours(after) || !Quiet(after, 0x3f) || !Covered(after))"
	, "    [MethodImpl(MethodImplOptions.NoInlining)]\n    static bool Trigger()"
]);
/** Lines of the installed acceptance that refuse a missing debugger, an unverified root and inexact rows. */
const acceptanceLines = Object.freeze([
	"\t\tassert.equal(model.component.id, \"native-fin@1.0.0\");"
	, "\t\tassert.equal(probeNative, join(dirname(probe), \"runtimes/linux-x64/native\"));"
	, "\t\tassert.deepEqual(deployed, Object.fromEntries(Object.keys(packageLibraries).sort().map(name => [name, packageLibraries[name]])));"
	, "\t\tassert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, \"\"); assert.equal(missing.stderr, unattached);"
	, "\t\tassert.deepEqual(observed, dotnetFinDispatchExpected);"
	, "\t\tconst breakpoints = await assertNativeFinGdbRun(observer, accepted, observed);"
	, "const standInSkip = process.env.LEAN_BRIDGE_DOTNET_FIN_TEST === \"1\" ? false : standInMissing;"
]);
/** Lines of the shared run helper that bind the record to the armed process and each offset to nm. */
const runnerLines = Object.freeze([
	"\tassert.deepEqual([mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [0x3f, 0, 0, [1, 1, 1, 1, 1, 1]]);"
	, "\tassert.equal(mapped.pid, manifest.pid, \"the record belongs to the instrumented inferior\");"
	, "\t\tassert.equal(offset, Number.parseInt(line.trim().split(\" \")[0], 16), symbol);"
]);

/**
 * The producer test gates its probe on the explicit trigger and refuses unverified runs; the run helper binds
 * the record and offsets; the named tests are the ones the TAP passed.
 *
 * @param source - Archived producer test source.
 * @param runner - Archived shared GDB run helper.
 */
export const assertDotnetDispatchTestSource = (source, runner) => {
	for(const line of [...probeLines, ...acceptanceLines]) assert.equal(source.split(line).length, 2, line);
	for(const line of runnerLines) assert.equal(runner.split(line).length, 2, line);
	for(const name of dotnetDispatchTests) assert.equal(source.split(`test(${JSON.stringify(name)}`).length, 2, name);
};

/**
 * The digest of the GDB script text inside the archived strict-root helper.
 *
 * @param helper - Archived native-fin-dispatch-gdb.mjs source.
 */
export const dotnetDispatchScriptSha256 = helper => {
	const marker = "export const nativeFinGdbScript = String.raw`", start = helper.indexOf(marker);
	assert.ok(start >= 0 && helper.indexOf(marker, start + 1) < 0, "one GDB script");
	const end = helper.indexOf("\n`;\n", start);
	assert.ok(end > start, "the GDB script ends");
	return sha256(helper.slice(start + marker.length, end + 1));
};

/**
 * The receipt's fixed statement of scope; artifacts come from the archived bytes.
 *
 * @param artifacts - Archived file references.
 */
export const dotnetDispatchReceipt = artifacts => ({
	schemaVersion: 1
	, planNode: 1425
	, execution: "local"
	, revision: dotnetDispatchRevision
	, sources: dotnetDispatchSources
	, scope: {
		host: ".NET (dotnet) installed NuGet packages consumed through a separately built C# probe, ordinary source and independently reviewed IR"
		, counter: "GDB address breakpoints in the probe process for component native-fin@1.0.0, three Lean source entries and three C adapters, each at its single nm definition in the probe's verified runtimes/linux-x64/native root"
		, routes
		, loadTrigger
		, missingCounter: "each gated run first requires the probe to refuse a process without GDB; the probe refuses anything armed before its trigger and an uncovered root after it"
		, environment: "Local .NET SDK 8.0.424 with Microsoft.NETCore.App 8.0.30, GNU gdb 13.1 with Yama ptrace_scope 0 and a glibc 2.36 package floor on x86_64 Linux; no other runtime, debugger, ptrace policy or glibc floor is established"
		, otherHosts: false
		, hostedCi: false
		, olderEvidence: "Earlier .NET Fin evidence, including its observed:false dispatch records, is unchanged; this is a separately dated measurement"
	}
	, artifacts
	, remaining: ["Inventory promotion and source history belong to main.", "Hosted CI needs the separate GDB wiring.", "JVM counters remain."]
});

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeDotnetDispatchArtifact = async (path, bytes) => {
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
export const assertDotnetDispatchArchive = async (receipt, read, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...dotnetDispatchArchivePaths].sort(), "the exact archive path set");
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt, dotnetDispatchReceipt(receipt.artifacts));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path] = bytes.toString();
	}
	for(const [name, file] of Object.entries(dotnetDispatchOriginals))
	{
		const artifact = receipt.artifacts.find(item => item.path === archived(name));
		assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
	}
	for(const [path, digest] of Object.entries(dotnetDispatchSources))
	{
		const artifact = receipt.artifacts.find(item => item.path === dotnetDispatchSnapshot(path));
		assert.equal(artifact.originalPath, `git:${dotnetDispatchRevision}:${path}`); assert.equal(artifact.sha256, digest, path);
	}
	assertDotnetDispatchRun({ queue: files[archived("queue.json")], tap: files[archived("run.tap")], end: files[archived("end.txt")] });
	const scriptSha256 = dotnetDispatchScriptSha256(files[dotnetDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb.mjs")]);
	const ordinary = assertDotnetDispatchReport(files[archived("dotnet.json")], "ordinary-source", scriptSha256);
	const reviewed = assertDotnetDispatchReport(files[archived("dotnet-reviewed.json")], "reviewed-ir", scriptSha256);
	assert.deepEqual(reviewed.dispatch, ordinary.dispatch, "the same counters in both routes");
	assertDotnetDispatchTestSource(files[dotnetDispatchSnapshot("tests/dotnet-fin.test.mjs")], files[dotnetDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb-run.mjs")]);
	for(const path of currentSources ? Object.keys(dotnetDispatchSources) : [])
	{
		const source = beforeFinRefinementSource(path, await read(path), dotnetDispatchSources[path]);
		assert.equal(sha256(source), dotnetDispatchSources[path], path);
		assert.equal(source.toString(), files[dotnetDispatchSnapshot(path)], `${path} snapshot`);
	}
};
