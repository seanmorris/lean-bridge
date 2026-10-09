/**
 * Keep the archived installed .NET Fin dispatch-counter run (VO #1425) tied to its producer sources, its five
 * passing tests, the explicit uncounted load trigger, both installed routes, the six verified definition
 * offsets and the exact per-step counts.
 *
 * @file
 */
import assert from "node:assert/strict";
import "./helpers/dotnet-dispatch-integration-source-history-tests.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertDotnetDispatchArchive, assertDotnetDispatchDeltas, assertDotnetDispatchReport, assertDotnetDispatchRows, assertDotnetDispatchRun, assertDotnetDispatchTestSource, dotnetDispatchArchiveDirectory, dotnetDispatchArchivePaths, dotnetDispatchRows, dotnetDispatchScriptSha256, dotnetDispatchSnapshot, dotnetDispatchSources, dotnetDispatchTests, writeDotnetDispatchArtifact } from "./helpers/dotnet-fin-dispatch-evidence.mjs";

const receipt = async () => {
	const bytes = await readFile(`${dotnetDispatchArchiveDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "4961f9576c023c6eece18f76c60b5dea3b05ea1c7300c6583d388b8009308252");
	return JSON.parse(bytes);
};
const text = name => readFile(`${dotnetDispatchArchiveDirectory}/${name}`, "utf8");
const script = async () => dotnetDispatchScriptSha256(await readFile(dotnetDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb.mjs"), "utf8"));

test("the .NET dispatch archive authenticates its run, reports and producer sources from its own paths", async () => {
	const record = await receipt(), observed = [];
	await assertDotnetDispatchArchive(record, path => {
		observed.push(path);
		return readFile(path);
	}, { currentSources: false });
	assert.deepEqual([...new Set(observed)].sort(), [...dotnetDispatchArchivePaths].sort());
	assert.deepEqual([record.scope.otherHosts, record.scope.hostedCi], [false, false]);
});

test("the current .NET producer sources reach their exact dispatch-run digests", async () => {
	const observed = [];
	await assertDotnetDispatchArchive(await receipt(), path => {
		observed.push(path);
		return readFile(path);
	});
	assert.deepEqual([...new Set(observed)].sort(), [...dotnetDispatchArchivePaths, ...Object.keys(dotnetDispatchSources)].sort());
});

test("the .NET dispatch run records refuse a skipped, failed, renumbered, unplanned or nonzero run and another producer", async () => {
	const files = { queue: await text("queue.json"), tap: await text("run.tap"), end: await text("end.txt") };
	assertDotnetDispatchRun(files);
	const queue = change => {
		const copy = JSON.parse(files.queue);
		change(copy);
		return { ...files, queue: JSON.stringify(copy) };
	};
	const gated = dotnetDispatchTests.at(-1), counted = "# per-step source and adapter counts in a relocated .NET process under GDB entry breakpoints\n";
	const refused = {
		"skipped": { ...files, tap: files.tap.replace(`ok 5 - ${gated}`, `ok 5 - ${gated} # SKIP`).replace("# pass 5", "# pass 4").replace("# skipped 0", "# skipped 1") }
		, "stand-in skipped": { ...files, tap: files.tap.replace(`ok 3 - ${dotnetDispatchTests[2]}`, `ok 3 - ${dotnetDispatchTests[2]} # SKIP`) }
		, "failed": { ...files, tap: files.tap.replace("ok 4 -", "not ok 4 -").replace("# pass 5", "# pass 4").replace("# fail 0", "# fail 1") }
		, "renumbered": { ...files, tap: files.tap.replace("ok 5 -", "ok 6 -") }
		, "dropped": { ...files, tap: files.tap.replace(`ok 5 - ${gated}\n`, "").replace("1..5", "1..4") }
		, "second plan": { ...files, tap: files.tap.replace("1..5\n", "1..5\n1..5\n") }
		, "other test": { ...files, tap: files.tap.replace(`ok 5 - ${gated}`, `ok 5 - ${dotnetDispatchTests[0]}`) }
		, "one route uncounted": { ...files, tap: files.tap.replace(counted, "") }
		, "nonzero exit": { ...files, end: files.end.replace("exit=0", "exit=1") }
		, "floor breached": { ...files, end: files.end.replace(/minFree=\d+M/u, "minFree=900M") }
		, "other revision": queue(copy => { copy.revision = "0".repeat(40); })
		, "no GO": queue(copy => { delete copy.go; })
		, "other selection": queue(copy => { copy.selection = "tests/dotnet-fin.test.mjs"; })
		, "gate off": queue(copy => { copy.environment.LEAN_BRIDGE_DOTNET_FIN_TEST = "0"; })
		, "other glibc floor": queue(copy => { copy.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; })
		, "other debugger": queue(copy => { copy.environment.LEAN_BRIDGE_GDB = "/usr/local/bin/gdb"; })
		, "other CPU": queue(copy => { copy.cpu = "taskset -c 2"; })
		, "changed test source": queue(copy => { copy.sources["tests/dotnet-fin.test.mjs"] = "0".repeat(64); })
		, "changed run helper": queue(copy => { copy.sources["tests/helpers/native-fin-dispatch-gdb-run.mjs"] = "0".repeat(64); })
		, "dropped source": queue(copy => { delete copy.sources["src/backends/dotnet/verified-assets.mjs"]; })
		, "other SDK": queue(copy => { copy.versions.dotnetSdk = "9.0.100"; })
		, "other gdb": queue(copy => { copy.versions.gdb = "GNU gdb (GDB) 15.1"; })
		, "other gdb bytes": queue(copy => { copy.versions.gdbSha256 = "0".repeat(64); })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertDotnetDispatchRun(changed), assert.AssertionError, label);
});

