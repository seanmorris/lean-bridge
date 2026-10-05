/**
 * Execute owned C# snapshots against fresh ordinary and reviewed Lean builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetConversions } from "../src/backends/dotnet/owned-conversions.mjs";
import { ownedDotnetRuntime } from "../src/backends/dotnet/owned-runtime.mjs";
import { ownedDotnetThreadExit } from "../src/backends/dotnet/owned-thread-exit.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned C# declarations preserve recursion, typed higher-order signatures and all scalar widths", () => {
	const ir = ownedCppCompositionReviewedIr(), before = structuredClone(ir);
	const model = generateOwnedDotnetConversions(ir);
	assert.deepEqual(ir, before);
	assert.equal(generateOwnedDotnetConversions(ir).source, model.source);
	assert.equal(model.types.length, 41);
	assert.match(model.valuesSource, /record ChainLink\(Ticket Ticket, Option<Chain> Next\)/u);
	assert.match(model.valuesSource, /Bundle Invoke\(CallbackRecordArgument1ClosureCallback arg0\)/u);
	assert.match(model.valuesSource, /delegate Bundle DispatchResultClosureCallback\(CallbackRecordArgument1Closure arg0\)/u);
	assert.match(model.valuesSource, /Invoke\(arg0.AsCallback\)/u);
	assert.match(model.valuesSource, /Lean alias BundleAlias = Bundle; C#: Bundle/u);
	assert.doesNotMatch(model.valuesSource, /NativeLibrary|DllImport|unsafe|lean_object|nint/u);
	assert.match(model.source, /scope.Root\(value.Handle\)/u);
	const scalars = generateOwnedDotnetConversions(ownedPythonScalarsReviewedIr());
	assert.equal(scalars.types.filter(node => node.kind === "primitive").length, 19);
	for(const reserved of ["Api", "IOwnedValue", "Interop", "Ticket", "OwnedAggregates"])
	{
		const invalid = structuredClone(ir); invalid.types.find(node => node.name === "Payload").name = reserved;
		assert.throws(() => generateOwnedDotnetConversions(invalid), /reserved|duplicate|collision/u);
	}
});

// This test-only caller exercises generated converters and real native calls.
// Host-delegate trampolines and authenticated package loading are separate gates.
const callers = model => {
	const table = new Map(model.types.map(node => [node.id, node]));
	const native = new Map(model.nativeTypes.map(node => [node.id, node]));
	const all = [
		...model.functions.map(fn => ({ ...fn, method: fn.publicName }))
		, ...model.c.retains.map(fn => ({ ...fn, method: `Retain${table.get(fn.id).index}`, handle: true }))
		, ...model.c.copies.map(fn => ({ ...fn, method: `Copy${table.get(fn.id).index}` }))
		, ...model.c.callbacks.map(fn => ({ ...fn, method: `Invoke${table.get(fn.id).index}`, handle: true }))
	];
	const supported = fn => !fn.parameters.some((_, index) => model.c.hostArgument(fn, index));
	const methods = all.filter(supported).map(fn => {
		const parameters = fn.parameters.map(id => table.get(id)), result = table.get(fn.result);
		const signature = parameters.map((node, index) => `${fn.handle && index === 0 ? "OwnedHandle" : native.get(node.id).publicType} arg${index}`).join(", ");
		const write = (node, index, scope) => fn.handle && index === 0 ? `${scope}.Root(arg0)` : `OwnedConvert.Write${node.index}(arg${index}, ${scope})`;
		const pointer = `delegate* unmanaged[Cdecl]<${["nint", ...parameters.map(node => node.raw + (node.leaf ? "" : "*")), result.raw + "*", "nint*", "uint"].join(", ")}>`;
		return `    internal static ${native.get(result.id).publicType} ${fn.method}(${signature})
    {
        var state = Runtime.Current; state.Require();
        using (var check = new OwnedValueScope(state, Factories, checkOnly: true))
        {
${parameters.map((node, index) => `            ${write(node, index, "check")};`).join("\n")}
        }
        using var inputs = new OwnedValueScope(state, Factories);
${parameters.map((node, index) => `        var input${index} = ${write(node, index, "inputs")};`).join("\n")}
        using var owner = new OwnedResult(state);
        using var outputs = new OwnedValueScope(state, Factories, lease: owner.Adopt);
        var output = default(${result.raw});
        var invoke = (${pointer})NativeLibrary.GetExport(Library, "${fn.cName}");
        fixed (nint* resultOwner = &owner.Value)
            OwnedRuntime.Check(invoke(${["state.Require()", ...parameters.map((node, index) => `${node.leaf ? "" : "&"}input${index}`), "&output", "resultOwner"].join(", ")}));
        var result = OwnedConvert.Read${result.index}(&output, outputs);
        OwnedRuntime.Checkpoint(); owner.Complete();
        return result;
    }`;
	});
	const identities = model.types.filter(node => node.identity), factories = identities.map(node => {
		const callback = model.callbacks.find(fn => fn.id === node.id);
		const invoke = callback ? supported(callback)
			? `, (${callback.invokeParameters.map((_, i) => `arg${i}`).join(", ")}) => Invoke${node.index}(handle${callback.invokeParameters.map((_, i) => `, arg${i}`).join("")})`
			: `, (${callback.invokeParameters.map((_, i) => `arg${i}`).join(", ")}) => throw new NotSupportedException("Host-delegate binding is outside this converter probe")` : "";
		return `handle => new _V.${node.publicType}(handle, Retain${node.index}${invoke})`;
	});
	const invalid = [];
	for(const node of model.types)
	{
		if(node.name === "unit" || node.name === "bool") invalid.push(`Reject<OwnedInvalidNative>(() => { byte value = 2; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		if(node.name === "char") invalid.push(`Reject<OwnedInvalidNative>(() => { uint value = 0xd800; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		if(node.kind === "option" || node.kind === "result") invalid.push(`Reject<OwnedInvalidNative>(() => { ${node.raw} value = new() { Flag = 2 }; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		if(node.kind === "variant") invalid.push(`Reject<OwnedInvalidNative>(() => { ${node.raw} value = new() { Kind = uint.MaxValue }; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		if(node.element || node.name === "string" || node.name === "bytes")
		{
			invalid.push(`Reject<OwnedInvalidNative>(() => { ${node.raw} value = new() { Length = 1 }; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
			invalid.push(`Reject<OwnedLimit>(() => { ${node.raw} value = new() { Length = nuint.MaxValue }; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		}
		if(node.name === "string") invalid.push(`Reject<OwnedInvalidNative>(() => { byte bad = 255; ${node.raw} value = new() { Data = (nint)(&bad), Length = 1 }; using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		if(node.integer)
		{
			for(const fields of ["Length = int.MinValue", "Allocated = -1", "Length = 1", "Allocated = 1, Length = 1, Data = (nint)(&zero)"])
				invalid.push(`Reject<OwnedInvalidNative>(() => { ulong zero = 0; OwnedMpz integer = new() { ${fields} }; nint value = (nint)(&integer); using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); _ = zero; });`);
			invalid.push(`Reject<OwnedLimit>(() => { OwnedMpz integer = new() { Allocated = int.MaxValue, Length = int.MaxValue }; nint value = (nint)(&integer); using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		}
		for(const branch of node.cases) for(const field of branch.fields)
		{
			const child = table.get(field.type);
			if(child.element === node.id) invalid.push(`Reject<OwnedInvalidNative>(() => { ${node.raw} value = new() { Kind = ${node.cases.indexOf(branch)} }; ${child.raw} children = new() { Data = (nint)(&value), Length = 1 }; value.Cases.${branch.rawName}.${field.rawName} = (nint)(&children); using var scope = Input(); OwnedConvert.Read${node.index}(&value, scope); });`);
		}
	}
	const ticket = model.types.find(node => node.kind === "resource");
	return `using System;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Threading;
using _V = global::${model.namespace};
using global::${model.namespace};
using global::${model.namespace}.Interop;
internal static unsafe partial class Program
{
    internal static nint Library;
    internal static OwnedRuntime Runtime = null!;
    internal static readonly OwnedFactories Factories = new(${factories.join(",\n        ")});
    internal static OwnedValueScope Input() => new(Runtime.Current, Factories);
${methods.join("\n")}
    private static void Malformed()
    {
${invalid.join("\n")}
    }
    private static void Borrowed(Ticket ticket)
    {
        Ticket escaped, kept;
        using (var frame = new OwnedBorrowFrame(Runtime.Current))
        using (var scope = new OwnedValueScope(Runtime.Current, Factories, lease: () => frame.Lease))
        {
            var raw = ticket.Handle.Raw(Runtime.Current);
            escaped = OwnedConvert.Read${ticket.index}(&raw, scope); kept = escaped.Retain();
        }
        Check(escaped.IsClosed && !kept.IsClosed, "borrow expiry and explicit retain");
        Reject<LeanBridgeException>(() => escaped.Retain());
        escaped.Dispose(); kept.Dispose();
    }
}
`;
};

for(const scalar of [false, true]) for(const reviewed of [false, true]) test(`real Lean owned C# ${scalar ? "scalars" : "compositions"} (${reviewed ? "reviewed" : "ordinary"})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 600000
}, async t => {
	const compiled = await compileOwnedAggregateFixture(t, {
		fixture: scalar ? "owned-scalars" : "owned-cpp-composition"
		, hostCallbacks: true
		, ...scalar ? { witness: "import Owned\n" } : {}
		, ...reviewed ? { reviewedIr: scalar ? ownedPythonScalarsReviewedIr() : ownedCppCompositionReviewedIr() } : {}
	});
	const model = generateOwnedDotnetConversions(compiled.model.bindingIr);
	const c = generateOwnedCPackage({ metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true });
	const cleanup = ownedDotnetThreadExit(c.values.prefix);
	const implementation = `#include <stdlib.h>
#include <stddef.h>
#include <stdatomic.h>
static _Atomic size_t live;
static _Thread_local ptrdiff_t remaining = -1;
static void *probe_alloc(size_t size) {
  if (remaining == 0) return NULL;
  if (remaining > 0) --remaining;
  void *value = malloc(size); if (value) atomic_fetch_add(&live, 1); return value;
}
static void probe_free(void *value) { if (value) { atomic_fetch_sub(&live, 1); free(value); } }
#define LB_OWNED_ALLOC probe_alloc
#define LB_OWNED_FREE probe_free
${c.source}
${cleanup.source}
size_t probe_live(void) { return atomic_load(&live); }
size_t probe_identities(void) { lean_bridge_native_snapshot s; lean_bridge_native_snapshot_read(&s); return s.live_identities; }
void probe_fail(ptrdiff_t value) { remaining = value; }
`;
	for(const [path, content] of Object.entries(c.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : content);
	await saveLakeFile(compiled.directory, "guard.cpp", cleanup.guardSource);
	const env = { PATH: "/usr/bin:/bin" }, includes = ["-I", join(compiled.directory, "runtime/include")];
	await runCopied("/usr/bin/cc", ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "api.c", "-o", "api.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-std=c++17", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fPIC", ...includes, "-c", "guard.cpp", "-o", "guard.o"], compiled.directory, env);
	await runCopied("/usr/bin/c++", ["-shared", "-pthread", "api.o", "guard.o"
		, "Owned.o", "Carriers.o", "Witness.o"
		, ...compiled.callbackSource ? ["Callbacks.o"] : []
		, "-L", join(compiled.directory, "runtime/lib")
		, "-lgmp", "-llean_bridge_native", "-lleanshared"
		, "-Wl,-rpath," + join(compiled.directory, "runtime/lib")
		, "-Wl,-z,defs", "-Wl,-z,nodelete", "-o", "libprobe.so"
	], compiled.directory, env);
	const runtime = ownedDotnetRuntime(c.values.prefix), checkpoint = "internal static void Checkpoint() { }";
	assert.equal(runtime.split(checkpoint).length, 2);
	const instrumented = runtime.replace(checkpoint, "internal static void Checkpoint() { global::Program.Allocation(); }");
	const probe = await readFile(`tests/fixtures/structured-types/owned-dotnet-${scalar ? "scalars" : "compositions"}.cs`, "utf8");
	const common = await readFile("tests/fixtures/structured-types/owned-dotnet-conversions.cs", "utf8");
	const callSource = callers(model);
	for(const [path, content] of Object.entries({
		"Values.cs": model.valuesSource, "Conversion.cs": model.source
		, "Runtime.cs": `namespace ${model.namespace}.Interop;\n${instrumented}`
		, "Calls.cs": callSource, "Program.cs": common, "Probe.cs": probe
		, "Conversion.csproj": '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>'
		, "NuGet.Config": '<configuration><packageSources><clear/></packageSources></configuration>'
	})) await saveLakeFile(compiled.directory, path, content);
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const environment = { ...env, DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(compiled.directory, "home")
		, DOTNET_NOLOGO: "1", DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, NUGET_PACKAGES: join(compiled.directory, "packages") };
	await runCopied(dotnet, ["build", "Conversion.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], compiled.directory, environment);
	const result = await runCopied(dotnet, ["out/Conversion.dll", join(compiled.directory, "libprobe.so")], compiled.directory, environment);
	assert.equal(result.stderr, ""); const observation = JSON.parse(result.stdout);
	assert.ok(observation.checks > 100); assert.ok(observation.managedFailures > 0); assert.ok(observation.nativeFailures > 0);
	assert.equal(observation.live, 0); assert.equal(observation.identities, 0);
	await saveLakeFile(resolve("build/owned-dotnet-conversions"), `${scalar ? "scalars-" : ""}${reviewed ? "reviewed" : "ordinary"}.json`, canonicalJson({
		observation, compiledLean: true, installedPackage: false, hostDelegates: false
		, sourceIdentitySha256: compiled.sourceIdentitySha256
		, valuesSha256: sha256(model.valuesSource)
		, conversionsSha256: sha256(model.source)
		, runtimeSha256: sha256(runtime), nativeProbeSha256: sha256(implementation)
		, managedProbeSha256: sha256(probe), commonProbeSha256: sha256(common)
		, callSourceSha256: sha256(callSource)
		, instrumentedRuntimeSha256: sha256(instrumented)
	}));
	t.diagnostic(JSON.stringify(observation));
});
