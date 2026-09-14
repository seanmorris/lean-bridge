/**
 * Ordinary NuGet packages: real Lean, exact copied types and offline consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compileCopiedDotnetModel, validateOrdinaryNugetSettings } from "../src/backends/dotnet/copied-model.mjs";
import { generateDotnetBindingPackage, compileDotnetPackageModel, renderDotnetPackageLayout } from "../src/backends/dotnet/generate.mjs";
import { packageOrdinaryNuget } from "../src/release/native-nuget.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_NATIVE_DOTNET_TEST === "1";
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const dotnet = process.env.LEAN_BRIDGE_DOTNET ?? "dotnet";
const environment = { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: '["/must/not/invoke/perl"]' };
const run = (command, args, cwd, env = environment) => processBuildRunner.capture({ command, args, cwd, env });
const json = async path => JSON.parse(await readFile(path, "utf8"));
const synthetic = () => createNativeModel({ ...nativeMetadataFixture(), component: { id: "example@1.0.0", name: "example", version: "1.0.0" } }).bindingIr;

test("ordinary .NET generation is deterministic, source-named and hides FFI", () => {
	const ir = synthetic(), files = generateDotnetBindingPackage(ir);
	assert.deepEqual(files, generateDotnetBindingPackage(structuredClone(ir)));
	assert.deepEqual(files, renderDotnetPackageLayout(compileDotnetPackageModel(ir)));
	assert.match(files["src/LeanBridge.Example/Api.cs"], /public static uint Increment\(uint @arg0\)/);
	assert.doesNotMatch(files["src/LeanBridge.Example/Api.cs"], /Alpha|Perl|IntPtr|nint|DllImport|unsafe/);
	assert.match(files["src/LeanBridge.Example/Runtime.cs"], /EntryPoint = "example_increment"/);
	assert.match(files["src/LeanBridge.Example/Runtime.cs"], /NativeMemory.Free/);
	assert.match(files["NuGet.Config"], /<clear \/>/);
});

test("ordinary .NET admission rejects collisions and unsafe package coordinates", () => {
	for(const name of ["Api", "getType", "Equals"])
	{
		const ir = synthetic(); ir.declarations[0].name = name;
		assert.throws(() => compileCopiedDotnetModel(ir), error => error.code === "unsupported-dotnet-signature" && error.details.source.path === "Sample.lean");
	}
	for(const settings of [{ name: "../escape" }, { name: "$(unsafe)" }, { name: "a".repeat(101) }, { version: "01.0.0" }, { version: "1.0.0+metadata" }, { version: "1.0" }]) assert.throws(() => validateOrdinaryNugetSettings(settings));
	validateOrdinaryNugetSettings({ name: "Acme.Example-Tools", version: "1.2.3-rc.1" });
});

const scalars = [
	["unit", "Unit", "Unit", "default(Unit)"], ["bool", "Bool", "bool", "true"]
	, ["u8", "UInt8", "byte", "byte.MaxValue"]
	, ["u16", "UInt16", "ushort", "ushort.MaxValue"]
	, ["u32", "UInt32", "uint", "uint.MaxValue"]
	, ["u64", "UInt64", "ulong", "ulong.MaxValue"]
	, ["i8", "Int8", "sbyte", "sbyte.MinValue"]
	, ["i16", "Int16", "short", "short.MinValue"]
	, ["i32", "Int32", "int", "int.MinValue"]
	, ["i64", "Int64", "long", "long.MinValue"]
	, ["nat", "Nat", "BigInteger", "(BigInteger.One << 4096) + 1"]
	, ["integer", "Int", "BigInteger", "-(BigInteger.One << 4096) - 1"]
	, ["f32", "Float32", "float", "-0.0f"], ["f64", "Float", "double", "-0.0"]
	, ["text", "String", "string", '"a\\0λ🌿"']
	, ["bytes", "ByteArray", "byte[]", "new byte[] { 0, 255, 128 }"]
];
const cap = name => name[0].toUpperCase() + name.slice(1);

const project = async (root, name) => {
	await saveLakeFile(root, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(root, "lakefile.toml", `name = "${name.toLowerCase()}"\nversion = "1.2.3"\n[[lean_lib]]\nname = "${name}"\n`);
	await saveLakeFile(root, `${name}.lean`, `namespace ${name}
structure Leaf where
${(name === "Aurora" ? scalars : [...scalars].reverse()).map(([label, type]) => `  v_${label} : ${type}`).join("\n")}
structure Packet where
  title : String
  leaf : Leaf
  rows : Array (Array Leaf)
structure Word where
  bits : ${name === "Aurora" ? "UInt32" : "UInt64"}
structure Empty where
${scalars.map(([label, type]) => `def echo_${label} (value : ${type}) := value\ndef array_${label} (value : Array ${type}) := value`).join("\n")}
def echo_record (value : Packet) := value
def choose (left right : Packet) (pick : Bool) := if pick then left else right
def echo_rows (value : Array (Array Leaf)) := value
def echo_word (value : Word) := value
def echo_empty (value : Empty) := value
def echo_words (value : Array Word) := value
def echo_markers (value : Array Empty) := value
def grow (value : String) : Array String := #[value, value]
def matrix (value : Array UInt32) : Array (Array UInt32) := #[value, value.reverse]
def answer : UInt64 := 18446744073709551615
def duplicate {α : Type} [Add α] (value : α) : α := value + value
theorem echo_rows_spec (value : Array (Array Leaf)) : echo_rows value = value := rfl
end ${name}
`);
	await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: [name]
		, exports: [...scalars.flatMap(([label]) => [`${name}.echo_${label}`, `${name}.array_${label}`]), ...["echo_record", "choose", "echo_rows", "echo_word", "echo_empty", "echo_words", "echo_markers", "grow", "matrix", "answer", "double_word"].map(fn => `${name}.${fn}`)]
		, specializations: [{ name: `${name}.double_word`, declaration: `${name}.duplicate`, types: ["UInt32"] }]
		, targets: { nuget: { name: `Acme.${name}`, version: "2.0.0-rc.1" }, c: { name: `${name.toLowerCase()}-c`, version: "1.0.0" } } }));
};

const consumer = name => `using System;
using System.IO;
using System.Linq;
using System.Numerics;
using System.Threading.Tasks;
using ${"LeanBridge." + name};

static class Program
{
    static void Check(bool condition) { if (!condition) throw new Exception("check failed"); }
    static void Reject<T>(Action call) where T : Exception { try { call(); } catch (T) { return; } throw new Exception("accepted invalid input"); }
    static void Equal<T>(T actual, T expected) { if (actual is byte[] bytes && expected is byte[] other) Check(bytes.SequenceEqual(other)); else Check(Equals(actual, expected)); }
    static void Main()
    {
        Api.EchoUnit(default);
${scalars.filter(([label]) => label !== "unit").map(([label, , , value]) => `        Equal(Api.Echo${cap(label)}(${value}), ${value});`).join("\n")}
${scalars.map(([label, , type, value]) => `        var input${cap(label)} = new ${type.replaceAll("[]", "") }[]${type.endsWith("[]") ? "[]" : ""} { ${value}, ${value} };
        var copied${cap(label)} = Api.Array${cap(label)}(input${cap(label)});
        Check(copied${cap(label)}.Length == 2); Equal(copied${cap(label)}[0], input${cap(label)}[0]);
        Check(!ReferenceEquals(copied${cap(label)}, input${cap(label)}));
        Check(Api.Array${cap(label)}(Array.Empty<${type}>()).Length == 0);`).join("\n")}
        Check(Api.Answer() == ulong.MaxValue); Check(Api.DoubleWord(21) == 42);
        for (int i = 0; i < 2000; i++) Check(Api.EchoU32(42) == 42);
        var allocated = GC.GetAllocatedBytesForCurrentThread();
        for (int i = 0; i < 10000; i++) Check(Api.EchoU32(42) == 42);
        Check(GC.GetAllocatedBytesForCurrentThread() == allocated);
        Check(BitConverter.SingleToInt32Bits(Api.EchoF32(-0.0f)) == int.MinValue);
        Check(BitConverter.DoubleToInt64Bits(Api.EchoF64(-0.0)) == long.MinValue);
        Check(float.IsNaN(Api.EchoF32(float.NaN))); Check(double.IsNaN(Api.EchoF64(double.NaN)));
        Check(Api.EchoF64(double.PositiveInfinity) == double.PositiveInfinity);
        Check(Api.EchoF64(double.NegativeInfinity) == double.NegativeInfinity);
        Equal(Api.EchoNat(BigInteger.Zero), BigInteger.Zero); Equal(Api.EchoInteger(BigInteger.Zero), BigInteger.Zero);
        Equal(Api.EchoText(""), ""); Check(Api.EchoBytes(Array.Empty<byte>()).Length == 0);
        var leaf = new Leaf(${(name === "Aurora" ? scalars : [...scalars].reverse()).map(([, , , value]) => value).join(", ")});
        var source = new Packet("packet", leaf, new[] { new[] { leaf, leaf }, Array.Empty<Leaf>(), new[] { leaf } });
        for (int iteration = 0; iteration < 100; iteration++)
        {
            var result = Api.EchoRecord(source);
            Check(result.Rows.Length == 3 && result.Rows[0].Length == 2 && result.Rows[1].Length == 0);
${scalars.map(([label]) => `            Equal(result.Leaf.V${cap(label)}, leaf.V${cap(label)});`).join("\n")}
            Check(!ReferenceEquals(result.Leaf, leaf)); Check(!ReferenceEquals(result.Leaf.VBytes, leaf.VBytes));
            result.Rows[0][0] = result.Rows[0][0] with { VText = "independent" };
            Check(source.Rows[0][0].VText == leaf.VText);
        }
        var other = source with { Title = "other" };
        Check(Api.Choose(source, other, true).Title == "packet"); Check(Api.Choose(source, other, false).Title == "other");
        Check(Api.EchoRows(source.Rows)[2][0].VNat == leaf.VNat);
        Check(Api.EchoWord(new Word(uint.MaxValue)).Bits == uint.MaxValue); _ = Api.EchoEmpty(new Empty());
        Check(Api.EchoWords(new[] { new Word(1), new Word(2) })[1].Bits == 2);
        Check(Api.EchoMarkers(new[] { new Empty(), new Empty() }).Length == 2);
        Check(Api.Matrix(new uint[] {1, 2, 3})[1].SequenceEqual(new uint[] {3, 2, 1}));
        Check(Api.Grow("hello").SequenceEqual(new[] {"hello", "hello"}));
        Reject<ArgumentNullException>(() => Api.EchoText(null!));
        Reject<ArgumentNullException>(() => Api.EchoBytes(null!));
        Reject<ArgumentNullException>(() => Api.EchoRecord(null!));
        Reject<ArgumentNullException>(() => Api.EchoRows(new[] { new[] { leaf }, null! }));
        Reject<ArgumentNullException>(() => Api.EchoRecord(source with { Leaf = null! }));
        Reject<ArgumentOutOfRangeException>(() => Api.EchoNat(-1));
        Reject<System.Text.EncoderFallbackException>(() => Api.EchoText("\\ud800"));
        Reject<ArgumentException>(() => Api.EchoBytes(new byte[16 * 1024 * 1024 + 1]));
        for (int i = 0; i < 12; i++) Reject<ArgumentException>(() => Api.Grow(new string('x', 6 * 1024 * 1024)));
        Parallel.For(0, 4, _ => { for (int i = 0; i < 100; i++) Check(Api.EchoRecord(source).Rows.Length == 3); });
        Console.WriteLine("ordinary .NET ${name}: scalars, arrays, records, rejection, cleanup and concurrency passed");
    }
}
`;

const consume = async (working, output, name) => {
	const report = await json(join(output, "native-release.json")), nuget = (report.projections ?? [report]).find(projection => projection.ecosystem === "nuget");
	const archive = nuget.packages[0], root = join(working, `consumer-${name}`), feed = join(root, "feed");
	await mkdir(feed, { recursive: true });
	await cp(join(output, "archives", archive.archive), join(feed, archive.archive));
	assert.equal(sha256(await readFile(join(feed, archive.archive))), archive.sha256);
	await saveLakeFile(root, "Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup><ItemGroup><PackageReference Include="${archive.name}" Version="${archive.version}" /></ItemGroup></Project>\n`);
	await saveLakeFile(root, "Program.cs", consumer(name));
	await saveLakeFile(root, "NuGet.Config", '<configuration><packageSources><clear /><add key="prepared" value="feed" /></packageSources></configuration>\n');
	const executable = dotnet === "dotnet" ? (await run("sh", ["-c", "command -v dotnet"], root)).stdout.trim() : dotnet;
	const env = { PATH: `${dirname(executable)}:/usr/bin:/bin`, DOTNET_ROOT: dirname(executable), DOTNET_CLI_HOME: join(working, `dotnet-cli-${name}`), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(working, `nuget-cache-${name}`) };
	await run(executable, ["restore", "--configfile", "NuGet.Config", "--nologo"], root, env);
	await run(executable, ["build", "--no-restore", "--configuration", "Release", "--disable-build-servers", "/p:UseSharedCompilation=false", "--output", "out", "--nologo"], root, env);
	const result = await run(executable, ["out/Consumer.dll"], root, env);
	assert.match(result.stdout, /cleanup and concurrency passed/);
	return { root, executable, env, nuget };
};

const compose = async working => {
	const root = join(working, "composition"), feed = join(root, "feed");
	await mkdir(feed, { recursive: true });
	const executable = dotnet === "dotnet" ? (await run("sh", ["-c", "command -v dotnet"], root)).stdout.trim() : dotnet;
	for(const name of ["Aurora", "Boreal"])
		await cp(join(working, `builds/${name}-build0/archives/Acme.${name}.2.0.0-rc.1.nupkg`), join(feed, `Acme.${name}.2.0.0-rc.1.nupkg`));
	await saveLakeFile(root, "Consumer.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework></PropertyGroup><ItemGroup><PackageReference Include="Acme.Aurora" Version="2.0.0-rc.1" /><PackageReference Include="Acme.Boreal" Version="2.0.0-rc.1" /></ItemGroup></Project>\n');
	await saveLakeFile(root, "Program.cs", `using System;
using System.Collections.Generic;
using System.Numerics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
static class Program {
  [UnmanagedFunctionPointer(CallingConvention.Cdecl)] delegate void Snapshot(nint output);
  static void Main() {
    Parallel.Invoke(() => { if (LeanBridge.Aurora.Api.EchoNat(BigInteger.One << 200) != BigInteger.One << 200) throw new Exception(); },
      () => { if (LeanBridge.Boreal.Api.EchoInteger(-99) != -99) throw new Exception(); });
    var registry = (Dictionary<string, object>)AppDomain.CurrentDomain.GetData("lean-bridge.native-library-v1.dotnet")!;
    var snapshot = Marshal.GetDelegateForFunctionPointer<Snapshot>(NativeLibrary.GetExport((nint)registry["broker"], "lean_bridge_native_snapshot_read"));
    var bytes = Marshal.AllocHGlobal(40);
    try {
      snapshot(bytes);
      if (Marshal.ReadInt32(bytes, 8) != 1 || Marshal.ReadInt32(bytes, 12) != 2 || Marshal.ReadInt32(bytes, 16) != 2) throw new Exception("Components did not share one initialized runtime");
    } finally { Marshal.FreeHGlobal(bytes); }
    Console.WriteLine("two independent NuGet packages share one Lean runtime");
  }
}
`);
	const env = { ...environment, DOTNET_CLI_HOME: join(working, "composition-cli"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1", NUGET_PACKAGES: join(working, "composition-cache") };
	await run(executable, ["restore", "--source", feed, "--nologo"], root, env);
	await run(executable, ["build", "--no-restore", "--configuration", "Release", "--disable-build-servers", "/p:UseSharedCompilation=false", "--nologo"], root, env);
	assert.match((await run(executable, ["bin/Release/net8.0/Consumer.dll"], root, { PATH: "/usr/bin:/bin", DOTNET_ROOT: process.env.DOTNET_ROOT })).stdout, /share one Lean runtime/);
};

test("ordinary NuGet archives reproduce after relocation and run through clean installed APIs", { skip: !enabled, timeout: 900_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-dotnet-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const buildParent = join(working, "builds");
	for(const file of ["Directory.Build.props", "Directory.Build.targets", "Directory.Packages.props"])
		await saveLakeFile(buildParent, file, '<Project><Import Project="/must/not/read/ambient-msbuild-settings" /></Project>\n');
	await saveLakeFile(buildParent, "global.json", '{"sdk":{"version":"99.0.999","rollForward":"disable"}}\n');
	await saveLakeFile(buildParent, "Directory.Build.rsp", "-invalid-ambient-build-response\n");
	for(const name of ["Aurora", "Boreal"])
	{
		const source = join(working, name), relocated = `${source}-relocated`;
		await project(source, name); await cp(source, relocated, { recursive: true });
		const before = await lakeInputState(source), builds = [];
		for(const [index, projectRoot] of [source, relocated].entries())
			builds.push(await buildCanonicalProject({ projectRoot, outputRoot: join(buildParent, `${name}-build${index}`), targets: name === "Aurora" ? ["nuget", "c"] : ["nuget"], environment }));
		assert.deepEqual(await lakeInputState(source), before);
		assert.deepEqual(builds[0].packages, builds[1].packages, "independent relocated archives agree");
		t.diagnostic(canonicalJson({ project: name, archives: builds[0].packages.map(({ archive, sha256 }) => ({ path: archive, sha256 })) }).trim());
		await rename(source, `${source}-hidden`); await rename(relocated, `${relocated}-hidden`);
		const output = builds[0].output;
		const installed = await consume(working, output, name);
		const native = join(installed.root, "out/runtimes/linux-x64/native", `lib${name.toLowerCase()}.so`);
		const bytes = await readFile(native); bytes[bytes.length - 1] ^= 1; await saveLakeFile(dirname(native), `lib${name.toLowerCase()}.so`, bytes);
		await assert.rejects(() => run(installed.executable, ["out/Consumer.dll"], installed.root, installed.env), error => /differs from the compiled package/.test(error.details?.stderr));
		const managed = join(output, "native/dotnet/lib/net8.0", `LeanBridge.${name}.dll`), assembly = await readFile(managed);
		assembly[assembly.length - 1] ^= 1; await saveLakeFile(dirname(managed), `LeanBridge.${name}.dll`, assembly);
		await assert.rejects(() => packageOrdinaryNuget({ working: join(working, "tampered"), dotnetRoot: join(output, "native/dotnet"), nativeRoot: join(output, "native/component"), runtimeRoot: join(output, "native/runtime"), adapterRoot: join(output, "native/c-binding"), leanPrefix, glibcMinimumVersion: "2.38" }), /drift/);
	}
	await compose(working);
});

test("ordinary NuGet compiler failure releases no partial package", { skip: !enabled, timeout: 180_000 }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-dotnet-failure-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const source = join(working, "source"); await project(source, "Failure");
	await assert.rejects(() => buildCanonicalProject({ projectRoot: source, outputRoot: join(working, "release"), targets: ["c", "nuget"], environment: { ...environment, LEAN_BRIDGE_DOTNET: "/missing/dotnet-compiler" } }));
	assert.deepEqual(await readdir(working), ["source"]);
});
