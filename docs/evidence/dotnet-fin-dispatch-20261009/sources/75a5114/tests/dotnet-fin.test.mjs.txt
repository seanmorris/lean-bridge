/**
 * Checked top-level Fin sites in installed, relocated .NET packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { renderCopiedDotnetPackage } from "../src/backends/dotnet/copied-values.mjs";
import { verifiedDotnetAssets } from "../src/backends/dotnet/verified-assets.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { reviewedScalarHostIr } from "./helpers/reviewed-scalar-host-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { nativeFinAdapterSymbol, nativeFinDispatchExpected, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./helpers/native-fin-dispatch.mjs";
import { nativeFinGdbExit, nativeFinGdbRecord, nativeFinGdbScript, readNativeFinGdbRecord } from "./helpers/native-fin-dispatch-gdb.mjs";
import { assertNativeFinGdbRun, nativeFinGdbCommand, observeNativeFinDispatch } from "./helpers/native-fin-dispatch-gdb-run.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

/** Public API cases: exact bounds, host exception identity, cleanup and recovery. */
const dotnetFinConsumer = () => `using System;
using System.Numerics;
using LeanBridge.NativeFin;

static class Program
{
    static int checks;
    static void Check(bool value, string label) { if (!value) throw new Exception("failed: " + label); checks++; }
    static bool Rejected(Action action, string parameter, string bound)
    {
        try { action(); }
        catch (ArgumentOutOfRangeException) { return false; }
        catch (ArgumentException error) { return error.Message == parameter + " is not below its Fin " + bound + " bound"; }
        return false;
    }
    static bool Throws<T>(Action action) where T : Exception
    {
        try { action(); }
        catch (T) { return true; }
        catch (Exception) { return false; }
        return false;
    }
    static int Main()
    {
        BigInteger huge = BigInteger.One << 70, word = BigInteger.One << 32;
        Check(Rejected(() => Api.Impossible(0), "arg0", "0"), "Fin 0 rejects zero");
        Check(Rejected(() => Api.Impossible(1), "arg0", "0"), "Fin 0 rejects one");
        Check(Api.Only(0) == 7, "Fin 1 accepts zero");
        Check(Rejected(() => Api.Only(1), "arg0", "1"), "Fin 1 rejects its bound");
        Check(Api.Mirror(0) == 9 && Api.Mirror(9) == 0, "Fin 10 endpoints");
        foreach (var value in new[] { new BigInteger(10), new BigInteger(11), word, huge })
            Check(Rejected(() => Api.Mirror(value), "arg0", "10"), "Fin 10 rejects " + value);
        Check(Throws<ArgumentOutOfRangeException>(() => Api.Mirror(-1)), "negative is the Nat ArgumentOutOfRangeException");
        Check(Api.Twice(299) == 598, "alias accepts its largest value");
        Check(Rejected(() => Api.Twice(300), "arg0", "300"), "alias rejects its bound");
        Check(Rejected(() => Api.Twice(301), "arg0", "300"), "alias rejects beyond its bound");
        Check(Api.SuccHuge(word) == word + 1, "large Fin crosses a limb");
        Check(Api.SuccHuge(huge - 2) == huge - 1 && Api.SuccHuge(huge - 1) == huge - 1, "large Fin endpoints");
        foreach (var value in new[] { huge, huge + 1, BigInteger.One << 128 })
            Check(Rejected(() => Api.SuccHuge(value), "arg0", huge.ToString()), "large Fin rejects " + value);
        Check(Api.Wrap(100) == 2 && Api.Wrap(huge) == 2 && Api.Wrap(0) == 0, "result-only Fin values");
        BigInteger start = 5; string name = "slot";
        Check(Api.Label(start, 3, name) == "slot:8", "mixed arguments");
        Check(Rejected(() => Api.Label(start, 4, name), "arg1", "4"), "mixed arguments reject the Fin site");
        Check(start == 5 && name == "slot" && Api.Label(start, 0, name) == "slot:5", "caller data unchanged");
        for (int i = 0; i < 1000; i++)
        {
            if (!Rejected(() => Api.Mirror(10 + i), "arg0", "10")) throw new Exception("invalid call accepted at " + i);
            if (Api.Mirror(i % 10) != 9 - i % 10) throw new Exception("valid call failed at " + i);
        }
        checks += 2000;
        Console.WriteLine("dotnet-fin-ok:" + checks);
        return 0;
    }
}
`;

