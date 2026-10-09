/**
 * Authenticate the installed JVM Fin dispatch-counter run (VO #1425): its original queue, TAP, end record and
 * both ordinary and reviewed reports, each holding a Java and a Kotlin caller, and the twelve producer
 * sources at 40fa8a8. Paths are checked before any read. The older observed:false JVM evidence is separate
 * and left untouched.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const jvmDispatchArchiveDirectory = "docs/evidence/jvm-fin-dispatch-20261009";
export const jvmDispatchRevision = "40fa8a8339d36b576747ee4029c6e11115b316fd";
const archived = name => `${jvmDispatchArchiveDirectory}/${name}`;
const run = "build/vo1425-jvm-dispatch-40fa8a8";

/** Original producer outputs, relative to the producing checkout, with their posted digests. */
export const jvmDispatchOriginals = Object.freeze({
	"queue.json": { original: `${run}/queue.json`, sha256: "6df41b6337d04dbb36a58dc196dd563359dbbe15493f242922ae13eeeebf4c04" }
	, "run.tap": { original: `${run}/run.tap`, sha256: "73fbca72d5498ac2258a60e901e836fd7223d9c2678cde38387cc0667c4c54a3" }
	, "end.txt": { original: `${run}/end.txt`, sha256: "2549f0ac4a2b4aeec5bf970cbbcfbf49627c6ebaeebaec38adff80e970fce17b" }
	, "jvm.json": { original: `${run}/jvm.json`, sha256: "38642919540fd1e1a124ab0a9d921dc6e543dc05e9e46a6412184119a21e7d23" }
	, "jvm-reviewed.json": { original: `${run}/jvm-reviewed.json`, sha256: "7560fa9a28337aa3743abe177318f7decf8231504e0076d965a75fcd999caebb" }
});
/** The twelve producer sources the queue pinned. */
export const jvmDispatchSources = Object.freeze({
	"tests/jvm-fin.test.mjs": "fbeb8f84f2f99308cca0a27f1b5f2d0c6a1d0ee5748a85f637831b3fb2903d72"
	, "tests/helpers/native-fin-dispatch-gdb-extracted.mjs": "6647ea82c4fb21408474947032fbf77a025fa0380de0803fa05eda40df64166f"
	, "tests/helpers/native-fin-dispatch-gdb-run.mjs": "edbbfc38de53667bbd09b435ee5d1c73fdf9ce247625f139abe2dcf4b10c4690"
	, "tests/helpers/native-fin-dispatch-gdb.mjs": "71905e87090421e3346652b49ef2a35528e96568e605b84c5e8649a1dd773792"
	, "tests/helpers/native-fin-dispatch.mjs": "e1b7105b020665d1ff624baa09f0ab62101b3a3eaba5d9f79cc56895105fb0bc"
	, "tests/helpers/copied-fixture-install.mjs": "4b7065d87cfc18be27bdf9a78a8ed1f207b30c528dcd00a44b077e4d21de4227"
	, "src/backends/jvm/verified-assets.mjs": "ed24535082694443ccbfeca08a5bb82fe7125a1b15ec1f0e2eacb8acd24d5eae"
	, "src/backends/jvm/copied-assets.mjs": "93e97eb16ae6970e51ef78d3fd16b6db408b90e9c3affdd06121d8e97faf7750"
	, "src/backends/jvm/copied-runtime.mjs": "21aa41d1087ea4fe83e2b7a620f58eb893add37cce7fe11f6fa04d500cd047c9"
	, "src/backends/jvm/copied-values.mjs": "b4ab3f1bc62f8d1a16abc768e7abcc3c9e2ae6dd768904891f658128f0318fab"
	, "src/backends/jvm/copied-model.mjs": "d586a7a26f856377bcdb68cded3b64793ebb3c628112c6a693bd8c863515c246"
	, "src/build/native-component.mjs": "2798e4cad749111193445a470704201c350819241a293a155c4baff59f135867"
});

