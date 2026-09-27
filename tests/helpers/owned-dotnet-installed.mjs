/**
 * SDK-free execution and negative consumers of installed owned NuGet packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Copy only the .NET 8 host and framework, with no compiler, SDK or NuGet cache.
 *
 * @param directory - Test-owned runtime destination.
 * @param command - Producer SDK's dotnet host.
 */
export const ownedDotnetRuntimeOnly = async (directory, command) => {
	const dotnet = await realpath(command), root = dirname(dotnet);
	const latest = values => values.filter(value => /^8\.0\.\d+$/u.test(value))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
	const fxr = latest(await readdir(join(root, "host/fxr")));
	const framework = latest(await readdir(join(root, "shared/Microsoft.NETCore.App")));
	assert.ok(fxr && framework, ".NET 8 runtime is available");
	await mkdir(directory);
	await cp(dotnet, join(directory, "dotnet"));
	await cp(join(root, "host/fxr", fxr), join(directory, "host/fxr", fxr), { recursive: true });
	await cp(join(root, "shared/Microsoft.NETCore.App", framework), join(directory, "shared/Microsoft.NETCore.App", framework), { recursive: true });
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: directory, DOTNET_MULTILEVEL_LOOKUP: "0", DOTNET_NOLOGO: "1" };
	const executable = join(directory, "dotnet");
	assert.equal((await runCopied(executable, ["--list-sdks"], directory, env)).stdout.trim(), "");
	return { executable, env };
};

/**
 * Reject ill-typed programs against the installed assembly, not generated sources.
 *
 * @param options - Offline consumer, package identity and producer SDK.
 * @param options.consumer - Installed consumer directory.
 * @param options.pkg - Prepared NuGet coordinates.
 * @param options.namespace - Generated public C# namespace.
 * @param options.scalar - Use the scalar-record fixture's negative cases.
 * @param options.command - Absolute .NET SDK host.
 * @param options.env - Isolated build environment.
 */
export const rejectOwnedDotnetConsumers = async ({ consumer, pkg, namespace, scalar, command, env }) => {
	const rejections = [
		["resource constructor", "_ = new Ticket();", /CS1729/u]
		, ["raw handle", "Ticket ticket = null!; _ = ticket.Handle;", /CS1061/u]
		, ["sealed resource", "class External : Ticket {}", /CS0509/u]
		, ...scalar ? [
			["typed scalar record", 'Ticket ticket = null!; _ = new Packet(ticket, "bad", default, new Empty());', /CS1503/u]
		] : [
			["resource field", 'Ticket ticket = null!; _ = new Bundle("bad", default, new[] { ticket }, new[] { ticket }, new Payload(0, new byte[0]));', /CS1503/u]
			, ["immutable record", "var value = new Payload(0, new byte[0]); value.Count = 1;", /CS8852/u]
			, ["typed option", 'Option<Ticket>.Some("bad");', /CS1503/u]
			, ["typed callback", "CallbackRecordArgument1ClosureCallback f = (Ticket ticket) => null!;", /CS1661|CS1678/u]
			, ["typed higher-order input", "DispatchResultClosure f = null!; CallbackRecordArgument1Closure value = null!; f.Invoke(value);", /CS1503/u]
			, ["async callback", "CallbackRecordArgument1ClosureCallback f = async value => { await System.Threading.Tasks.Task.Yield(); return value; };", /CS4010/u]
			, ["transparent alias", "BundleAlias value = null!; _ = value;", /CS0246/u]
			, ["closed variant", "class External : Choice {}", /CS8865|CS1729|CS7036/u]
		]
	];
	const project = '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>false</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Invalid.cs"/><PackageReference Include="' + pkg.name + '" Version="[' + pkg.version + ']"/></ItemGroup></Project>';
	await saveLakeFile(consumer, "Invalid.csproj", project);
	await runCopied(command, ["restore", "Invalid.csproj", "--configfile", "NuGet.Config"], consumer, env);
	const observations = [];
	for(const [name, body, diagnostic] of rejections)
	{
		const external = body.startsWith("class ");
		const source = `using ${namespace};\ninternal static class Program { static void Main() { ${external ? "" : body} } }\n${external ? body : ""}`;
		await saveLakeFile(consumer, "Invalid.cs", source);
		await assert.rejects(() => runCopied(command, ["build", "Invalid.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "invalid"], consumer, env), error => {
			assert.match(JSON.stringify(error.details ?? error.message), diagnostic, name); return true;
		});
		observations.push({ name, source, diagnostic: diagnostic.source });
	}
	return observations;
};

/**
 * Compile and execute the consumer guide's exact ownership example.
 *
 * @param options - Installed package and isolated consumer environment.
 * @param options.consumer - Existing offline NuGet consumer.
 * @param options.pkg - Prepared NuGet coordinate.
 * @param options.command - Absolute .NET SDK host.
 * @param options.env - Isolated build and execution environment.
 */
export const checkOwnedDotnetDocumentation = async ({ consumer, pkg, command, env }) => {
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	const source = guide.split("### Resource-containing values\n")[1].split("```csharp\n")[1].split("\n```")[0] + "\n";
	await saveLakeFile(consumer, "Example.cs", source);
	const project = `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>false</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="Example.cs"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`;
	await saveLakeFile(consumer, "Example.csproj", project);
	await runCopied(command, ["restore", "Example.csproj", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "Example.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "example"], consumer, env);
	const observed = await runCopied(command, ["example/Example.dll"], consumer, env);
	assert.deepEqual(observed, { code: 0, stdout: `${1n << 200n}\n${1n << 200n}\n`, stderr: "" });
	return { sourceSha256: sha256(source), ...observed };
};
