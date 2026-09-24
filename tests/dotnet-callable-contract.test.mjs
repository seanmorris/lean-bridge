/**
 * C# callable admission, typed public APIs and deterministic lease lifetime checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { generateDotnetBindingPackage, compileDotnetPackageModel, renderDotnetPackageLayout } from "../src/backends/dotnet/generate.mjs";
import { dotnetCallableState } from "../src/backends/dotnet/callables.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

test(".NET callables expose delegates and disposable closures without FFI", () => {
	const ir = callableReviewedIr(), model = compileDotnetPackageModel(ir), files = generateDotnetBindingPackage(ir);
	assert.equal(model.copied.surface.callbacks.size, 38);
	assert.deepEqual(files, renderDotnetPackageLayout(model));
	assert.deepEqual(files, generateDotnetBindingPackage(structuredClone(ir)));
	const api = files["src/LeanBridge.Callables/Api.cs"], runtime = files["src/LeanBridge.Callables/Runtime.cs"];
	assert.match(api, /public static void CallUnit\(Unit @value0, global::System.Action<Unit> @value1\)/);
	assert.match(api, /LeanClosure<global::System.Func<bool, string, string>> MakeString/);
	assert.doesNotMatch(api, /IntPtr|nint|DllImport|unsafe|DynamicInvoke/);
	assert.match(runtime, /ExceptionDispatchInfo.Throw\(Failure\)/);
	assert.match(runtime, /AsyncStateMachineAttribute/);
	assert.match(runtime, /GC.KeepAlive\(roots\)/);
	assert.match(runtime, /ReferenceEquals\(thread, global::System.Threading.Thread.CurrentThread\)/);
	assert.match(runtime, /if \(ProcessGuard.IsCurrent\) Dispose\(\)/);
	assert.match(runtime, /lease.Adopt\(ref pointer\)/);
});

for(const [label, change] of Object.entries({
	"retained callback": ir => { ir.declarations[0].parameters[1].lifetime.scope = "explicit"; }
	, "async callback": ir => { ir.types[0].callable.resultMode = "promise"; }
	, "higher-order callback": ir => { ir.types[0].callable.result.type = { kind: "named", id: ir.types[0].id }; }
	, "closure name collision": ir => { ir.declarations[0].name = "leanClosure"; }
})) test(`.NET callable admission rejects ${label}`, () => {
	const ir = callableReviewedIr(); change(ir); assert.throws(() => compileDotnetPackageModel(ir));
});

const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
test(".NET lease cleanup defers active close and checks process identity before locks", { skip: !existsSync(dotnet) }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-callable-contract-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	// Compile the production state machine with a controlled PID for the child-process branch.
	const state = dotnetCallableState.replace('[DllImport("libc", EntryPoint = "getpid", CallingConvention = CallingConvention.Cdecl)]', "internal static int Current = 1;")
		.replace("private static extern int GetPid();", "private static int GetPid() => Current;");
	await saveLakeFile(root, "Program.cs", `using System;
using System.Runtime.InteropServices;
${state}
static class Program {
    static int released;
    static void Check(bool value) { if (!value) throw new Exception("lease check"); }
    static void Drop(ref nint pointer) { if (pointer != 0) { ++released; pointer = 0; } }
    static void Reject(Action action) { try { action(); } catch (InvalidOperationException) { return; } throw new Exception("expected rejection"); }
    static void Main() {
        using (var frame = new CallbackFrame()) {
            var original = new Exception("identity"); frame.Failure = original;
            try { frame.ThrowIfFailed(); throw new Exception("not thrown"); } catch (Exception error) { Check(ReferenceEquals(error, original)); }
        }
        var lease = new ClosureLease(Drop); nint value = 42; lease.Adopt(ref value); Check(value == 0);
        using (var active = lease.Enter()) {
            Check(active.Pointer == 42); lease.Dispose(); lease.Dispose(); Check(lease.IsClosed && released == 0);
            try { lease.Enter(); throw new Exception("used closed lease"); } catch (ObjectDisposedException) { }
        }
        Check(released == 1); lease.Dispose(); Check(released == 1);
        var other = new ClosureLease(Drop); value = 7; other.Adopt(ref value);
        ProcessGuard.Current = 2;
        Reject(() => other.Enter()); Reject(other.Dispose); Reject(() => _ = other.IsClosed); Check(released == 1);
        ProcessGuard.Current = 1; other.Dispose(); Check(released == 2);
        Console.WriteLine("lease-contract-ok");
    }
}
`);
	await saveLakeFile(root, "Consumer.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors><UseAppHost>false</UseAppHost></PropertyGroup></Project>');
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const env = { PATH: "/unavailable", DOTNET_ROOT: dirname(dotnet), DOTNET_CLI_HOME: join(root, "cli"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(root, "packages") };
	await runCopied(dotnet, ["build", "--disable-build-servers", "-p:UseSharedCompilation=false", "--nologo"], root, env);
	assert.match((await runCopied(dotnet, ["bin/Debug/net8.0/Consumer.dll"], root, env)).stdout, /lease-contract-ok/);
});