/**
 * Where an archived producer source lives.
 *
 * @param path - Repository-relative source path.
 */
export const jvmDispatchSnapshot = path => archived(`sources/40fa8a8/${path}.txt`);

/** The archive's exact path set besides its receipt. */
export const jvmDispatchArchivePaths = Object.freeze([...Object.keys(jvmDispatchOriginals).map(archived), ...Object.keys(jvmDispatchSources).map(jvmDispatchSnapshot)]);

/** Lean source entries for mirror, impossible and label, then the native-fin@1.0.0 adapters in the same order. */
export const jvmDispatchColumns = Object.freeze([
	"l_NativeFin_mirror"
	, "l_NativeFin_impossible"
	, "l_NativeFin_label"
	, "lb_b703515a10173a97c2e27e46"
	, "lb_1d7e0c72a4d6e1cde32466e4"
	, "lb_9afacce322a81504ba9eb75b"
]);
const component = "libcomponent_3f006a55a2dafabb9196.so";
/** The single verified definition of each column, as nm listed it and GDB armed it, in column order. */
export const jvmDispatchOffsets = Object.freeze(["0x23f0", "0x22f0", "0x2780", "0x2bd0", "0x29b0", "0x2a40"]);
/** Every library the JAR extracts, with the content digest GDB required of each mapped image. */
export const jvmDispatchLibraries = Object.freeze({
	[component]: "1dc7c7fefd12e9b23c58a55d588a03213594055c6f27c501eca3fbff0d3de420"
	, "liblean_bridge_native.so": "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7"
	, "libleanshared.so": "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"
	, "libnative_fin.so": "a969da07861f6e1074a6b994808e8132ecfa2e05268aa175a076b72fc01c4a9b"
});
const zero = [0, 0, 0, 0, 0, 0], one = [1, 0, 1, 1, 0, 1];
/** The exact cumulative rows observed for both callers on both routes. */
export const jvmDispatchRows = Object.freeze([
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
/** Each caller's own probe, route, positive control and check count. */
export const jvmDispatchCallers = Object.freeze({
	java: { name: "Java", checks: 2023, probeSha256: "2e2bbb1c6398ad4cc597ec43baa8bbef156e733eb170774f91ea07cf24344a02" }
	, kotlin: { name: "Kotlin", checks: 2022, probeSha256: "4a81a3c84ba3f21d60dd9588856731645ed562039a6471e34664c665c0e5beb2" }
});
const routes = name => [`public ${name} calls of org.leanbridge.native_fin.Api.mirror, .impossible and .label through the verified extracting RTLD_DEEPBIND JAR loader and FFM downcalls into the bundled C adapter`];
const positiveControl = name => `valid public ${name} calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column`;
const loadTrigger = "Api.only(0) == 7: a public call outside the six counted columns, after a record with nothing armed and no entries, and before a record with all six armed in one verified extraction root and still no entries";
const instrumentation = "in-memory int3 breakpoints at each verified definition in one hashed extraction root below a fresh run-owned java.io.tmpdir; deployed files and the production loader are unchanged";
const gdb = Object.freeze({ sha256: "762f9d48202dd341e170d8302543f35622417b4e39bfce9a270d06943702e754", version: "GNU gdb (Debian 13.1-3) 13.1" });
export const jvmDispatchTests = Object.freeze([
	"GDB entry breakpoints count a deep-bound extracting JVM stand-in from Java and Kotlin and refuse every other root, image or record"
	, "JVM packages are checked Fin consumers beside C, C++, Python, Rust, Ruby and .NET"
	, "generated JVM bound docs come only from checked refinement metadata"
	, "relocated source-free JVM packages check Fin bounds from Java and Kotlin through the bundled C adapter"
	, "independently reviewed Jvm packages check scalar Fin through installed consumers"
]);

/**
 * The extracted-root GDB identity digest, recomputed from the report's own columns, hashed libraries and definers.
 *
 * @param dispatch - One report's dispatch record.
 */
export const jvmDispatchConfig = dispatch => sha256(canonicalJson({
	schemaVersion: 1
	, platform: "x86_64-linux-gnu"
	, instrument: "gdb-breakpoints-extracted-root"
	, componentId: "native-fin@1.0.0"
	, columns: dispatch.columns
	, libraries: Object.keys(dispatch.libraries).sort()
	, hashes: dispatch.libraries
	, definers: dispatch.definers
}));

/**
 * Recount rows independently of the pinned table: each rejected step changes no column, each successful step
 * enters exactly its own source and adapter once, and the Fin 0 columns never move.
 *
 * @param observed - Recorded rows.
 */
export const assertJvmDispatchDeltas = observed => {
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
export const assertJvmDispatchRows = observed => {
	assert.deepEqual(observed, jvmDispatchRows);
	assertJvmDispatchDeltas(observed);
};

/**
 * Validate one installed report, ordinary or reviewed, with its Java and Kotlin callers.
 *
 * @param text - Original report text.
 * @param path - Expected source path.
 * @param scriptSha256 - Digest of the extracted-root GDB script text in the archived producer helper.
 */
export const assertJvmDispatchReport = (text, path, scriptSha256) => {
	const report = JSON.parse(text);
	assert.deepEqual(Object.keys(report), ["archives", "reports", "reproducible", "schemaVersion"]);
	assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
	assert.deepEqual(Object.keys(report.archives).sort(), ["archives/native-fin-1.0.0-c.tar.gz", "archives/native-fin-1.0.0.jar", "archives/native-fin-1.0.0.pom"]);
	assert.deepEqual(report.reports.map(item => item.profile), ["java", "kotlin"]);
	const keys = ["bindingIrSha256", "checks", "compilerFreePath", "consumerSha256", "dispatch", "modelSha256", "offlineInstall", "packages", "path", "profile", "receiptSha256", "relocatedInstallation", "repeatExecution", "sharedNativeLibraries", "sourceRemovedBeforeInstallation", "sourceTreeSha256"];
	for(const item of report.reports)
	{
		const caller = jvmDispatchCallers[item.profile];
		assert.deepEqual(Object.keys(item).sort(), [...keys, ...path === "reviewed-ir" ? ["reviewedSourceSha256"] : []].sort(), item.profile);
		assert.equal(item.path, path); assert.equal(item.checks, caller.checks, item.profile);
		for(const flag of ["sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution", "offlineInstall", "compilerFreePath"]) assert.equal(item[flag], true, flag);
		assert.deepEqual(item.packages.map(pkg => [pkg.name, pkg.version, pkg.target, pkg.role, pkg.artifacts.map(artifact => artifact.path)]), [["org.leanbridge:native-fin", "1.0.0", "maven", "component", ["archives/native-fin-1.0.0.jar", "archives/native-fin-1.0.0.pom"]]]);
		assert.equal(item.packages[0].artifacts[0].sha256, report.archives["archives/native-fin-1.0.0.jar"]);
		assert.deepEqual(item.sharedNativeLibraries, jvmDispatchLibraries);
		const dispatch = item.dispatch;
		assert.deepEqual(Object.keys(dispatch).sort(), ["breakpoints", "columns", "configSha256", "definers", "gdb", "instrument", "instrumentation", "libraries", "loadTrigger", "observed", "positiveControl", "probeSha256", "routes", "scope", "scriptSha256"]);
		assert.deepEqual(dispatch.columns, jvmDispatchColumns); assert.equal(dispatch.instrument, "gdb-breakpoints-extracted-root"); assert.equal(dispatch.instrumentation, instrumentation);
		assert.deepEqual(dispatch.routes, routes(caller.name)); assert.equal(dispatch.positiveControl, positiveControl(caller.name)); assert.equal(dispatch.loadTrigger, loadTrigger);
		assert.equal(dispatch.scope, "x86_64 Linux with GDB and ptrace; one cold process per caller");
		assert.equal(dispatch.probeSha256, caller.probeSha256); assert.equal(dispatch.scriptSha256, scriptSha256);
		assert.deepEqual(dispatch.gdb, gdb);
		// Every column has one verified definer among the hashed images, at its pinned nm offset, under the recomputed identity.
		assert.deepEqual(dispatch.libraries, jvmDispatchLibraries);
		assert.deepEqual(dispatch.definers, Array(6).fill(component));
		assert.deepEqual(dispatch.breakpoints, jvmDispatchColumns.map((symbol, k) => ({ library: component, offset: jvmDispatchOffsets[k], symbol })));
		assert.equal(dispatch.configSha256, jvmDispatchConfig(dispatch));
		assertJvmDispatchRows(dispatch.observed);
	}
	assert.notEqual(report.reports[0].consumerSha256, report.reports[1].consumerSha256, "each caller has its own consumer");
	return report.reports;
};

/**
 * Validate the original queue, TAP and end record.
 *
 * @param files - Archived run records.
 * @param files.queue - Original queue text.
 * @param files.tap - Original TAP text.
 * @param files.end - Original end record.
 */
export const assertJvmDispatchRun = ({ queue, tap, end }) => {
	const record = JSON.parse(queue);
	assert.equal(record.node, 1425); assert.equal(record.revision, jvmDispatchRevision); assert.equal(record.go, "board 2240");
	assert.equal(record.selection, "tests/jvm-fin.test.mjs (all five tests: the gated stand-in controls, two ungated unit tests and both gated installed routes, each with Java and Kotlin callers)");
	assert.equal(record.command, "env -u FORCE_COLOR NO_COLOR=1 LEAN_BRIDGE_JVM_FIN_TEST=1 LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 taskset -c 3 node --test --test-concurrency=1 --test-reporter=tap tests/jvm-fin.test.mjs");
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.environment, { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_JVM_FIN_TEST: "1", LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36", LEAN_BRIDGE_JAVA: "(unset: .toolchains/jdk22/bin/java)", LEAN_BRIDGE_JAVAC: "(unset: .toolchains/jdk22/bin/javac)", LEAN_BRIDGE_KOTLINC: "(unset: .toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc)", LEAN_BRIDGE_GDB: "(unset: /usr/bin/gdb)", TMPDIR: "(unset: /tmp)" });
	assert.deepEqual(record.sources, jvmDispatchSources);
	assert.deepEqual(Object.keys(record.versions), ["node", "lean", "java", "javaSha256", "javac", "kotlinc", "maven", "glibc", "gdb", "gdbSha256", "ptraceScope", "cc", "nm", "readelf"]);
	assert.match(record.versions.java, /^openjdk version "22\.0\.2" /u); assert.equal(record.versions.javac, "javac 22.0.2");
	// The original Kotlin capture ran on the shell's default JRE; the acceptance compiled with JDK 22.
	assert.equal(record.versions.kotlinc, "info: kotlinc-jvm 2.2.0 (JRE 21.0.12.1+1-LTS)");
	assert.match(record.versions.glibc, / 2\.36$/u); assert.equal(record.versions.gdb, gdb.version); assert.equal(record.versions.gdbSha256, gdb.sha256);
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), jvmDispatchTests.map((name, index) => ["ok", String(index + 1), name]));
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["5"]);
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	for(const caller of Object.keys(jvmDispatchCallers))
		assert.equal(tap.split(`# per-step source and adapter counts from ${caller} in a relocated cold JVM under GDB entry breakpoints\n`).length, 3, `${caller} counted on both routes`);
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], `TAP ${key}`);
	const ended = /^end=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ exit=(\d+) minFree=(\d+)M\n$/u.exec(end);
	assert.ok(ended, "end record"); assert.equal(ended[1], "0", "exit 0"); assert.ok(Number(ended[2]) >= 1024, "free-space floor");
};

