/**
 * Keep the archived installed JVM Fin dispatch-counter run (VO #1425) tied to its producer sources, its five
 * passing tests, the explicit uncounted load trigger, one hashed extraction root, both installed routes with
 * separate Java and Kotlin callers, the six verified definition offsets and the exact per-step counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import "./helpers/jvm-dispatch-integration-source-history-tests.mjs";
import { sha256 } from "../src/capsule/node.mjs";
import { assertJvmDispatchArchive, assertJvmDispatchDeltas, assertJvmDispatchReport, assertJvmDispatchRows, assertJvmDispatchRun, assertJvmDispatchTestSource, jvmDispatchArchiveDirectory, jvmDispatchArchivePaths, jvmDispatchRows, jvmDispatchScriptSha256, jvmDispatchSnapshot, jvmDispatchSources, jvmDispatchTests, writeJvmDispatchArtifact } from "./helpers/jvm-fin-dispatch-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${jvmDispatchArchiveDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "6219484380f4326792e919340188f818fb96de958ff19624e6cad9494e6707db");
	return JSON.parse(bytes);
};
const text = name => readFile(`${jvmDispatchArchiveDirectory}/${name}`, "utf8");
const helperPath = "tests/helpers/native-fin-dispatch-gdb-extracted.mjs";
const script = async () => jvmDispatchScriptSha256(await readFile(jvmDispatchSnapshot(helperPath), "utf8"));

test("the JVM dispatch archive authenticates its run, reports and producer sources from its own paths", async () => {
	const record = await receipt(), observed = [];
	await assertJvmDispatchArchive(record, path => {
		observed.push(path);
		return readFile(path);
	}, { currentSources: false });
	assert.deepEqual([...new Set(observed)].sort(), [...jvmDispatchArchivePaths].sort());
	assert.deepEqual([record.scope.otherHosts, record.scope.hostedCi], [false, false]);
});

test("the current JVM producer sources reach their exact dispatch-run digests", async () => {
	const observed = [];
	await assertJvmDispatchArchive(await receipt(), path => {
		observed.push(path);
		return readFile(path);
	});
	assert.deepEqual([...new Set(observed)].sort(), [...jvmDispatchArchivePaths, ...Object.keys(jvmDispatchSources)].sort());
});

test("the JVM dispatch run records refuse a skipped, failed, renumbered, unplanned or nonzero run and another producer", async () => {
	const files = { queue: await text("queue.json"), tap: await text("run.tap"), end: await text("end.txt") };
	assertJvmDispatchRun(files);
	const queue = change => {
		const copy = JSON.parse(files.queue);
		change(copy);
		return { ...files, queue: JSON.stringify(copy) };
	};
	const gated = jvmDispatchTests.at(-1), kotlin = "# per-step source and adapter counts from kotlin in a relocated cold JVM under GDB entry breakpoints\n";
	const refused = {
		"skipped": { ...files, tap: files.tap.replace(`ok 5 - ${gated}`, `ok 5 - ${gated} # SKIP`).replace("# pass 5", "# pass 4").replace("# skipped 0", "# skipped 1") }
		, "stand-in skipped": { ...files, tap: files.tap.replace(`ok 1 - ${jvmDispatchTests[0]}`, `ok 1 - ${jvmDispatchTests[0]} # SKIP`) }
		, "failed": { ...files, tap: files.tap.replace("ok 4 -", "not ok 4 -").replace("# pass 5", "# pass 4").replace("# fail 0", "# fail 1") }
		, "renumbered": { ...files, tap: files.tap.replace("ok 5 -", "ok 6 -") }
		, "dropped": { ...files, tap: files.tap.replace(`ok 5 - ${gated}\n`, "").replace("1..5", "1..4") }
		, "second plan": { ...files, tap: files.tap.replace("1..5\n", "1..5\n1..5\n") }
		, "other test": { ...files, tap: files.tap.replace(`ok 5 - ${gated}`, `ok 5 - ${jvmDispatchTests[1]}`) }
		, "Kotlin uncounted on one route": { ...files, tap: files.tap.replace(kotlin, "") }
		, "nonzero exit": { ...files, end: files.end.replace("exit=0", "exit=1") }
		, "floor breached": { ...files, end: files.end.replace(/minFree=\d+M/u, "minFree=900M") }
		, "other revision": queue(copy => { copy.revision = "0".repeat(40); })
		, "no GO": queue(copy => { delete copy.go; })
		, "other selection": queue(copy => { copy.selection = "tests/jvm-fin.test.mjs"; })
		, "gate off": queue(copy => { copy.environment.LEAN_BRIDGE_JVM_FIN_TEST = "0"; })
		, "other glibc floor": queue(copy => { copy.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; })
		, "other debugger": queue(copy => { copy.environment.LEAN_BRIDGE_GDB = "/usr/local/bin/gdb"; })
		, "other Kotlin compiler": queue(copy => { copy.environment.LEAN_BRIDGE_KOTLINC = "/usr/bin/kotlinc"; })
		, "other CPU": queue(copy => { copy.cpu = "taskset -c 2"; })
		, "changed test source": queue(copy => { copy.sources["tests/jvm-fin.test.mjs"] = "0".repeat(64); })
		, "changed extracted-root helper": queue(copy => { copy.sources[helperPath] = "0".repeat(64); })
		, "dropped source": queue(copy => { delete copy.sources["src/backends/jvm/verified-assets.mjs"]; })
		, "other Java": queue(copy => { copy.versions.java = "openjdk version \"21.0.4\" 2024-07-16"; })
		, "rewritten Kotlin capture": queue(copy => { copy.versions.kotlinc = "info: kotlinc-jvm 2.2.0 (JRE 22.0.2)"; })
		, "other gdb": queue(copy => { copy.versions.gdb = "GNU gdb (GDB) 15.1"; })
		, "other gdb bytes": queue(copy => { copy.versions.gdbSha256 = "0".repeat(64); })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertJvmDispatchRun(changed), assert.AssertionError, label);
});

test("both JVM reports keep each caller, route, isolation flags, trigger, verified offsets and exact per-step counts", async () => {
	const ordinary = await text("jvm.json"), reviewed = await text("jvm-reviewed.json"), scriptSha256 = await script();
	assertJvmDispatchReport(ordinary, "ordinary-source", scriptSha256);
	assertJvmDispatchReport(reviewed, "reviewed-ir", scriptSha256);
	assert.throws(() => assertJvmDispatchReport(ordinary, "reviewed-ir", scriptSha256), assert.AssertionError, "route swapped");
	assert.throws(() => assertJvmDispatchReport(ordinary, "ordinary-source", "0".repeat(64)), assert.AssertionError, "another GDB script");
	const report = (change, index = 0) => {
		const copy = JSON.parse(ordinary);
		change(copy.reports[index], copy);
		return JSON.stringify(copy);
	};
	const refused = {
		"reviewed digest on ordinary": report(item => { item.reviewedSourceSha256 = "0".repeat(64); })
		, "source kept": report(item => { item.sourceRemovedBeforeInstallation = false; })
		, "not relocated": report(item => { item.relocatedInstallation = false; }, 1)
		, "single execution": report(item => { item.repeatExecution = false; })
		, "online install": report(item => { item.offlineInstall = false; })
		, "compiler on the path": report(item => { item.compilerFreePath = false; }, 1)
		, "fewer Java checks": report(item => { item.checks = 2022; })
		, "fewer Kotlin checks": report(item => { item.checks = 2021; }, 1)
		, "Kotlin dropped": report((item, copy) => { copy.reports.pop(); })
		, "callers swapped": report((item, copy) => { copy.reports.reverse(); })
		, "shared consumer": report((item, copy) => { copy.reports[1].consumerSha256 = item.consumerSha256; })
		, "other package": report(item => { item.packages[0].name = "org.leanbridge:other"; })
		, "jar mismatch": report(item => { item.packages[0].artifacts[0].sha256 = "0".repeat(64); })
		, "shared library mismatch": report(item => { item.sharedNativeLibraries["libnative_fin.so"] = "0".repeat(64); })
		, "extra archive": report((item, copy) => { copy.archives["archives/extra.zip"] = "0".repeat(64); })
		, "not reproducible": report((item, copy) => { copy.reproducible = false; })
		, "older unobserved dispatch": report(item => { item.dispatch = { observed: false, reason: "the JVM loads extracted native libraries privately; identity with the instrumented C adapter is asserted instead" }; })
		, "strict-root instrument": report(item => { item.dispatch.instrument = "gdb-breakpoints"; })
		, "trigger wording": report(item => { item.dispatch.loadTrigger = "first call"; }, 1)
		, "trigger removed": report(item => { delete item.dispatch.loadTrigger; })
		, "Java probe for Kotlin": report((item, copy) => { copy.reports[1].dispatch.probeSha256 = item.dispatch.probeSha256; })
		, "Java route for Kotlin": report((item, copy) => { copy.reports[1].dispatch.routes = item.dispatch.routes; })
		, "config digest": report(item => { item.dispatch.configSha256 = "0".repeat(64); })
		, "unhashed library": report(item => { item.dispatch.libraries["libleanshared.so"] = "0".repeat(64); })
		, "extra library": report(item => { item.dispatch.libraries["libextra.so"] = "0".repeat(64); })
		, "other gdb": report(item => { item.dispatch.gdb.version = "GNU gdb (GDB) 15.1"; })
		, "wider scope": report(item => { item.dispatch.scope = "any platform"; })
		, "WIT adapter columns": report(item => { item.dispatch.columns.splice(3, 3, "lb_b59f358d1c9475f24bd43985", "lb_5597f18ac5ddcf489aa03c3d", "lb_97e49b166fad657a61e68249"); })
		, "other definer": report(item => { item.dispatch.definers[4] = "libnative_fin.so"; item.dispatch.breakpoints[4].library = "libnative_fin.so"; })
		, "moved Fin 0 adapter": report(item => { item.dispatch.breakpoints[4].offset = "0x29c0"; }, 1)
		, "dropped breakpoint": report(item => { item.dispatch.breakpoints.pop(); })
		, "extra dispatch key": report(item => { item.dispatch.root = "/tmp/lean-bridge-jvm-1"; })
		, "dropped step": report(item => { item.dispatch.observed.splice(3, 1); }, 1)
		, "other status": report(item => { item.dispatch.observed[5][1] = "ok:7"; })
		, "changed count": report(item => { item.dispatch.observed[11][2][0] = 3; }, 1)
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertJvmDispatchReport(changed, "ordinary-source", scriptSha256), assert.AssertionError, label);
});

test("the JVM row recount refuses counts from a rejected call, a Fin 0 entry or a missed adapter", () => {
	assertJvmDispatchRows(structuredClone(jvmDispatchRows));
	// The pinned rows share counter arrays; give every row its own so a mutant changes only the rows it names.
	const rows = change => {
		const copy = jvmDispatchRows.map(([step, status, counts]) => [step, status, [...counts]]);
		change(copy);
		assert.deepEqual(copy[0], ["start", "ok", [0, 0, 0, 0, 0, 0]], "start is unchanged");
		return copy;
	};
	for(const [step, changed] of [
		["invalid-mirror-huge", rows(copy => { for(const row of copy.slice(2)) row[2][0]++; })]
		, ["invalid-impossible-zero", rows(copy => { for(const row of copy.slice(3)) row[2][1]++; })]
		, ["valid-mirror", rows(copy => { for(const row of copy.slice(5)) row[2][3]--; })]
	])
		assert.throws(() => assertJvmDispatchDeltas(changed), error => error instanceof assert.AssertionError && error.message.split("\n")[0] === step, step);
});

test("the JVM producer test and extracted-root helper must keep both gates, single triggers, root binding, refusals and exact rows", async () => {
	const source = await readFile(jvmDispatchSnapshot("tests/jvm-fin.test.mjs"), "utf8");
	const helper = await readFile(jvmDispatchSnapshot(helperPath), "utf8");
	assertJvmDispatchTestSource(source, helper);
	for(const [label, from, to] of [
		["Java armed before the trigger admitted", "        if (!ours(before) || !quiet(before, 0))", "        if (!ours(before))"]
		, ["Java trigger changed", "        try { return Api.only(BigInteger.ZERO).equals(BigInteger.valueOf(7)); }", "        try { return Api.mirror(BigInteger.ZERO) != null; }"]
		, ["Java uncovered root admitted", "        if (!ours(after) || !quiet(after, 0x3f) || !covered(after))", "        if (!ours(after))"]
		, ["Kotlin armed before the trigger admitted", "    if (!ours(before) || !quiet(before!!, 0L))", "    if (!ours(before))"]
		, ["Kotlin trigger changed", "private fun trigger(): Boolean = try { Api.only(BigInteger.ZERO) == BigInteger.valueOf(7) }", "private fun trigger(): Boolean = try { true }"]
		, ["Kotlin uncovered root admitted", "    if (!ours(after) || !quiet(after!!, 0x3fL) || !covered(after))", "    if (!ours(after))"]
		, ["component unchecked", "\n\t\tassert.equal(model.component.id, \"native-fin@1.0.0\");", "\n"]
		, ["installed JAR unchecked", "\n\t\t\tassert.equal(sha256(await readFile(installedJar)), jarArtifact.sha256);", "\n"]
		, ["missing debugger admitted", "\n\t\t\tassert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, \"\"); assert.equal(missing.stderr, unattached);", "\n"]
		, ["rows unchecked", "\n\t\t\tassert.deepEqual(observed, jvmFinDispatchExpected);", "\n"]
		, ["root unchecked", "\n\t\t\tconst { breakpoints } = await assertExtractedNativeFinGdbRun(observer, accepted, observed);", "\n\t\t\tconst breakpoints = [];"]
		, ["stand-in skippable when gated", "const standInSkip = process.env.LEAN_BRIDGE_JVM_FIN_TEST === \"1\" ? false : standInMissing;", "const standInSkip = standInMissing;"]
		, ["temporary directory not owned", "`-Djava.io.tmpdir=${tmpdir}`", "\"-Djava.io.tmpdir=/tmp\""]
		, ["test renamed", `test(${JSON.stringify(jvmDispatchTests.at(-1))}`, "test(\"reviewed packages\""]
	])
		assert.throws(() => assertJvmDispatchTestSource(source.replace(from, to), helper), assert.AssertionError, label);
	for(const [label, from, to] of [
		["armed mask unchecked", "[mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [0x3f, 0, 0, [1, 1, 1, 1, 1, 1]]", "[mapped.armed], [mapped.armed]"]
		, ["PID unchecked", "\tassert.equal(mapped.pid, manifest.pid, \"the record belongs to the instrumented inferior\");", ""]
		, ["root outside the parent admitted", "\tassert.equal(dirname(manifest.root), parent);", ""]
		, ["image hashes unchecked", "\tfor(const name of identity.libraries) assert.equal(manifest.images[name].sha256, identity.hashes[name], name);", ""]
		, ["offset unchecked", "\t\tassert.equal(offset, Number.parseInt(line.trim().split(\" \")[0], 16), symbol);", ""]
		, ["stale parent admitted", "if not fresh(parent):", "if False:"]
		, ["second root admitted", "        return poison(\"a second extraction root \" + root + \" beside \" + state[\"root\"])", "        pass"]
		, ["rearm admitted", "        return poison(name + \" loaded again after arming from \" + path)", "        return"]
	])
		assert.throws(() => assertJvmDispatchTestSource(source, helper.replace(from, to)), assert.AssertionError, label);
});

test("the archived extracted-root GDB script digest is the reports' and changes with any script byte", async () => {
	const helper = await readFile(jvmDispatchSnapshot(helperPath), "utf8");
	const digest = jvmDispatchScriptSha256(helper);
	assert.equal(digest, JSON.parse(await text("jvm.json")).reports[1].dispatch.scriptSha256);
	assert.notEqual(jvmDispatchScriptSha256(helper.replace("handle all nostop noprint pass", "handle all stop print pass")), digest);
	assert.throws(() => jvmDispatchScriptSha256(helper.replace("export const nativeFinGdbExtractedScript = String.raw`", "export const otherScript = String.raw`")), assert.AssertionError);
});

test("the JVM dispatch receipt refuses overclaims, unknown paths before reading and changed source bytes", async () => {
	const record = await receipt();
	const mutations = {
		"other hosts": changed => { changed.scope.otherHosts = true; }
		, "hosted": changed => { changed.scope.hostedCi = true; }
		, "older evidence": changed => { changed.scope.olderEvidence = "superseded"; }
		, "Kotlin capture hidden": changed => { changed.scope.environment = changed.scope.environment.replace(" (the original version capture ran on the default JRE 21.0.12)", ""); }
		, "one caller": changed => { changed.scope.routes.pop(); }
		, "trigger dropped": changed => { delete changed.scope.loadTrigger; }
		, "remaining dropped": changed => { changed.remaining.pop(); }
		, "revision": changed => { changed.revision = "0".repeat(40); }
		, "artifact digest": changed => { changed.artifacts[0].sha256 = "0".repeat(64); }
		, "artifact provenance": changed => { changed.artifacts[0].originalPath = "build/other.json"; }
		, "artifact size": changed => { changed.artifacts[3].bytes++; }
		, "duplicate path": changed => { changed.artifacts.push(changed.artifacts[0]); }
	};
	for(const [label, mutate] of Object.entries(mutations))
	{
		const changed = structuredClone(record);
		mutate(changed);
		await assert.rejects(() => assertJvmDispatchArchive(changed, path => readFile(path), { currentSources: false }), assert.AssertionError, label);
	}
	for(const path of ["/etc/hostname", `${jvmDispatchArchiveDirectory}/../../../package.json`, `${jvmDispatchArchiveDirectory}/extra.txt`])
	{
		const changed = structuredClone(record);
		changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertJvmDispatchArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, path);
		assert.equal(reads, 0, `${path} reached the reader`);
	}
	// A changed loader byte is not the producer's, even with the archive intact.
	await assert.rejects(() => assertJvmDispatchArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "src/backends/jvm/verified-assets.mjs" ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), error => error instanceof assert.AssertionError && error.message.startsWith("src/backends/jvm/verified-assets.mjs"));
});

test("the JVM dispatch archive writer keeps identical bytes and refuses any differing file or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-dispatch-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeJvmDispatchArtifact(path, Buffer.from("one\n"));
	await writeJvmDispatchArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeJvmDispatchArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
