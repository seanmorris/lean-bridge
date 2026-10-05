/**
 * Compile public owned C# values from an independent safe consumer assembly.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { generateOwnedDotnetValues } from "../src/backends/dotnet/owned-values.mjs";
import { ownedDotnetRuntime } from "../src/backends/dotnet/owned-runtime.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("owned C# consumer types stay safe, closed and typed across assembly boundaries", {
	skip: process.env.LEAN_BRIDGE_OWNED_NATIVE_TEST !== "1", timeout: 300000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-dotnet-values-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedDotnetValues(ownedCppCompositionReviewedIr());
	const properties = '<TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors>';
	await saveLakeFile(directory, "library/Values.cs", model.source);
	await saveLakeFile(directory, "library/Runtime.cs", `namespace ${model.namespace}.Interop;\n${ownedDotnetRuntime(model.c.prefix)}`);
	await saveLakeFile(directory, "library/Values.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>${properties}<AllowUnsafeBlocks>true</AllowUnsafeBlocks></PropertyGroup></Project>`);
	await saveLakeFile(directory, "consumer/Consumer.csproj", `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup>${properties}<OutputType>Exe</OutputType><AllowUnsafeBlocks>false</AllowUnsafeBlocks></PropertyGroup><ItemGroup><ProjectReference Include="../library/Values.csproj"/></ItemGroup></Project>`);
	await saveLakeFile(directory, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	const source = `using System;
using System.Numerics;
using LeanBridge.OwnedAggregates;
internal static class Program
{
    private static int checks;
    private static void Check(bool value) { if (!value) throw new Exception("public value check"); ++checks; }
    static void Main()
    {
        var value = new Payload(BigInteger.One << 200, new byte[] { 0, 255, 1 });
        var equal = value with { Bytes = new byte[] { 0, 255, 1 } };
        Check(value == equal); Check(value.GetHashCode() == equal.GetHashCode());
        Check(Option<Option<bool>>.None != Option<Option<bool>>.Some(Option<bool>.None));
        Check(Option<bool>.Some(false) != Option<bool>.None);
        Check(Option<Unit>.Some(default) != Option<Unit>.None);
        Check(!default(Result<Payload, string>).IsInitialized);
        Check(Result<Payload, string>.Ok(value) == Result<Payload, string>.Ok(equal));
        Check(new ChainStop() == new ChainStop()); Check(new ChoiceEmpty() == new ChoiceEmpty());
        Check(typeof(Ticket).IsSealed && typeof(Ticket).GetConstructors().Length == 0);
        Check(typeof(MakeRecordResultClosure).IsSealed && typeof(MakeRecordResultClosure).GetConstructors().Length == 0);
        CallbackRecordArgument1ClosureCallback identity = value => value;
        DispatchResultClosureCallback higher = closure => closure.Invoke(null!);
        Check(identity is not null && higher is not null);
        Tree tree = new TreeBranch(Array.Empty<Tree>());
        for (int i = 0; i < 40; i++) tree = new TreeBranch(new[] { tree, new TreeBranch(Array.Empty<Tree>()) });
        Check(tree == tree with { }); Check(tree.ToString().Length <= 4099);
        var array = new Tree[1]; array[0] = new TreeBranch(array);
        try { array[0].GetHashCode(); throw new Exception("cycle accepted"); }
        catch (ArgumentException) { ++checks; }
        try { _ = new ForgedChoice(new ChoiceEmpty()); throw new Exception("forged variant accepted"); }
        catch (ArgumentException) { ++checks; }
        Console.WriteLine(checks);
    }
}
public record ForgedChoice : Choice
{
    public ForgedChoice(Choice value) : base(value) { }
}
`;
	await saveLakeFile(directory, "consumer/Program.cs", source);
	const dotnet = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const env = { PATH: "/usr/bin:/bin", DOTNET_ROOT: dirname(dotnet)
		, DOTNET_CLI_HOME: join(directory, "home"), DOTNET_NOLOGO: "1"
		, DOTNET_CLI_TELEMETRY_OPTOUT: "1"
		, NUGET_PACKAGES: join(directory, "packages") };
	const build = () => runCopied(dotnet, ["build", "consumer/Consumer.csproj", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], directory, env);
	await build();
	const result = await runCopied(dotnet, ["out/Consumer.dll"], directory, env);
	assert.equal(result.stderr, ""); assert.equal(Number(result.stdout.trim()), 16);
	const rejections = [
		["resource constructor", "_ = new Ticket();", /CS1729/u]
		, ["raw handle", "Ticket ticket = null!; _ = ticket.Handle;", /CS1061/u]
		, ["resource field", 'Ticket ticket = null!; _ = new Bundle("bad", default, new[] {ticket}, new[] {ticket}, new Payload(0, new byte[0]));', /CS1503/u]
		, ["immutable record", "var value = new Payload(0, new byte[0]); value.Count = 1;", /CS8852/u]
		, ["typed option", 'Option<Ticket>.Some("bad");', /CS1503/u]
		, ["typed callback", "CallbackRecordArgument1ClosureCallback f = (Ticket ticket) => null!;", /CS1661|CS1678/u]
		, ["typed higher-order input", "DispatchResultClosure f = null!; CallbackRecordArgument1Closure value = null!; f.Invoke(value);", /CS1503/u]
		, ["async callback", "CallbackRecordArgument1ClosureCallback f = async value => { await System.Threading.Tasks.Task.Yield(); return value; };", /CS4010/u]
		, ["transparent alias", "BundleAlias value = null!; _ = value;", /CS0246/u]
		, ["closed variant", "class External : Choice {}", /CS8865|CS1729|CS7036/u]
		, ["sealed resource", "class External : Ticket {}", /CS0509/u]
	];
	for(const [name, body, diagnostic] of rejections)
	{
		const external = body.startsWith("class ");
		await saveLakeFile(directory, "consumer/Program.cs", `using LeanBridge.OwnedAggregates;\ninternal static class Program { static void Main() { ${external ? "" : body} } }\n${external ? body : ""}`);
		await assert.rejects(build, error => {
			assert.match(JSON.stringify(error.details ?? error.message), diagnostic, name); return true;
		});
	}
	await saveLakeFile(resolve("build/owned-dotnet-values"), "public.json", canonicalJson({
		checks: 16, rejectedConsumers: rejections.length, nativeLibraryLoaded: false
		, installedPackage: false, valuesSourceSha256: sha256(model.source)
		, runtimeSha256: sha256(ownedDotnetRuntime(model.c.prefix))
		, consumerSourceSha256: sha256(source)
		, rejections: rejections.map(([name, source, diagnostic]) => ({ name, source, diagnostic: diagnostic.source }))
	}));
	t.diagnostic(`16 runtime checks and ${rejections.length} rejected external consumers; no native library loaded`);
});