/** Lines of the producer test that make each probe gate on nothing armed, trigger once and refuse an uncovered root. */
const probeLines = Object.freeze([
	"        if (!ours(before) || !quiet(before, 0))"
	, "        try { return Api.only(BigInteger.ZERO).equals(BigInteger.valueOf(7)); }"
	, "        if (!ours(after) || !quiet(after, 0x3f) || !covered(after))"
	, "    if (!ours(before) || !quiet(before!!, 0L))"
	, "private fun trigger(): Boolean = try { Api.only(BigInteger.ZERO) == BigInteger.valueOf(7) }"
	, "    if (!ours(after) || !quiet(after!!, 0x3fL) || !covered(after))"
]);
/** Lines of the installed acceptance that refuse another JAR, a missing debugger, inexact rows and another parent. */
const acceptanceLines = Object.freeze([
	"\n\t\tassert.equal(model.component.id, \"native-fin@1.0.0\");"
	, "\n\t\t\tassert.equal(sha256(await readFile(installedJar)), jarArtifact.sha256);"
	, "\n\t\t\tassert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, \"\"); assert.equal(missing.stderr, unattached);"
	, "\n\t\t\tassert.deepEqual(observed, jvmFinDispatchExpected);"
	, "\n\t\t\tconst { breakpoints } = await assertExtractedNativeFinGdbRun(observer, accepted, observed);"
	, "const standInSkip = process.env.LEAN_BRIDGE_JVM_FIN_TEST === \"1\" ? false : standInMissing;"
	, "`-Djava.io.tmpdir=${tmpdir}`"
]);
/** Lines of the extracted-root helper that bind the record, one root under the run's parent, image hashes, offsets and poison. */
const helperLines = Object.freeze([
	"\tassert.deepEqual([mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [0x3f, 0, 0, [1, 1, 1, 1, 1, 1]]);"
	, "\tassert.equal(mapped.pid, manifest.pid, \"the record belongs to the instrumented inferior\");"
	, "\tassert.equal(dirname(manifest.root), parent);"
	, "\tfor(const name of identity.libraries) assert.equal(manifest.images[name].sha256, identity.hashes[name], name);"
	, "\t\tassert.equal(offset, Number.parseInt(line.trim().split(\" \")[0], 16), symbol);"
	, "if not fresh(parent):"
	, "        return poison(\"a second extraction root \" + root + \" beside \" + state[\"root\"])"
	, "        return poison(name + \" loaded again after arming from \" + path)"
]);