const dotnetFinDispatchExpected = nativeFinDispatchExpected(outcome => outcome.rejected ? `rejected:${outcome.rejected[0]}<${outcome.rejected[1]}` : `ok:${outcome.ok}`);
const dotnetFinDispatchRoutes = ["public .NET methods LeanBridge.NativeFin.Api.Mirror, .Impossible and .Label through the verified RTLD_DEEPBIND NuGet loader and DllImport into the bundled C adapter"];
const dotnetLoadTrigger = "Api.Only(0) == 7: a public call outside the six counted columns, after a record with nothing armed and no entries, and before a record with all six armed and still no entries";
const unattached = "fin dispatch instrumentation is not attached\n", uncovered = "fin dispatch instrumentation did not cover the verified deployment\n";
const untriggered = "fin dispatch load trigger failed\n";
const csharpValue = value => typeof value === "string" ? JSON.stringify(value) : `N(${JSON.stringify(value.toString())})`;

/**
 * C# probe run under GDB. The CLR opens the verified deployment only at the first public call, so before
 * any call the probe requires a fresh record for this process: the expected identity digest, this
 * invocation's nonce and PID, an attached debugger, nothing armed and no entries. Its one explicit load
 * trigger is Api.Only(0), outside the six counted columns; afterwards every one of the six verified
 * definitions must be armed and still entered zero times before the first row. Every count comes from the
 * record GDB updates on each hit. The optional dynamic mode adds one owned stand-in step that calls an
 * otherwise unreferenced adapter.
 */
const dotnetFinDispatchProbe = () => `using System;
using System.Buffers.Binary;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using LeanBridge.NativeFin;

static class Probe
{
    static string record = "", nonce = "", config = "";
    static int[] expected = Array.Empty<int>();
    static byte[]? Instrumentation()
    {
        try
        {
            var bytes = File.ReadAllBytes(record);
            return bytes.Length == ${nativeFinGdbRecord.size} ? bytes : null;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or ArgumentException) { return null; }
    }
    static uint Word(byte[] bytes, int offset) => BinaryPrimitives.ReadUInt32LittleEndian(bytes.AsSpan(offset));
    static ulong[] Wide(byte[] bytes, int offset) => Enumerable.Range(0, 6).Select(k => BinaryPrimitives.ReadUInt64LittleEndian(bytes.AsSpan(offset + 8 * k))).ToArray();
    static ulong[] Entries(byte[] bytes) => Wide(bytes, 232);
    static bool Ours([NotNullWhen(true)] byte[]? bytes) => bytes is not null && Encoding.Latin1.GetString(bytes, 0, 8) == ${JSON.stringify(nativeFinGdbRecord.magic)}
        && Word(bytes, 8) == ${nativeFinGdbRecord.version} && Word(bytes, 12) == 6 && Encoding.Latin1.GetString(bytes, 16, 64) == config && Encoding.Latin1.GetString(bytes, 80, 32) == nonce
        && BinaryPrimitives.ReadInt64LittleEndian(bytes.AsSpan(112)) == Environment.ProcessId && Word(bytes, 120) == 1;
    // Exactly the given armed mask, no conflicting or foreign definition and no counted entry.
    static bool Quiet(byte[] bytes, uint armed) => Word(bytes, 124) == armed && Word(bytes, 128) == 0 && Word(bytes, 132) == 0 && Entries(bytes).All(count => count == 0);
    static bool Covered(byte[] bytes) => Wide(bytes, 136).All(count => count == 1)
        && Enumerable.Range(0, 6).Select(k => BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(184 + 4 * k))).SequenceEqual(expected);
    static int Main(string[] args)
    {
        if (args.Length is 4 or 5)
        {
            record = args[0]; nonce = args[1]; config = args[2];
            expected = args[3].Split(',').Select(index => int.TryParse(index, NumberStyles.None, CultureInfo.InvariantCulture, out var value) ? value : -1).ToArray();
        }
        var before = expected.Length == 6 ? Instrumentation() : null;
        if (!Ours(before) || !Quiet(before, 0))
        {
            Console.Error.Write(${JSON.stringify(unattached)});
            return 2;
        }
        if (!Trigger())
        {
            Console.Error.Write(${JSON.stringify(untriggered)});
            return 4;
        }
        var after = Instrumentation();
        if (!Ours(after) || !Quiet(after, 0x3f) || !Covered(after))
        {
            Console.Error.Write(${JSON.stringify(uncovered)});
            return 3;
        }
        Measure(args.Length == 5 ? args[4] : null);
        return 0;
    }
    // The explicit load trigger: a public call that counts in no column opens the verified deployment.
    [MethodImpl(MethodImplOptions.NoInlining)]
    static bool Trigger()
    {
        try { return Api.Only(0) == 7; }
        catch (Exception) { return false; }
    }
    static BigInteger N(string digits) => BigInteger.Parse(digits, NumberStyles.None, CultureInfo.InvariantCulture);
    static void Report(string step, string status)
    {
        var bytes = Instrumentation() ?? throw new InvalidOperationException("fin dispatch record is unreadable");
        Console.Out.Write(step + " " + status + " " + string.Join(" ", Entries(bytes)) + "\\n");
    }
    static string Status(Func<object> call)
    {
        try
        {
            var value = call();
            return value is BigInteger number ? "ok:" + number.ToString(CultureInfo.InvariantCulture)
                : value is string text && Regex.IsMatch(text, @"\\A[!-~]+\\z") ? "ok:" + text : "ok:unexpected";
        }
        catch (ArgumentOutOfRangeException) { return "error:ArgumentOutOfRangeException"; }
        catch (ArgumentException error)
        {
            var match = Regex.Match(error.Message, @"\\A(arg[0-9]+) is not below its Fin ([0-9]+) bound\\z");
            return match.Success ? "rejected:" + match.Groups[1].Value + "<" + match.Groups[2].Value : "error:ArgumentException";
        }
        catch (Exception error) { return "error:" + error.GetType().Name; }
    }
    [MethodImpl(MethodImplOptions.NoInlining)]
    static void Measure(string? mode)
    {
        Report("start", "ok");
${nativeFinDispatchSteps.slice(1).map(([step, name, args]) => `        Report(${JSON.stringify(step)}, Status(() => Api.${name[0].toUpperCase()}${name.slice(1)}(${args.map(csharpValue).join(", ")})));`).join("\n")}
        if (mode == "dynamic") Report("dynamic-impossible-adapter", Status(() => typeof(Api).GetMethod("DynamicImpossibleAdapter")!.Invoke(null, null)!));
    }
}
`;

