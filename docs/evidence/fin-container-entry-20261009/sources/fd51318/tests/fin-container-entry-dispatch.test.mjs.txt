/**
 * Source controls for the ten-column FinContainers entry counters (VO #1438): model-derived columns, exact
 * public and raw rows, the strict reader, the separate GDB identity and record, and probes that compile
 * against the APIs generated from the independent FinContainers review. Installed execution belongs to the
 * gated native-fin-containers producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { renderWitHostHeader } from "../src/backends/wit/copied-host.mjs";
import { generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { renderCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { renderCopiedJvmPackage } from "../src/backends/jvm/copied-values.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { finContainerSymbol } from "./helpers/fin-container-dispatch.mjs";
import { assertFinContainerGdbRun, finContainerDefiners, finContainerGdbExit, finContainerGdbIdentity, finContainerGdbRecord, finContainerGdbScript, observeFinContainerGdbDispatch, readFinContainerGdbRecord } from "./helpers/fin-container-dispatch-gdb.mjs";
import { finContainerGdbExtractedIdentity, finContainerGdbExtractedScript } from "./helpers/fin-container-dispatch-gdb-extracted.mjs";
import { finContainerEntryAdapter, finContainerEntryColumns, finContainerEntryExpected, finContainerEntryInitializer, finContainerEntryInterposer, finContainerEntryKind, finContainerEntryMutations, finContainerEntryRawExpected, finContainerEntryRawProbe, finContainerEntryReport, finContainerEntrySources, finContainerEntrySteps, finContainerEntrySymbols, readFinContainerEntry } from "./helpers/fin-container-entry-dispatch.mjs";
import { dotnetFinContainerEntryProbe, finContainerEntryMissing, finContainerEntryProfiles, finContainerEntryUncovered, finContainerEntryUnattached, finContainerEntryUntriggered, javaFinContainerEntryProbe, kotlinFinContainerEntryProbe, phpFinContainerEntryProbe, rubyFinContainerEntryProbe, witFinContainerEntryProbe } from "./helpers/fin-container-entry-probes.mjs";
import { nativeFinGdbExtractedScript } from "./helpers/native-fin-dispatch-gdb-extracted.mjs";
import { nativeFinGdbScript } from "./helpers/native-fin-dispatch-gdb.mjs";
import { finContainerReviewedIr } from "./helpers/reviewed-fin-container-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
// Actual component identities of the six hosts, from fin-container-install.mjs's package coordinates.
const components = ["fincontainers@1.0.0", "FinContainers.Api@1.0.0", "org.leanbridge:fincontainers@1.0.0", "example/fincontainers@1.0.0"];
const model = id => ({ component: { id }
	, exports: finContainerEntrySources.map(name => ({ name: `FinContainers.${name}`, symbol: finContainerEntryAdapter(id, `FinContainers.${name}`), parameters: Array(name === "label" ? 2 : 1).fill({}) })) });

test("container entry columns come from the actual component and its unique model exports", () => {
	// The two adapters the older four-column probe counts are the same symbols for the same component.
	const legacy = finContainerEntrySymbols("fincontainers@1.0.0");
	assert.deepEqual([legacy[5], legacy[7]], [finContainerSymbol("FinContainers.mirrorAll"), finContainerSymbol("FinContainers.orDefault")]);
	const seen = new Set();
	for(const id of components)
	{
		const columns = finContainerEntryColumns(model(id), model(id).component);
		assert.equal(columns.length, 10); assert.equal(new Set(columns).size, 10);
		assert.deepEqual(columns.slice(0, 5), finContainerEntrySources.map(name => `l_FinContainers_${name}`));
		for(const adapter of columns.slice(5))
		{
			assert.ok(!seen.has(adapter), "adapters differ between components");
			seen.add(adapter);
		}
		// The raw probe initializes the native adapter module the build itself names, never the Wasm one.
		assert.equal(finContainerEntryInitializer(id), `initialize_${generateNativeLeanAdapters({ component: { id }, exports: [], types: [] }).module}`);
		assert.match(finContainerEntryInitializer(id), /^initialize_LeanBridgeNative[0-9a-f]{16}$/u);
	}
	const base = model("FinContainers.Api@1.0.0");
	for(const [label, mutate, component] of [
		["other receipt component", () => {}, { id: "fincontainers@1.0.0" }]
		, ["no component", copy => { delete copy.component; }]
		, ["missing export", copy => { copy.exports.pop(); }]
		, ["duplicate export", copy => { copy.exports.push(copy.exports[0]); }]
		, ["symbol from another component", copy => { copy.exports[1].symbol = finContainerEntryAdapter("fincontainers@1.0.0", "FinContainers.sumHuge"); }]
		, ["wrong arity", copy => { copy.exports[4].parameters.pop(); }]
	]) {
		const copy = structuredClone(base); mutate(copy);
		assert.throws(() => finContainerEntryColumns(copy, component ?? copy.component), TypeError, label);
	}
});

test("public rows reject every invalid call before any valid one and count each valid call once", () => {
	assert.equal(finContainerEntryExpected.length, 24);
	const steps = finContainerEntrySteps.map(([step]) => step);
	for(const step of ["invalid-array-first", "invalid-array-middle", "invalid-array-last", "invalid-list-wide", "invalid-option-present", "invalid-nested-present", "invalid-label-late"])
		assert.ok(steps.indexOf(step) < steps.indexOf("valid-array"), step);
	for(const [method, args] of [["mirrorAll", [10n, 1n, 2n]], ["mirrorAll", [1n, 10n, 2n]], ["mirrorAll", [1n, 2n, 10n]]])
		assert.ok(finContainerEntrySteps.some(([, name, values]) => name === method && JSON.stringify(values[0], (k, v) => typeof v === "bigint" ? `${v}` : v) === JSON.stringify(args.map(String))));
	finContainerEntryExpected.forEach(([step, status, counts], index) => {
		const previous = index ? finContainerEntryExpected[index - 1][2] : Array(10).fill(0);
		const change = counts.map((value, k) => value - previous[k]);
		if(status.startsWith("rejected:") || step === "start") assert.deepEqual(change, Array(10).fill(0), step);
		else
		{
			const column = finContainerEntrySources.indexOf(finContainerEntrySteps[index][1]);
			assert.deepEqual(change, Array.from({ length: 10 }, (_, k) => k === column || k === column + 5 ? 1 : 0), step);
		}
	});
	assert.deepEqual(finContainerEntryExpected.at(-1)[2], [2, 2, 3, 2, 2, 2, 2, 3, 2, 2]);
	const valid = Object.fromEntries(finContainerEntryExpected.filter(([step]) => /^(valid|recovery-valid)-/u.test(step)).map(([step, status]) => [step, status]));
	assert.deepEqual(valid, {
		"valid-array": "ok:9,0"
		, "valid-list-wide": "ok:1180591620717411303424"
		, "valid-option-absent": "ok:7"
		, "valid-option-present": "ok:0"
		, "valid-nested-present": "ok:1,9"
		, "valid-label": "ok:a:1,b:3"
		, "recovery-valid-array": "ok:"
		, "recovery-valid-list": "ok:0"
		, "recovery-valid-option": "ok:7"
		, "recovery-valid-nested": "ok:"
		, "recovery-valid-label": "ok:a:0"
	});
	assert.equal(finContainerEntryExpected.find(([step]) => step === "invalid-list-wide")[1], "rejected:arg0:1180591620717411303424");
	assert.equal(finContainerEntryExpected.find(([step]) => step === "invalid-label-late")[1], "rejected:arg1:4");
});

test("raw adapter rows enter only the adapter for invalid values and both for valid ones", () => {
	assert.equal(finContainerEntryRawExpected.length, 11);
	for(const [step, status, counts] of finContainerEntryRawExpected.slice(1, 6))
	{
		assert.equal(status, "none", step);
		assert.deepEqual(counts.slice(0, 5), [0, 0, 0, 0, 0], step);
	}
	assert.deepEqual(finContainerEntryRawExpected[5][2], [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
	assert.deepEqual(finContainerEntryRawExpected.at(-1)[2], [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
});

test("the entry reader refuses hidden entries, compensated totals, status drift and malformed rows", () => {
	for(const expected of [finContainerEntryExpected, finContainerEntryRawExpected])
	{
		const { valid, mutations } = finContainerEntryMutations(expected);
		assert.deepEqual(readFinContainerEntry(valid, expected).map(row => row.slice(0, 2)), expected.map(row => row.slice(0, 2)));
		assert.ok(Object.keys(mutations).length >= 8);
		for(const [reason, output] of Object.entries(mutations)) assert.throws(() => readFinContainerEntry(output, expected), TypeError, reason);
	}
	// The public and raw tables cannot stand in for each other.
	assert.throws(() => readFinContainerEntry(finContainerEntryMutations(finContainerEntryRawExpected).valid, finContainerEntryExpected), TypeError);
});

test("the report keeps public host rows and C raw-adapter rows in separate sections", () => {
	const id = "FinContainers.Api@1.0.0", columns = finContainerEntrySymbols(id);
	const render = rows => rows.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join("");
	const publicHost = { stdout: render(finContainerEntryExpected), caller: "public host", instrument: "gdb-breakpoints", identities: { probeSha256: "p" } };
	const rawAdapter = { stdout: render(finContainerEntryRawExpected), identities: { probeSha256: "r" } };
	const report = finContainerEntryReport({ publicHost, rawAdapter, columns, componentId: id, libraries: {} });
	assert.equal(report.kind, finContainerEntryKind);
	assert.deepEqual(report.measuredEntrypoints, finContainerEntrySources.map(name => `FinContainers.${name}`));
	assert.match(report.rawAdapter.caller, /not a host-language call/u);
	assert.ok(!Object.hasOwn(report, "observed"), "no combined or unobserved claim beside the two sections");
	assert.throws(() => finContainerEntryReport({ publicHost: { stdout: render(finContainerEntryRawExpected) }, rawAdapter: { stdout: render(finContainerEntryRawExpected) }, columns, componentId: id }), TypeError);
	assert.throws(() => finContainerEntryReport({ publicHost: { stdout: render(finContainerEntryExpected) }, rawAdapter: { stdout: render(finContainerEntryRawExpected) }, columns: finContainerEntrySymbols("fincontainers@1.0.0"), componentId: id }), TypeError);
});

test("the interposer and raw probe accept only the component's ten distinct columns", () => {
	const id = "org.leanbridge:fincontainers@1.0.0", columns = finContainerEntrySymbols(id);
	assert.throws(() => finContainerEntryInterposer(columns.slice(1)), TypeError);
	assert.throws(() => finContainerEntryInterposer([...columns.slice(1), columns[1]]), TypeError);
	assert.throws(() => finContainerEntryRawProbe(id, finContainerEntrySymbols("fincontainers@1.0.0")), TypeError);
	const raw = finContainerEntryRawProbe(id, columns);
	assert.ok(raw.indexOf("fin_container_entry_count") < raw.indexOf("lean_bridge_native_component_initialize"), "the counter is resolved before initialization");
	assert.ok(raw.includes(`"${finContainerEntryInitializer(id)}"`) && raw.includes(JSON.stringify(id)));
	for(const adapter of columns.slice(5)) assert.ok(raw.includes(JSON.stringify(adapter)), adapter);
	assert.doesNotMatch(raw, /l_FinContainers_/u, "raw calls reach sources only through their adapters");
	// The label adapter takes both arrays; every other measured adapter takes one value.
	assert.match(finContainerEntryInterposer(columns), new RegExp(`void \\*${columns[9]}\\(void \\*a0, void \\*a1\\)`, "u"));
});

test("the container GDB identities are separate, exact and refuse arbitrary columns", () => {
	const id = "fincontainers@1.0.0", columns = finContainerEntrySymbols(id), libraries = ["libfincontainers.so", "libcomponent_x.so", "libleanshared.so"];
	const definers = Object.fromEntries(columns.map(symbol => [symbol, "libcomponent_x.so"]));
	const { identity, definerIndices } = finContainerGdbIdentity({ componentId: id, libraries, definers });
	assert.deepEqual([identity.kind, identity.columns, definerIndices], ["fin-container-entry", columns, Array(10).fill(0)]);
	const hashes = Object.fromEntries(libraries.map(name => [name, sha256(name)]));
	assert.equal(finContainerGdbExtractedIdentity({ componentId: id, hashes, definers }).identity.kind, "fin-container-entry");
	for(const [label, change] of [
		["missing column", { definers: Object.fromEntries(Object.entries(definers).slice(1)) }]
		, ["outside library", { definers: { ...definers, [columns[0]]: "libother.so" } }]
		, ["extra column", { definers: { ...definers, lb_extra: "libcomponent_x.so" } }]
		, ["path name", { libraries: [...libraries, "../libfincontainers.so"] }]
	])
		assert.throws(() => finContainerGdbIdentity({ componentId: id, libraries, definers, ...change }), TypeError, label);
	const listing = names => names.map((name, index) => `${(index + 1).toString(16).padStart(16, "0")} T ${name}`).join("\n") + "\n";
	assert.deepEqual(finContainerDefiners(id, { "libcomponent_x.so": listing(columns), "libleanshared.so": listing(["lean_inc"]) }), definers);
	assert.throws(() => finContainerDefiners(id, { "libcomponent_x.so": listing(columns), "libfincontainers.so": listing([columns[9]]) }), /exactly one verified library, not 2/u);
});

test("the container record has its own magic and ten-column layout", () => {
	const bytes = Buffer.alloc(finContainerGdbRecord.size);
	assert.equal(finContainerGdbRecord.size, 376); assert.equal(finContainerGdbRecord.armed, 0x3ff);
	bytes.write("LBFCOGDB", 0, "latin1"); bytes.writeUInt32LE(1, 8); bytes.writeUInt32LE(10, 12);
	bytes.writeBigInt64LE(42n, 112); bytes.writeUInt32LE(1, 120); bytes.writeUInt32LE(0x3ff, 124);
	for(let k = 0; k < 10; k++)
	{
		bytes.writeBigUInt64LE(1n, 136 + 8 * k); bytes.writeInt32LE(k, 216 + 4 * k);
		bytes.writeBigUInt64LE(BigInt(10 + k), 296 + 8 * k);
	}
	const record = readFinContainerGdbRecord(bytes);
	assert.deepEqual([record.magic, record.columns, record.armed, record.breakpoints, record.definers, record.entries]
		, ["LBFCOGDB", 10, 0x3ff, Array(10).fill(1), [...Array(10).keys()], Array.from({ length: 10 }, (_, k) => 10 + k)]);
	assert.throws(() => readFinContainerGdbRecord(bytes.subarray(1)), TypeError);
	assert.throws(() => readFinContainerGdbRecord(Buffer.alloc(280)), TypeError, "a scalar record is never a container record");
});

test("each container GDB script is its scalar script with only the width, magic, variable and identity guard changed", () => {
	const guard = '\nif (identity.get("kind") != "fin-container-entry" or len(columns) != WIDTH or len(set(columns)) != WIDTH\n        or len(definers) != WIDTH or any(name not in libraries for name in definers)):\n    gdb.write("fin instrumentation refused: the container identity is not ten distinct columns\\n", gdb.STDERR)\n    gdb.execute("quit 71")';
	for(const [scalar, container, anchor] of [[nativeFinGdbScript, finContainerGdbScript, 'columns, definers, libraries = identity["columns"], identity["definers"], identity["libraries"]'], [nativeFinGdbExtractedScript, finContainerGdbExtractedScript, 'parent = config["parent"]']])
	{
		const derived = scalar
			.replace("of the six Fin dispatch columns", "of the ten FinContainers columns")
			.replace('os.environ["LEAN_BRIDGE_FIN_GDB_CONFIG"]', 'os.environ["LEAN_BRIDGE_FIN_CONTAINER_GDB_CONFIG"]')
			.replace(anchor, `${anchor}\nWIDTH = 10`)
			.replace('"breakpoints": [0] * 6, "definer": [-1] * 6, "entries": [0] * 6,', '"breakpoints": [0] * WIDTH, "definer": [-1] * WIDTH, "entries": [0] * WIDTH,')
			.replace('"<8sII64s32sqIIII6Q6i6I6Q", b"LBFINGDB", 1, 6,', '"<8sII64s32sqIIII10Q10i10I10Q", b"LBFCOGDB", 1, WIDTH,')
			.replace("*([0] * 6), *state", "*([0] * WIDTH), *state")
			.replace("\ntry:\n    # Address-space randomization", `${guard}\ntry:\n    # Address-space randomization`);
		assert.equal(container, derived.replace("Count entries of the six Fin dispatch columns", "Count entries of the ten FinContainers columns"));
		assert.doesNotMatch(container, /LBFINGDB|\* 6\b|LD_PRELOAD|dlsym/u);
	}
});

test("host probes resolve their instrument before loading, gate lazy loaders and print every step", () => {
	assert.deepEqual(finContainerEntryProfiles, ["php-native", "wit-wasi", "ruby", "dotnet", "java", "kotlin"]);
	const sources = {
		php: phpFinContainerEntryProbe()
		, wit: witFinContainerEntryProbe("fincontainers")
		, ruby: rubyFinContainerEntryProbe()
		, dotnet: dotnetFinContainerEntryProbe()
		, java: javaFinContainerEntryProbe()
		, kotlin: kotlinFinContainerEntryProbe()
	};
	for(const [host, source] of Object.entries(sources))
		for(const [step] of finContainerEntrySteps) assert.ok(source.includes(`"${step}"`) || source.includes(`'${step}'`), `${host}: ${step}`);
	assert.ok(sources.php.indexOf("fin_container_entry_count") < sources.php.indexOf("vendor/autoload.php"));
	assert.ok(sources.wit.indexOf("fin_container_entry_count") < sources.wit.indexOf("fincontainers_wasmtime_open(&session)"));
	assert.ok(sources.php.includes(JSON.stringify(finContainerEntryMissing.trimEnd())) && sources.wit.includes(JSON.stringify(finContainerEntryMissing)));
	// Ruby loads its gem eagerly; .NET and the JVM load on first call, so they trigger with countNone([]) first.
	assert.ok(sources.ruby.indexOf(JSON.stringify(finContainerEntryUnattached)) < sources.ruby.indexOf('require "lean_bridge/fincontainers"'));
	assert.ok(sources.ruby.indexOf('require "lean_bridge/fincontainers"') < sources.ruby.indexOf(JSON.stringify(finContainerEntryUncovered)));
	for(const host of ["dotnet", "java", "kotlin"])
	{
		const source = sources[host], order = [JSON.stringify(finContainerEntryUnattached), JSON.stringify(finContainerEntryUntriggered), JSON.stringify(finContainerEntryUncovered)].map(needle => source.indexOf(needle));
		assert.ok(order.every((at, k) => at > 0 && (!k || at > order[k - 1])), host);
		assert.match(source, /countNone|CountNone/u, host);
		assert.ok(source.includes(String(finContainerGdbRecord.armed)) || source.includes("1023"), host);
	}
	for(const source of [sources.ruby, sources.dotnet, sources.java, sources.kotlin])
	{
		assert.ok(source.includes(JSON.stringify(finContainerGdbRecord.magic)));
		assert.doesNotMatch(source, /LBFINGDB|native_fin|NativeFin/u);
	}
});

const compiles = process.env.LEAN_BRIDGE_FIN_CONTAINER_PROBE_COMPILE === "1";
test("every host probe compiles against the API generated from the independent FinContainers review", { skip: !compiles && "set LEAN_BRIDGE_FIN_CONTAINER_PROBE_COMPILE=1 with the pinned toolchains", timeout: 1_200_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-container-probes-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = finContainerReviewedIr(), environment = nativeFixtureEnvironment(["dotnet", "java", "kotlin", "wit-wasi"]);
	await saveLakeFile(join(root, "php"), "entry.php", phpFinContainerEntryProbe());
	assert.equal((await runCopied("/usr/bin/php", ["-n", "-l", "entry.php"], join(root, "php"), tools)).stdout, "No syntax errors detected in entry.php\n");
	await saveLakeFile(join(root, "ruby"), "entry.rb", rubyFinContainerEntryProbe());
	assert.equal((await runCopied("/usr/bin/ruby", ["-c", "entry.rb"], join(root, "ruby"), tools)).stdout, "Syntax OK\n");
	await saveLakeFile(join(root, "wit"), "fincontainers_wasmtime.h", renderWitHostHeader({ surface: { prefix: "fincontainers", callbacks: new Map() } }));
	await saveLakeFile(join(root, "wit"), "entry.c", witFinContainerEntryProbe("fincontainers"));
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-I.", "-isystem", join(environment.LEAN_BRIDGE_WASMTIME_C_API, "include"), "-fsyntax-only", "entry.c"], join(root, "wit"), tools);
	const id = "fincontainers@1.0.0", lean = join(environment.LEAN_BRIDGE_LEAN_PREFIX, "include");
	await saveLakeFile(join(root, "raw"), "raw.c", finContainerEntryRawProbe(id, finContainerEntrySymbols(id)));
	await saveLakeFile(join(root, "raw"), "interposer.c", finContainerEntryInterposer(finContainerEntrySymbols(id)));
	for(const [file, extra] of [["raw.c", ["-isystem", lean]], ["interposer.c", []]])
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", ...extra, "-fsyntax-only", file], join(root, "raw"), tools);
	const jvm = Object.entries(renderCopiedJvmPackage(compileCopiedJvmModel(ir))).filter(([path]) => path.endsWith(".java"));
	for(const [path, source] of jvm) await saveLakeFile(join(root, "jvm/src"), path, source);
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-d", join(root, "jvm/classes"), ...jvm.map(([path]) => join(root, "jvm/src", path))], root, tools);
	await saveLakeFile(join(root, "java"), "Probe.java", javaFinContainerEntryProbe());
	await runCopied(environment.LEAN_BRIDGE_JAVAC, ["--release", "22", "-Werror", "-Xlint:all", "-cp", join(root, "jvm/classes"), "-d", "classes", "Probe.java"], join(root, "java"), tools);
	await saveLakeFile(join(root, "kotlin"), "Probe.kt", kotlinFinContainerEntryProbe());
	await runCopied(environment.LEAN_BRIDGE_KOTLINC, ["-Werror", "-jvm-target", "22", "-cp", join(root, "jvm/classes"), "Probe.kt", "-include-runtime", "-d", "probe.jar"], join(root, "kotlin")
		, { ...tools, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA)) });
	const dotnet = join(root, "dotnet");
	for(const [path, source] of Object.entries(renderCopiedDotnetPackage(compileCopiedDotnetModel(ir)))) if(path.endsWith(".cs")) await saveLakeFile(dotnet, path.split("/").at(-1), source);
	await saveLakeFile(dotnet, "Probe.cs", dotnetFinContainerEntryProbe());
	await writeFile(join(dotnet, "Probe.csproj"), '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems><AllowUnsafeBlocks>true</AllowUnsafeBlocks><EnableNETAnalyzers>false</EnableNETAnalyzers></PropertyGroup><ItemGroup><Compile Include="*.cs"/></ItemGroup></Project>');
	const env = { ...tools, DOTNET_CLI_HOME: join(dotnet, "home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(dotnet, "packages") };
	const built = await runCopied(environment.LEAN_BRIDGE_DOTNET, ["build", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], dotnet, env);
	assert.match(built.stdout, /\b0 Warning\(s\)/u);
});

const gdb = process.env.LEAN_BRIDGE_FIN_CONTAINER_GDB_SMOKE === "1";
test("the strict-root container script counts all ten columns in a real inferior and refuses stale records and failed writes", { skip: !gdb && "set LEAN_BRIDGE_FIN_CONTAINER_GDB_SMOKE=1 where GDB may ptrace", timeout: 300_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-container-gdb-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const columns = finContainerEntrySymbols("fincontainers@1.0.0"), lib = join(root, "lib");
	await saveLakeFile(lib, "stand-in.c", `${columns.map(symbol => `void *${symbol}(void *a) { return a; }`).join("\n")}\n`);
	await runCopied("/usr/bin/cc", ["-shared", "-fPIC", "-o", "libcomponent_x.so", "stand-in.c"], lib, tools);
	await rm(join(lib, "stand-in.c"));
	// Column k is entered k + 1 times; the probe then prints the record's entries.
	await saveLakeFile(root, "probe.c", `#include <stdio.h>
#include <stdint.h>
${columns.map(symbol => `void *${symbol}(void *);`).join("\n")}
int main(int argc, char **argv) {
  if (argc < 2) return 2;
  void *(*f[10])(void *) = { ${columns.join(", ")} };
  for (int k = 0; k < 10; ++k) for (int i = 0; i <= k; ++i) f[k](0);
  FILE *r = fopen(argv[1], "rb"); unsigned char b[${finContainerGdbRecord.size}];
  if (!r || fread(b, 1, sizeof b, r) != sizeof b) return 3;
  fclose(r);
  for (int k = 0; k < 10; ++k) { uint64_t v = 0; for (int j = 7; j >= 0; --j) v = (v << 8) | b[296 + 8 * k + j]; printf("%llu%c", (unsigned long long)v, k == 9 ? '\\n' : ' '); }
  return 0;
}
`);
	await runCopied("/usr/bin/cc", ["-o", "probe", "probe.c", "-L", lib, "-l:libcomponent_x.so", `-Wl,-rpath,${lib}`], root, tools);
	const observer = await observeFinContainerGdbDispatch({ probeRoot: join(root, "gdb"), nativeDirectory: lib, componentId: "fincontainers@1.0.0", argv: ({ record }) => [join(root, "probe"), record], cwd: root, env: tools });
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, accepted.output);
	const counts = accepted.stdout.trim().split(" ").map(Number);
	assert.deepEqual(counts, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	const breakpoints = await assertFinContainerGdbRun(observer, accepted, [["last", "ok", counts]]);
	assert.deepEqual(breakpoints.map(item => item.symbol), columns);
	assert.equal((await observer.run({ before: record => writeFile(record, "stale") })).code, finContainerGdbExit.refusedRecord);
	assert.equal((await observer.run({ inject: { write: 3 } })).code, finContainerGdbExit.instrumentation);
	// A root that holds none of the verified libraries arms nothing, so no entry is counted.
	const foreign = await observer.run({ root });
	assert.equal(foreign.code, 0); assert.equal(foreign.stdout, "0 0 0 0 0 0 0 0 0 0\n");
	assert.equal(readFinContainerGdbRecord(Buffer.from(await (await import("node:fs/promises")).readFile(foreign.record))).armed, 0);
});