/**
 * Both probes gate on the explicit trigger, the installed acceptance refuses unverified runs, the extracted-root
 * helper binds one hashed root and poisons any other, and the named tests are the ones the TAP passed.
 *
 * @param source - Archived producer test source.
 * @param helper - Archived extracted-root GDB helper.
 */
export const assertJvmDispatchTestSource = (source, helper) => {
	for(const line of [...probeLines, ...acceptanceLines]) assert.equal(source.split(line).length, 2, line);
	for(const line of helperLines) assert.equal(helper.split(line).length, 2, line);
	for(const name of jvmDispatchTests) assert.equal(source.split(`test(${JSON.stringify(name)}`).length, 2, name);
};

/**
 * The digest of the extracted-root GDB script text inside the archived helper.
 *
 * @param helper - Archived native-fin-dispatch-gdb-extracted.mjs source.
 */
export const jvmDispatchScriptSha256 = helper => {
	const marker = "export const nativeFinGdbExtractedScript = String.raw`", start = helper.indexOf(marker);
	assert.ok(start >= 0 && helper.indexOf(marker, start + 1) < 0, "one extracted-root GDB script");
	const end = helper.indexOf("\n`;\n", start);
	assert.ok(end > start, "the GDB script ends");
	return sha256(helper.slice(start + marker.length, end + 1));
};