const standInEvidence = libraries => ({ runtimeIdentity: sha256(".NET fin dispatch stand-in"), componentReceiptSha256: sha256(".NET fin dispatch stand-in receipt"), componentId: "native-fin@1.0.0", library: "libnative_fin.so", libraries });
const adapter = name => nativeFinAdapterSymbol("native-fin@1.0.0", `NativeFin.${name}`);
/**
 * A stand-in public API that loads through the real generated verified loader with its production flags.
 * The extra dynamic method reaches the otherwise unreferenced Fin 0 adapter by symbol lookup.
 *
 * @param libraries - Basename to SHA-256 of each stand-in library.
 */
const standInPackage = libraries => `using System;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Text;

namespace LeanBridge.NativeFin;

internal static class Native
{
    private const string Library = "native_fin";
    static Native() => NativeLibrary.SetDllImportResolver(typeof(Native).Assembly, (name, assembly, searchPath) => name == Library ? Assets.Handle : 0);
${["mirror", "impossible", "only"].map(name => `    [DllImport(Library, EntryPoint = "native_fin_${name}", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int ${name[0].toUpperCase()}${name.slice(1)}(nuint arg0, out nuint result, byte[] error);`).join("\n")}
    [DllImport(Library, EntryPoint = "native_fin_label", CallingConvention = CallingConvention.Cdecl, ExactSpelling = true)]
    internal static extern int Label(nuint arg0, nuint arg1, byte[] arg2, byte[] result, byte[] error);
    [UnmanagedFunctionPointer(CallingConvention.Cdecl)]
    private delegate nint Adapter(nint arg0);
    internal static nint DynamicImpossible() => Marshal.GetDelegateForFunctionPointer<Adapter>(NativeLibrary.GetExport(Assets.Handle, ${JSON.stringify(adapter("impossible"))}))(0);
    private static class Assets
    {
${verifiedDotnetAssets(standInEvidence(libraries))}
    }
}

public static class Api
{
    private static nuint Word(BigInteger value) => value.Sign < 0 ? throw new ArgumentOutOfRangeException(nameof(value)) : value > ulong.MaxValue ? nuint.MaxValue : (nuint)(ulong)value;
    private static string Text(byte[] buffer) => Encoding.UTF8.GetString(buffer, 0, Array.IndexOf(buffer, (byte)0));
    private static BigInteger Checked(int status, nuint result, byte[] error) => status == 0 ? (ulong)result : throw new ArgumentException(Text(error));
${["mirror", "impossible", "only"].map(name => `    public static BigInteger ${name[0].toUpperCase()}${name.slice(1)}(BigInteger arg0)
    {
        var error = new byte[64];
        var status = Native.${name[0].toUpperCase()}${name.slice(1)}(Word(arg0), out var result, error);
        return Checked(status, result, error);
    }`).join("\n")}
    public static string Label(BigInteger arg0, BigInteger arg1, string arg2)
    {
        byte[] output = new byte[64], error = new byte[64];
        var status = Native.Label(Word(arg0), Word(arg1), Encoding.UTF8.GetBytes(arg2 + "\\0"), output, error);
        return status == 0 ? Text(output) : throw new ArgumentException(Text(error));
    }
    public static BigInteger DynamicImpossibleAdapter() => (long)Native.DynamicImpossible();
}
`;
/** Stand-in Lean sources and their exported adapters, one library as in the component build. */
const standInComponent = () => `#include <stdint.h>
void *l_NativeFin_mirror(void *a0) { return (void *)(9 - (uintptr_t)a0); }
void *l_NativeFin_impossible(void *a0) { return a0; }
void *l_NativeFin_only(void *a0) { (void)a0; return (void *)7; }
void *l_NativeFin_label(void *a0, void *a1, void *a2) { (void)a2; return (void *)((uintptr_t)a0 + (uintptr_t)a1); }
void *${adapter("mirror")}(void *a0) { return l_NativeFin_mirror(a0); }
void *${adapter("impossible")}(void *a0) { return l_NativeFin_impossible(a0); }
void *${adapter("only")}(void *a0) { return l_NativeFin_only(a0); }
void *${adapter("label")}(void *a0, void *a1, void *a2) { return l_NativeFin_label(a0, a1, a2); }
`;
/**
 * The checked C entry points in the generated layout: each bound is checked before its adapter, and the
 * Fin 0 entry rejects without referencing its adapter at all. LEAK enters the mirror adapter first. The
 * stand-in trigger alone honors LEAN_BRIDGE_STAND_IN_TRIGGER=leak or =fail, for the load-trigger controls.
 */
const standInAdapter = () => `#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
void *${adapter("mirror")}(void *);
void *${adapter("only")}(void *);
void *${adapter("label")}(void *, void *, void *);
static volatile uintptr_t fin1 = 1, fin4 = 4, fin10 = 10;
static int reject(char *error, const char *message) { snprintf(error, 64, "%s", message); return 1; }
int native_fin_mirror(uintptr_t arg0, uintptr_t *out, char *error) {
#ifdef LEAK
  if (arg0 >= fin10) (void)${adapter("mirror")}((void *)arg0);
#endif
  if (arg0 >= fin10) return reject(error, "arg0 is not below its Fin 10 bound");
  *out = (uintptr_t)${adapter("mirror")}((void *)arg0); return 0;
}
int native_fin_impossible(uintptr_t arg0, uintptr_t *out, char *error) { (void)arg0; (void)out; return reject(error, "arg0 is not below its Fin 0 bound"); }
int native_fin_only(uintptr_t arg0, uintptr_t *out, char *error) {
  const char *trigger = getenv("LEAN_BRIDGE_STAND_IN_TRIGGER");
  if (trigger && strcmp(trigger, "leak") == 0) (void)${adapter("mirror")}((void *)0);
  if (trigger && strcmp(trigger, "fail") == 0) return reject(error, "stand-in trigger failure");
  if (arg0 >= fin1) return reject(error, "arg0 is not below its Fin 1 bound");
  *out = (uintptr_t)${adapter("only")}((void *)arg0); return 0;
}
int native_fin_label(uintptr_t arg0, uintptr_t arg1, const char *arg2, char *out, char *error) {
  if (arg1 >= fin4) return reject(error, "arg1 is not below its Fin 4 bound");
  snprintf(out, 64, "%s:%lu", arg2, (unsigned long)(uintptr_t)${adapter("label")}((void *)arg0, (void *)arg1, (void *)arg2)); return 0;
}
`;

/**
 * Restore and build one C# probe project offline; the stand-in carries its own API, the installed probe
 * references the prepared package from its relocated feed only.
 *
 * @param root0 - Project inputs.
 * @param root0.command - The .NET SDK host.
 * @param root0.root - Task-owned project directory.
 * @param root0.sources - C# file name to source.
 * @param root0.env - Clean SDK environment.
 * @param root0.reference - Optional { name, version, feed } of the prepared package.
 * @param root0.properties - Optional extra MSBuild properties.
 */
const buildDotnetProbe = async ({ command, root, sources, env, reference = null, properties = "" }) => {
	await saveLakeFile(root, "Probe.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems>${properties}</PropertyGroup><ItemGroup>${Object.keys(sources).map(name => `<Compile Include="${name}"/>`).join("")}${reference ? `<PackageReference Include="${reference.name}" Version="[${reference.version}]"/>` : ""}</ItemGroup></Project>`);
	for(const [name, source] of Object.entries(sources)) await saveLakeFile(root, name, source);
	await saveLakeFile(root, "NuGet.Config", `<configuration><packageSources><clear/>${reference ? `<add key="prepared" value="${reference.feed}"/>` : ""}</packageSources><fallbackPackageFolders><clear/></fallbackPackageFolders></configuration>`);
	await runCopied(command, ["restore", "--configfile", "NuGet.Config"], root, env);
	await runCopied(command, ["build", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], root, env);
	return join(root, "out/Probe.dll");
};
const dotnetEnvironment = (command, home) => ({ ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(home, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(home, "packages") });
const dotnetProbeArgv = (command, probe) => ({ record, nonce, configSha256, definerIndices, mode }) => [command, probe, record, nonce, configSha256, definerIndices.join(","), ...mode ? [mode] : []];
// The generated loader's own choice: runtimes/linux-x64/native under the application, else the application directory.
const dotnetNativeRoot = (application, library) => [join(application, "runtimes/linux-x64/native"), application].find(path => existsSync(join(path, library)));

test(".NET packages are checked Fin consumers beside C, C++, Python, Rust and Ruby", () => {
	for(const targets of [["nuget"], ["c", "nuget"], ["c", "cpp", "pypi", "cargo", "rubygems", "nuget"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	assert.equal(supportsNativeRefinementTargets(["nuget", "cpan"]), true);
});

test("generated .NET bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	const files = renderCopiedDotnetPackage(compileCopiedDotnetModel(ir));
	const api = Object.entries(files).find(([path, source]) => path.endsWith(".cs") && source.includes("public static class Api"))[1];
	assert.match(api, / {4}\/\/\/ <remarks>Checked Lean Fin bounds: value1 &lt; 4\.<\/remarks>\n {4}public static string Label\(/);
	assert.doesNotMatch(api, /bounds:[^\n]*\n {4}public static [^\n]* Plain\(/);
	assert.match(files["README.md"], /Lean Fin n parameters and results are System\.Numerics\.BigInteger values below n\./);
	assert.match(files["README.md"], /\n- LeanBridge\.Fins\.Api\.Label: value1 < 4\n/);
	// A top-level Subtype documents its checked constructor; one inside a container is refused.
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	const checked = renderCopiedDotnetPackage(compileCopiedDotnetModel(ir));
	assert.match(checked["README.md"], /checked by Fins\.check/);
	assert.match(checked["README.md"], /Lean Subtype parameters cross as their base value\./);
	assert.doesNotMatch(checked["README.md"], /Lean Fin n parameters/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "array", arguments: [{ kind: "subtype", constructor: "Fins.check" }] }, null], result: null };
	assert.throws(() => renderCopiedDotnetPackage(compileCopiedDotnetModel(ir)), TypeError);
});

// The configured .NET SDK, as in the installed acceptance.
const standInDotnet = nativeFixtureEnvironment([]).LEAN_BRIDGE_DOTNET;
const standInMissing = !existsSync(standInDotnet) ? `no .NET SDK at ${standInDotnet}`
	: process.platform !== "linux" || process.arch !== "x64" ? "GDB entry counters target x86_64 Linux"
		: !existsSync(nativeFinGdbCommand) ? `no debugger at ${nativeFinGdbCommand}; entry-breakpoint controls need GDB with ptrace` : false;
// The gated installed acceptance requires these controls; only an ungated run may skip them.
const standInSkip = process.env.LEAN_BRIDGE_DOTNET_FIN_TEST === "1" ? false : standInMissing;
test("GDB entry breakpoints count a deep-bound .NET stand-in after its explicit load trigger and refuse missing, early, stale, foreign and leaking runs", { skip: standInSkip, timeout: 900_000 }, async t => {
	assert.equal(standInMissing, false, `the gated .NET Fin acceptance requires its stand-in controls: ${standInMissing}`);
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-fin-gdb-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, componentId = "native-fin@1.0.0", env = dotnetEnvironment(standInDotnet, root);
	const cc = args => runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-shared", "-fPIC", ...args], root, tools);
	await saveLakeFile(root, "src/component.c", standInComponent());
	await saveLakeFile(root, "src/adapter.c", standInAdapter());
	await saveLakeFile(root, "src/runtime.c", "int lean_bridge_stand_in_runtime(void) { return 0; }\n");
	const deployments = {};
	for(const [variant, flags] of [["package", []], ["leaking", ["-DLEAK"]]])
	{
		const staged = join(root, variant, "native");
		await mkdir(staged, { recursive: true });
		await cc([join(root, "src/runtime.c"), "-o", join(staged, "libleanshared.so")]);
		await cc([join(root, "src/runtime.c"), "-o", join(staged, "liblean_bridge_native.so")]);
		await cc([join(root, "src/component.c"), "-o", join(staged, "libcomponent_stand_in.so")]);
		await cc([...flags, join(root, "src/adapter.c"), "-L", staged, "-l:libcomponent_stand_in.so", "-Wl,-rpath,$ORIGIN", "-o", join(staged, "libnative_fin.so")]);
		const libraries = Object.fromEntries(await Promise.all((await readdir(staged)).sort().map(async name => [name, sha256(await readFile(join(staged, name)))])));
		const probe = await buildDotnetProbe({ command: standInDotnet, root: join(root, variant, "probe"), sources: { "dispatch.cs": dotnetFinDispatchProbe(), "standin.cs": standInPackage(libraries) }, env });
		// Deployed where the generated loader looks first, beside the application.
		const native = join(dirname(probe), "runtimes/linux-x64/native");
		await mkdir(native, { recursive: true });
		for(const name of Object.keys(libraries)) await cp(join(staged, name), join(native, name));
		assert.equal(dotnetNativeRoot(dirname(probe), "libnative_fin.so"), native);
		deployments[variant] = { probe, native };
	}
	// The same probe source also compiles against the generated copied API, not only against the stand-in.
	const exported = [["impossible", ["nat"], "nat"], ["only", ["nat"], "nat"], ["mirror", ["nat"], "nat"], ["label", ["nat", "nat", "string"], "string"]];
	const ir = corpusReviewedIr({ id: "native-fin" }, exported.map(([name, parameters, result]) => ({ name: `NativeFin.${name}`, parameters, result })));
	const generated = Object.entries(renderCopiedDotnetPackage(compileCopiedDotnetModel(ir))).filter(([path]) => path.endsWith(".cs"));
	assert.deepEqual(generated.map(([path]) => basename(path)).sort(), ["Api.cs", "Runtime.cs"]);
	const properties = "<AllowUnsafeBlocks>true</AllowUnsafeBlocks><EnableNETAnalyzers>false</EnableNETAnalyzers>";
	const sources = { "dispatch.cs": dotnetFinDispatchProbe(), ...Object.fromEntries(generated.map(([path, source]) => [basename(path), source])) };
	await buildDotnetProbe({ command: standInDotnet, root: join(root, "generated"), sources, env, properties });
	// As generated, nothing in the deployment references the Fin 0 adapter.
	const relocations = (await runCopied("/usr/bin/readelf", ["-rW", join(deployments.package.native, "libnative_fin.so")], root, tools)).stdout;
	assert.ok(relocations.includes(adapter("mirror")) && !relocations.includes(adapter("impossible")));
	const observe = (variant, probe, definers = null) => observeNativeFinDispatch({
		probeRoot: join(root, probe)
		, nativeDirectory: deployments[variant].native
		, componentId
		, argv: dotnetProbeArgv(standInDotnet, deployments[variant].probe)
		, cwd: root
		, env
		, definers
	});
	const observer = await observe("package", "probe");
	assert.deepEqual(observer.identity.definers, Array(6).fill("libcomponent_stand_in.so"));
	const refused = (run, code, stderr) => {
		assert.equal(run.code, code, run.output);
		assert.equal(run.stdout ?? "", ""); if(stderr !== null) assert.equal(run.stderr, stderr);
	};
	// Without GDB no record exists, and the probe refuses before its load trigger.
	const missing = await observer.run({ gdb: false });
	refused(missing, 2, unattached);
	assert.equal(existsSync(missing.record), false);
	// Under the production deep-bound flags all six entries are armed by the trigger, including the unreferenced adapter.
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, accepted.output); assert.equal(accepted.stderr, "");
	const observed = readNativeFinDispatch(accepted.stdout, dotnetFinDispatchExpected);
	assert.deepEqual(observed, dotnetFinDispatchExpected);
	const breakpoints = await assertNativeFinGdbRun(observer, accepted, observed);
	assert.equal(breakpoints.length, 6);
	// A record carrying any other PID than the one GDB armed is refused.
	const foreignPid = await readFile(accepted.record);
	foreignPid.writeBigInt64LE(foreignPid.readBigInt64LE(112) + 1n, 112);
	await writeFile(join(root, "foreign-pid.record"), foreignPid, { flag: "wx" });
	await assert.rejects(() => assertNativeFinGdbRun(observer, { ...accepted, record: join(root, "foreign-pid.record") }, observed), /the record belongs to the instrumented inferior/u);
	// A deployment loaded and armed before the probe's gate is refused: nothing may be armed before the trigger.
	const libraries = observer.identity.libraries.map(name => join(deployments.package.native, name)).join(":");
	const early = await observer.run({ extra: { LD_PRELOAD: libraries } });
	refused(early, 2, unattached);
	assert.equal(readNativeFinGdbRecord(await readFile(early.record)).armed, 0x3f);
	// A trigger that enters a counted column, or that fails, yields no rows.
	const leakyTrigger = await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_TRIGGER: "leak" } });
	refused(leakyTrigger, 3, uncovered);
	assert.deepEqual(readNativeFinGdbRecord(await readFile(leakyTrigger.record)).entries, [1, 0, 0, 1, 0, 0]);
	const failedTrigger = await observer.run({ extra: { LEAN_BRIDGE_STAND_IN_TRIGGER: "fail" } });
	refused(failedTrigger, 4, untriggered);
	// A failed count write or arming callback ends the run with 71, so no rows are accepted.
	const lost = await observer.run({ inject: { write: 3 } });
	assert.equal(lost.code, nativeFinGdbExit.instrumentation, lost.output);
	assert.match(lost.output, /fin instrumentation refused: entry count for column \d failed: injected record write failure/u);
	assert.throws(() => readNativeFinDispatch(lost.stdout ?? "", dotnetFinDispatchExpected), TypeError);
	const unarmed = await observer.run({ inject: { arm: true } });
	assert.equal(unarmed.code, nativeFinGdbExit.instrumentation, unarmed.output);
	assert.match(unarmed.output, /fin instrumentation refused: instrumentation callback failed: injected arming failure/u);
	assert.equal(unarmed.stdout, "");
	// A computed-address call of the otherwise unreferenced Fin 0 adapter is an actual counted entry.
	const dynamic = await observer.run({ mode: "dynamic" });
	assert.equal(dynamic.code, 0, dynamic.output);
	const extended = [...dotnetFinDispatchExpected, ["dynamic-impossible-adapter", "ok:0", [2, 1, 2, 2, 1, 2]]];
	assert.equal(dynamic.stdout, extended.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join(""));
	assert.deepEqual(readNativeFinGdbRecord(await readFile(dynamic.record)).entries, [2, 1, 2, 2, 1, 2]);
	// A stale valid record is never adopted, with a fresh nonce or with its own nonce replayed.
	const stale = await readFile(accepted.record);
	for(const nonce of [undefined, accepted.nonce])
	{
		const attempt = await observer.run({ nonce, before: path => writeFile(path, stale, { flag: "wx" }) });
		refused(attempt, nativeFinGdbExit.refusedRecord, null);
		assert.match(attempt.output, /fin instrumentation refused: \[Errno 17\] File exists/u);
		assert.ok((await readFile(attempt.record)).equals(stale), "the stale record is untouched");
	}
	// GDB rooted elsewhere arms nothing in the loaded deployment.
	refused(await observer.run({ root: deployments.leaking.native }), 3, uncovered);
	// Adapters configured in the wrong library are reported as foreign and never armed.
	const misplaced = Object.fromEntries(nativeFinDispatchSymbols(componentId).map((symbol, k) => [symbol, k < 3 ? "libcomponent_stand_in.so" : "libnative_fin.so"]));
	const wrong = await observe("package", "wrong", misplaced);
	const misarmed = await wrong.run();
	refused(misarmed, 3, uncovered);
	const partial = readNativeFinGdbRecord(await readFile(misarmed.record));
	assert.deepEqual([partial.armed, partial.foreign, partial.breakpoints], [0b000111, 3, [1, 1, 1, 0, 0, 0]]);
	// A C entry point that enters its adapter before rejecting is caught at its first invalid row.
	const leaking = await observe("leaking", "leak");
	const leak = await leaking.run();
	assert.equal(leak.code, 0, leak.output);
	assert.match(leak.stdout, /^invalid-mirror-bound rejected:arg0<10 1 0 0 1 0 0$/mu);
	assert.throws(() => readNativeFinDispatch(leak.stdout, dotnetFinDispatchExpected), /invalid-mirror-bound was rejected but changed counts by 1 0 0 1 0 0/u);
});

const checkInstalledDotnetFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "dotnet"]), reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, nuget: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and NuGet package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "nuget"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		// The NuGet package bundles the exact checked adapter that the C, Python and Rust probes instrument.
		const packages = receipt.packages.filter(pkg => pkg.target === "nuget");
		const nupkg = join(consumer, "nupkg");
		await saveLakeFile(nupkg, ".keep", "");
		await runCopied("/usr/bin/unzip", ["-q", join(handoff, packages.find(pkg => pkg.role === "component").artifacts[0].path), "-d", nupkg], consumer);
		const nativeDirectory = join(nupkg, "runtimes/linux-x64/native");
		const packageLibraries = Object.fromEntries(await Promise.all((await readdir(nativeDirectory)).filter(name => /\.so(?:\.|$)/.test(name))
			.map(async name => [name, sha256(await readFile(join(nativeDirectory, name)))])));
		const shared = Object.keys(packageLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ nuget: packageLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(packageLibraries[name], cLibraries[name], name);
		const docs = (await Promise.all((await readdir(nupkg, { recursive: true })).filter(path => path.endsWith(".xml")).map(path => readFile(join(nupkg, path), "utf8")))).join("\n");
		assert.match(docs, /Checked Lean Fin bounds: arg0 &lt; 10; result &lt; 10\./);
		t.diagnostic("offline NuGet restore and build without producer files or Lean/C compilers");
		const fixture = { source: dotnetFinConsumer, success: "dotnet-fin-ok" };
		const { command, ...observation } = await installCopiedConsumer({ profile: "dotnet", consumer, handoff, packages, environment, fixture });
		const root = join(consumer, "dotnet"), relocated = join(consumer, "dotnet-relocated");
		await rename(root, relocated);
		const env = { ...copiedCleanEnvironment, DOTNET_ROOT: join(command, ".."), DOTNET_CLI_HOME: join(relocated, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
		const repeated = await runCopied(command, ["out/Consumer.dll"], relocated, env);
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `dotnet-fin-ok:${observation.checks}`);
		// The counted adapters are the model's own exports for this component identity.
		assert.equal(model.component.id, "native-fin@1.0.0");
		for(const name of ["mirror", "impossible", "label"])
			assert.equal(model.exports.find(item => item.name === `NativeFin.${name}`).symbol, nativeFinAdapterSymbol(model.component.id, `NativeFin.${name}`), name);
		t.diagnostic("per-step source and adapter counts in a relocated .NET process under GDB entry breakpoints");
		// The NuGet loader opens these libraries with RTLD_DEEPBIND, which bypasses LD_PRELOAD; installed entry
		// counts need GDB with ptrace, and their absence fails this gated acceptance, never skips it.
		assert.ok(existsSync(nativeFinGdbCommand), `GDB is required at ${nativeFinGdbCommand} for installed .NET entry counts; set LEAN_BRIDGE_GDB, and ptrace must be permitted`);
		// A separate probe restores the prepared package offline from the relocated feed only.
		const component = packages.find(pkg => pkg.role === "component");
		const probeRoot = join(relocated, "probe");
		const reference = { name: component.name, version: component.version, feed: join(relocated, "feed") };
		const probeEnv = { ...env, NUGET_PACKAGES: join(probeRoot, "packages") };
		const probe = await buildDotnetProbe({ command, root: probeRoot, sources: { "dispatch.cs": dotnetFinDispatchProbe() }, env: probeEnv, reference });
		const probeNative = dotnetNativeRoot(dirname(probe), "libnative_fin.so");
		assert.equal(probeNative, join(dirname(probe), "runtimes/linux-x64/native"));
		// The verified root holds exactly the package's native files, byte for byte.
		const deployed = Object.fromEntries(await Promise.all((await readdir(probeNative)).sort().map(async name => [name, sha256(await readFile(join(probeNative, name)))])));
		assert.deepEqual(deployed, Object.fromEntries(Object.keys(packageLibraries).sort().map(name => [name, packageLibraries[name]])));
		const observer = await observeNativeFinDispatch({
			probeRoot: join(consumer, "dispatch")
			, nativeDirectory: probeNative
			, componentId: model.component.id
			, argv: dotnetProbeArgv(command, probe)
			, cwd: probeRoot
			, env
		});
		// Without GDB the probe refuses before its load trigger, and no record appears.
		const missing = await observer.run({ gdb: false });
		assert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, ""); assert.equal(missing.stderr, unattached);
		assert.equal(existsSync(missing.record), false);
		const accepted = await observer.run();
		assert.equal(accepted.code, 0, `instrumented probe failed (2 armed before the trigger, 3 uncovered, 4 trigger failed, 70 stale record, 71 ptrace or instrumentation, 72 signal): ${accepted.output}`);
		assert.equal(accepted.stderr, "");
		const observed = readNativeFinDispatch(accepted.stdout, dotnetFinDispatchExpected);
		assert.deepEqual(observed, dotnetFinDispatchExpected);
		const breakpoints = await assertNativeFinGdbRun(observer, accepted, observed);
		const dispatch = {
			columns: observer.identity.columns
			, observed
			, instrument: "gdb-breakpoints"
			, instrumentation: "in-memory int3 breakpoints at each verified definition; deployed files and the production loader are unchanged"
			, routes: dotnetFinDispatchRoutes
			, loadTrigger: dotnetLoadTrigger
			, positiveControl: "valid public .NET calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column"
			, probeSha256: sha256(dotnetFinDispatchProbe())
			, scriptSha256: sha256(nativeFinGdbScript)
			, configSha256: observer.configSha256
			, gdb: { version: (await runCopied(nativeFinGdbCommand, ["--version"], relocated, copiedCleanEnvironment)).stdout.split("\n")[0], sha256: sha256(await readFile(await realpath(nativeFinGdbCommand))) }
			, definers: observer.identity.definers
			, breakpoints
			, libraries: Object.fromEntries(observer.identity.libraries.map(name => [name, deployed[name]]))
			, scope: "x86_64 Linux with GDB and ptrace"
		};
		reports.push({ profile: "dotnet"
			, path: reviewed ? "reviewed-ir" : "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, packageLibraries[name]]))
			, dispatch
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "dotnet-reviewed.json" : "dotnet.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free .NET packages check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_DOTNET_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledDotnetFin(t));

test("independently reviewed Dotnet packages check scalar Fin through installed consumers", { skip: process.env.LEAN_BRIDGE_DOTNET_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledDotnetFin(t, true));