test("both .NET reports keep their route, isolation flags, trigger, verified offsets and exact per-step counts", async () => {
	const ordinary = await text("dotnet.json"), reviewed = await text("dotnet-reviewed.json"), scriptSha256 = await script();
	assertDotnetDispatchReport(ordinary, "ordinary-source", scriptSha256);
	assertDotnetDispatchReport(reviewed, "reviewed-ir", scriptSha256);
	assert.throws(() => assertDotnetDispatchReport(ordinary, "reviewed-ir", scriptSha256), assert.AssertionError, "route swapped");
	assert.throws(() => assertDotnetDispatchReport(ordinary, "ordinary-source", "0".repeat(64)), assert.AssertionError, "another GDB script");
	const report = change => {
		const copy = JSON.parse(ordinary);
		change(copy.reports[0], copy);
		return JSON.stringify(copy);
	};
	const refused = {
		"reviewed digest on ordinary": report(item => { item.reviewedSourceSha256 = "0".repeat(64); })
		, "source kept": report(item => { item.sourceRemovedBeforeInstallation = false; })
		, "not relocated": report(item => { item.relocatedInstallation = false; })
		, "single execution": report(item => { item.repeatExecution = false; })
		, "online install": report(item => { item.offlineInstall = false; })
		, "compiler on the path": report(item => { item.compilerFreePath = false; })
		, "fewer checks": report(item => { item.checks = 2021; })
		, "other profile": report(item => { item.profile = "ruby"; })
		, "other package": report(item => { item.packages[0].name = "native-fin-other"; })
		, "package archive mismatch": report(item => { item.packages[0].artifacts[0].sha256 = "0".repeat(64); })
		, "shared library mismatch": report(item => { item.sharedNativeLibraries["libnative_fin.so"] = "0".repeat(64); })
		, "extra report": report((item, copy) => { copy.reports.push(item); })
		, "extra archive": report((item, copy) => { copy.archives["archives/extra.zip"] = "0".repeat(64); })
		, "not reproducible": report((item, copy) => { copy.reproducible = false; })
		, "older unobserved dispatch": report(item => { item.dispatch = { observed: false, reason: "the CLR loads native libraries privately; identity with the instrumented C adapter is asserted instead" }; })
		, "other instrument": report(item => { item.dispatch.instrument = "LD_PRELOAD"; })
		, "trigger wording": report(item => { item.dispatch.loadTrigger = "first call"; })
		, "trigger removed": report(item => { delete item.dispatch.loadTrigger; })
		, "probe digest": report(item => { item.dispatch.probeSha256 = "0".repeat(64); })
		, "config digest": report(item => { item.dispatch.configSha256 = "0".repeat(64); })
		, "other gdb": report(item => { item.dispatch.gdb.version = "GNU gdb (GDB) 15.1"; })
		, "wider scope": report(item => { item.dispatch.scope = "any platform"; })
		, "WIT adapter columns": report(item => { item.dispatch.columns.splice(3, 3, "lb_b59f358d1c9475f24bd43985", "lb_5597f18ac5ddcf489aa03c3d", "lb_97e49b166fad657a61e68249"); })
		, "column order": report(item => { item.dispatch.columns.reverse(); })
		, "other definer": report(item => { item.dispatch.definers[4] = "libnative_fin.so"; item.dispatch.breakpoints[4].library = "libnative_fin.so"; })
		, "moved Fin 0 adapter": report(item => { item.dispatch.breakpoints[4].offset = "0x29c0"; })
		, "dropped breakpoint": report(item => { item.dispatch.breakpoints.pop(); })
		, "unverified library": report(item => { item.dispatch.libraries["libextra.so"] = "0".repeat(64); })
		, "changed library": report(item => { item.dispatch.libraries["libleanshared.so"] = "0".repeat(64); })
		, "route wording": report(item => { item.dispatch.routes = ["NuGet"]; })
		, "control wording": report(item => { item.dispatch.positiveControl = "valid calls increment"; })
		, "extra dispatch key": report(item => { item.dispatch.observedAt = "now"; })
		, "dropped step": report(item => { item.dispatch.observed.splice(3, 1); })
		, "reordered steps": report(item => { item.dispatch.observed.reverse(); })
		, "other status": report(item => { item.dispatch.observed[5][1] = "ok:7"; })
		, "changed count": report(item => { item.dispatch.observed[11][2][0] = 3; })
	};
	for(const [label, changed] of Object.entries(refused))
		assert.throws(() => assertDotnetDispatchReport(changed, "ordinary-source", scriptSha256), assert.AssertionError, label);
});