/**
 * The receipt's fixed statement of scope; artifacts come from the archived bytes.
 *
 * @param artifacts - Archived file references.
 */
export const jvmDispatchReceipt = artifacts => ({
	schemaVersion: 1
	, planNode: 1425
	, execution: "local"
	, revision: jvmDispatchRevision
	, sources: jvmDispatchSources
	, scope: {
		host: "JVM (java, kotlin) installed Maven JAR consumed by separately compiled Java and Kotlin probes, ordinary source and independently reviewed IR"
		, counter: "GDB address breakpoints in each cold probe process for component native-fin@1.0.0, three Lean source entries and three C adapters, each at its single nm definition in one hashed extraction root below a fresh run-owned java.io.tmpdir"
		, routes: [...routes("Java"), ...routes("Kotlin")]
		, loadTrigger
		, missingCounter: "each gated run first requires each probe to refuse a process without GDB; the probe refuses anything armed before its trigger and an uncovered root after it, and GDB poisons any second root, other image, symlink or later configured load"
		, environment: "Local OpenJDK 22.0.2 runtime and javac, Kotlin 2.2.0 compiling with JAVA_HOME at that JDK 22 (the original version capture ran on the default JRE 21.0.12), GNU gdb 13.1 with Yama ptrace_scope 0 and a glibc 2.36 package floor on x86_64 Linux; no other runtime, compiler, debugger, ptrace policy or glibc floor is established"
		, otherHosts: false
		, hostedCi: false
		, olderEvidence: "Earlier JVM Fin evidence, including its observed:false dispatch records, is unchanged; this is a separately dated measurement"
	}
	, artifacts
	, remaining: ["Inventory promotion and source history belong to main.", "Hosted CI counts need the integrated source and the separate GDB wiring.", "Perl scalar relocation needs fresh hosted acceptance."]
});

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeJvmDispatchArtifact = async (path, bytes) => {
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
export const assertJvmDispatchArchive = async (receipt, read, { currentSources = true } = {}) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...jvmDispatchArchivePaths].sort(), "the exact archive path set");
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt, jvmDispatchReceipt(receipt.artifacts));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path] = bytes.toString();
	}
	for(const [name, file] of Object.entries(jvmDispatchOriginals))
	{
		const artifact = receipt.artifacts.find(item => item.path === archived(name));
		assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
	}
	for(const [path, digest] of Object.entries(jvmDispatchSources))
	{
		const artifact = receipt.artifacts.find(item => item.path === jvmDispatchSnapshot(path));
		assert.equal(artifact.originalPath, `git:${jvmDispatchRevision}:${path}`); assert.equal(artifact.sha256, digest, path);
	}
	assertJvmDispatchRun({ queue: files[archived("queue.json")], tap: files[archived("run.tap")], end: files[archived("end.txt")] });
	const scriptSha256 = jvmDispatchScriptSha256(files[jvmDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb-extracted.mjs")]);
	const ordinary = assertJvmDispatchReport(files[archived("jvm.json")], "ordinary-source", scriptSha256);
	const reviewed = assertJvmDispatchReport(files[archived("jvm-reviewed.json")], "reviewed-ir", scriptSha256);
	for(const [index, item] of ordinary.entries()) assert.deepEqual(reviewed[index].dispatch, item.dispatch, `${item.profile}: the same counters in both routes`);
	assertJvmDispatchTestSource(files[jvmDispatchSnapshot("tests/jvm-fin.test.mjs")], files[jvmDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb-extracted.mjs")]);
	for(const path of currentSources ? Object.keys(jvmDispatchSources) : [])
	{
		const source = beforeFinRefinementSource(path, await read(path), jvmDispatchSources[path]);
		assert.equal(sha256(source), jvmDispatchSources[path], path);
		assert.equal(source.toString(), files[jvmDispatchSnapshot(path)], `${path} snapshot`);
	}
};
