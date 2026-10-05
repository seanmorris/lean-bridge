/**
 * Actual Lean results retain and consume their original C# whole owners.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedDotnetCalls } from "../src/backends/dotnet/owned-calls.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { compileOwnedDotnetFixture } from "./helpers/owned-dotnet-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const options = { transferredInputs: true, anchoredResults: true };
const optimizedProject = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>true</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><Optimize>true</Optimize><TieredCompilation>false</TieredCompilation></PropertyGroup></Project>';

test("C# whole owners require capability and preserve unanchored generated APIs", () => {
	const ir = ownedRustBorrowReviewedIr(), original = structuredClone(ir);
	assert.throws(() => generateOwnedDotnetCalls(ir, { transferredInputs: true }), /explicit output leases/u);
	const model = generateOwnedDotnetCalls(ir, options);
	assert.deepEqual(ir, original);
	assert.equal(model.c.functions.filter(fn => fn.anchor !== undefined).length, 19);
	assert.match(model.files["Values.cs"], /public sealed class Value<T>/u);
	assert.match(model.files["Calls.cs"], /&moves\.Slot\(0\)/u);
	assert.doesNotMatch(model.files["Calls.cs"], /preparedOwner/u);
	const reordered = structuredClone(ir); reordered.types.reverse();
	assert.deepEqual(generateOwnedDotnetCalls(reordered, options).files, model.files);
	assert.deepEqual(generateOwnedDotnetCalls(ownedAggregateReviewedIr(), options).files, generateOwnedDotnetCalls(ownedAggregateReviewedIr()).files);
});

for(const mode of ["ordinary", "reviewed"]) test(`C# borrowed results expire with original owners (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const compiled = await compileOwnedDotnetFixture(t, {
		...mode === "ordinary" ? { configuration: await ownedRustBorrowConfiguration() } : { reviewedIr: ownedRustBorrowReviewedIr() }
		, ...options, sourceSuffix: ownedRustBorrowSource
		, evidenceName: `dotnet-borrows-${mode}-inputs.json`
	});
	const source = await readFile("tests/fixtures/structured-types/owned-dotnet-borrows.cs", "utf8");
	const instrument = source => {
		const checkpoint = "internal static void Checkpoint() { }";
		const validated = "if (global::System.Threading.Volatile.Read(ref closed) != 0) OwnedRuntime.Check(4);";
		assert.equal(source.split(checkpoint).length, 2);
		assert.equal(source.split(validated).length, 2);
		return source.replace(checkpoint, "internal static void Checkpoint() { global::Program.Allocation(); }")
			.replace(validated, validated + "\n        global::Program.AfterWholeReadCheck();");
	};
	let observed;
	try
	{
		const execute = await compiled.compile({ "Program.cs": source, "Lifetime.cs": instrument(compiled.model.files["Lifetime.cs"]), "Calls.csproj": optimizedProject });
		const result = await execute("borrows"); assert.equal(result.stderr, "");
		observed = JSON.parse(result.stdout);
	}
	catch(error)
	{ throw new Error(`${error.message}: ${JSON.stringify(error.details)}`, { cause: error }); }
	assert.ok(observed.checks > 100);
	assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
	for(const key of ["managedBefore", "managedAfter", "nativeBefore", "nativeAfter"])
		assert.ok(observed[key] > 0, key);
	const mutations = [
		["unchecked-whole-value", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (global::System.Threading.Volatile.Read(ref closed)"]
		, ["unchecked-empty-value", "Lifetime.cs", "        Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)", "        if (snapshot is null || snapshot.Value is not global::System.Array { Length: 0 }) Lease.Require();\n        if (global::System.Threading.Volatile.Read(ref closed)"]
		, ["escaped-callback-frame", "Lifetime.cs", "    public void Dispose() { scope.Active = false; }", "    public void Dispose() { scope.Active = true; }"]
		, ["wrapper-equality", "Values.cs", "        return equal(Handle, other.Handle);", "        return global::System.Object.ReferenceEquals(this, other);"]
		, ["late-whole-value-read", "Lifetime.cs", "        return snapshot!.Value;", "        return global::System.Threading.Volatile.Read(ref payload) is { } late ? late.Value : default!;"]
		, ["unrooted-whole-receiver", "Values.cs", "global::System.GC.KeepAlive(this);", ";"]
	];
	const rejectedMutations = [];
	for(const [name, path, before, after] of mutations)
	{
		const original = compiled.model.files[path]; assert.ok(original.includes(before), name);
		const changed = original.replaceAll(before, after);
		const files = { ...compiled.model.files, [path]: changed, "Program.cs": source };
		files["Lifetime.cs"] = instrument(files["Lifetime.cs"]);
		const execute = await compiled.compile(files);
		await assert.rejects(execute("borrows"), error => {
			assert.match(error.details.stderr, /Expected LeanBridgeException|callback borrow is closed|resource equality uses native identity|whole read remains a snapshot|temporary whole owner remains alive/u);
			return true;
		});
		rejectedMutations.push({ name, compiled: true, sourceSha256: sha256(changed) });
	}
	t.diagnostic(JSON.stringify(observed));
	await saveLakeFile(resolve("build/owned-dotnet-borrows"), `${mode}.json`, canonicalJson({
		mode, actualLean: true, installedPackage: false, observed, rejectedMutations
		, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
		, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
		, nativeProbeSha256: sha256(compiled.implementation)
		, loaderSha256: sha256(compiled.loader), probeSha256: sha256(source)
		, optimizedProject, optimizedProjectSha256: sha256(optimizedProject)
	}));
});

test("C# borrowed results compile and execute without input transfers", {
	skip: process.env.LEAN_BRIDGE_OWNED_DOTNET_BORROW_TEST !== "1", timeout: 900000
}, async t => {
	const probe = `using System;
using System.Runtime.InteropServices;
using LeanBridge.OwnedAggregates;
using LeanBridge.OwnedAggregates.Interop;
internal static unsafe class Program
{
    internal static void Allocation() { }
    private static void Main(string[] args)
    {
        var library = NativeLibrary.Load(args[0]); OwnedLoader.Bindings = new OwnedBindings(library);
        var runtime = OwnedLoader.Bindings.Runtime;
        using var original = Api.CopyEchoArrayResult(Array.Empty<Ticket>());
        using var view = Api.EchoArray(original);
        using var independent = view.Retain();
        original.Dispose();
        if (!view.IsClosed || independent.IsClosed || independent.Get().Length != 0) throw new Exception("empty whole owner");
        try { view.Get(); throw new Exception("expired empty value exposed"); }
        catch (LeanBridgeException error) when (error.Status == 4) { }
        using var seed = Api.NewTicket(42, "borrow-only");
        using var owner = Api.CopyValue(new Bundle(seed.Get(), Option<Ticket>.None, Array.Empty<Ticket>(), Array.Empty<Ticket>(), new Payload(0, Array.Empty<byte>())));
        using var callback = Api.CallbackRecord(owner, value => value);
        using var closure = Api.MakeRecord(owner);
        using var retained = closure.Retain();
        owner.Dispose();
        if (!callback.IsClosed || !closure.IsClosed) throw new Exception("original owner lifetime");
        using var result = retained.Get().Invoke(true, new Bundle(seed.Get(), default, Array.Empty<Ticket>(), Array.Empty<Ticket>(), new Payload(0, Array.Empty<byte>())));
        if (Api.Serial(result.Get().Primary) != 42) throw new Exception("independent closure");
        foreach (var value in new IDisposable[] { original, view, independent, seed, owner, callback, closure, retained, result }) value.Dispose();
        runtime.Current.Dispose();
        var live = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_live");
        var identities = (delegate* unmanaged[Cdecl]<nuint>)NativeLibrary.GetExport(library, "probe_identities");
        if (live() != 0 || identities() != 0) throw new Exception("borrow-only leaks");
        Console.WriteLine("borrow-only-ok");
    }
}
`;
	const observations = [];
	for(const mode of ["ordinary", "reviewed"])
	{
		const compiled = await compileOwnedDotnetFixture(t, {
			...mode === "ordinary" ? { configuration: await ownedBorrowConfiguration() } : { reviewedIr: ownedBorrowReviewedIr() }
			, anchoredResults: true
			, evidenceName: `dotnet-borrow-only-${mode}-inputs.json`
		});
		const execute = await compiled.compile({ "Program.cs": probe });
		const result = await execute("borrow-only");
		assert.deepEqual(result, { code: 0, stdout: "borrow-only-ok\n", stderr: "" });
		observations.push({ mode, actualLean: true, installedPackage: false
			, input: { metadata: compiled.metadata, sourceIdentity: compiled.sourceIdentity, component: compiled.model.c.native.model.component }
			, generated: Object.fromEntries(Object.entries(compiled.model.files).map(([path, text]) => [path, sha256(text)]))
			, nativeProbeSha256: sha256(compiled.implementation)
			, loaderSha256: sha256(compiled.loader)
			, stdout: result.stdout });
	}
	await saveLakeFile(resolve("build/owned-dotnet-borrows"), "borrow-only.json", canonicalJson({ probe, probeSha256: sha256(probe), observations }));
});