test("the .NET row recount refuses counts from a rejected call, a Fin 0 entry or a missed adapter", () => {
	assertDotnetDispatchRows(structuredClone(dotnetDispatchRows));
	// The pinned rows share counter arrays; give every row its own so a mutant changes only the rows it names.
	const rows = change => {
		const copy = dotnetDispatchRows.map(([step, status, counts]) => [step, status, [...counts]]);
		change(copy);
		assert.deepEqual(copy[0], ["start", "ok", [0, 0, 0, 0, 0, 0]], "start is unchanged");
		return copy;
	};
	for(const [step, changed] of [
		["invalid-mirror-huge", rows(copy => { for(const row of copy.slice(2)) row[2][0]++; })]
		, ["invalid-impossible-zero", rows(copy => { for(const row of copy.slice(3)) row[2][1]++; })]
		, ["valid-mirror", rows(copy => { for(const row of copy.slice(5)) row[2][3]--; })]
	])
		assert.throws(() => assertDotnetDispatchDeltas(changed), error => error instanceof assert.AssertionError && error.message.split("\n")[0] === step, step);
});

test("the .NET producer test must keep its gate, single trigger, root check, refusals and exact rows", async () => {
	const source = await readFile(dotnetDispatchSnapshot("tests/dotnet-fin.test.mjs"), "utf8");
	const runner = await readFile(dotnetDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb-run.mjs"), "utf8");
	assertDotnetDispatchTestSource(source, runner);
	for(const [label, from, to] of [
		["armed before the trigger admitted", "        if (!Ours(before) || !Quiet(before, 0))", "        if (!Ours(before))"]
		, ["another trigger", "        try { return Api.Only(0) == 7; }", "        try { return Api.Mirror(0) == 9; }"]
		, ["uncovered root admitted", "        if (!Ours(after) || !Quiet(after, 0x3f) || !Covered(after))", "        if (!Ours(after))"]
		, ["trigger inlined", "    [MethodImpl(MethodImplOptions.NoInlining)]\n    static bool Trigger()", "    static bool Trigger()"]
		, ["component unchecked", "\t\tassert.equal(model.component.id, \"native-fin@1.0.0\");", ""]
		, ["root unchecked", "\t\tassert.equal(probeNative, join(dirname(probe), \"runtimes/linux-x64/native\"));", ""]
		, ["deployment unchecked", "\t\tassert.deepEqual(deployed, Object.fromEntries(Object.keys(packageLibraries).sort().map(name => [name, packageLibraries[name]])));", ""]
		, ["missing debugger admitted", "\t\tassert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, \"\"); assert.equal(missing.stderr, unattached);", ""]
		, ["rows unchecked", "\t\tassert.deepEqual(observed, dotnetFinDispatchExpected);", ""]
		, ["record unchecked", "\t\tconst breakpoints = await assertNativeFinGdbRun(observer, accepted, observed);", "\t\tconst breakpoints = [];"]
		, ["stand-in skippable when gated", "const standInSkip = process.env.LEAN_BRIDGE_DOTNET_FIN_TEST === \"1\" ? false : standInMissing;", "const standInSkip = standInMissing;"]
		, ["test renamed", `test(${JSON.stringify(dotnetDispatchTests.at(-1))}`, "test(\"reviewed packages\""]
	])
		assert.throws(() => assertDotnetDispatchTestSource(source.replace(from, to), runner), assert.AssertionError, label);
	for(const [label, from, to] of [
		["armed mask unchecked", "[mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [0x3f, 0, 0, [1, 1, 1, 1, 1, 1]]", "[mapped.armed], [mapped.armed]"]
		, ["PID unchecked", "\tassert.equal(mapped.pid, manifest.pid, \"the record belongs to the instrumented inferior\");", ""]
		, ["offset unchecked", "\t\tassert.equal(offset, Number.parseInt(line.trim().split(\" \")[0], 16), symbol);", ""]
	])
		assert.throws(() => assertDotnetDispatchTestSource(source, runner.replace(from, to)), assert.AssertionError, label);
});

test("the archived GDB script digest is the reports' and changes with any script byte", async () => {
	const helper = await readFile(dotnetDispatchSnapshot("tests/helpers/native-fin-dispatch-gdb.mjs"), "utf8");
	const digest = dotnetDispatchScriptSha256(helper);
	assert.equal(digest, JSON.parse(await text("dotnet.json")).reports[0].dispatch.scriptSha256);
	assert.notEqual(dotnetDispatchScriptSha256(helper.replace("handle all nostop noprint pass", "handle all stop print pass")), digest);
	assert.throws(() => dotnetDispatchScriptSha256(helper.replace("export const nativeFinGdbScript = String.raw`", "export const otherScript = String.raw`")), assert.AssertionError);
});

test("the .NET dispatch receipt refuses overclaims, unknown paths before reading and changed source bytes", async () => {
	const record = await receipt();
	const mutations = {
		"other hosts": changed => { changed.scope.otherHosts = true; }
		, "hosted": changed => { changed.scope.hostedCi = true; }
		, "older evidence": changed => { changed.scope.olderEvidence = "superseded"; }
		, "wider environment": changed => { changed.scope.environment = "any .NET, debugger and glibc"; }
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
		await assert.rejects(() => assertDotnetDispatchArchive(changed, path => readFile(path), { currentSources: false }), assert.AssertionError, label);
	}
	for(const path of ["/etc/hostname", `${dotnetDispatchArchiveDirectory}/../../../package.json`, `${dotnetDispatchArchiveDirectory}/extra.txt`])
	{
		const changed = structuredClone(record);
		changed.artifacts[0].path = path;
		let reads = 0;
		await assert.rejects(() => assertDotnetDispatchArchive(changed, async () => {
			reads++;
			return Buffer.alloc(0);
		}), assert.AssertionError, path);
		assert.equal(reads, 0, `${path} reached the reader`);
	}
	// A changed loader byte is not the producer's, even with the archive intact.
	await assert.rejects(() => assertDotnetDispatchArchive(record, async path => {
		const bytes = await readFile(path);
		return path === "src/backends/dotnet/verified-assets.mjs" ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}), error => error instanceof assert.AssertionError && error.message.startsWith("src/backends/dotnet/verified-assets.mjs"));
});

test("the .NET dispatch archive writer keeps identical bytes and refuses any differing file or receipt", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-dispatch-archive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const path = join(directory, "nested", "receipt.json");
	await writeDotnetDispatchArtifact(path, Buffer.from("one\n"));
	await writeDotnetDispatchArtifact(path, Buffer.from("one\n"));
	await assert.rejects(() => writeDotnetDispatchArtifact(path, Buffer.from("two\n")), assert.AssertionError);
	assert.equal(await readFile(path, "utf8"), "one\n");
});
