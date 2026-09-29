/**
 * Check typed consumers and the exact documented consuming-input example.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Build a safe C# consumer of the exact prepared NuGet version.
 *
 * @param pkg - Prepared NuGet name and version.
 * @param source - Consumer source filename.
 */
export const ownedDotnetTransferProject = (pkg, source) => `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><AllowUnsafeBlocks>false</AllowUnsafeBlocks><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors><EnableDefaultCompileItems>false</EnableDefaultCompileItems></PropertyGroup><ItemGroup><Compile Include="${source}"/><PackageReference Include="${pkg.name}" Version="[${pkg.version}]"/></ItemGroup></Project>`;

/**
 * Reject ill-typed ownership calls against the installed assembly.
 *
 * @param options - Installed package and isolated SDK environment.
 * @param options.consumer - Offline consumer directory.
 * @param options.pkg - Prepared NuGet coordinate.
 * @param options.namespace - Generated public C# namespace.
 * @param options.command - Absolute .NET SDK host.
 * @param options.env - Isolated build environment.
 */
export const rejectOwnedDotnetTransferConsumers = async ({ consumer, pkg, namespace, command, env }) => {
	const rejections = [
		["resource constructor", "_ = new Ticket();", /CS1729/u]
		, ["raw handle", "Ticket ticket = null!; _ = ticket.Handle;", /CS1061/u]
		, ["sealed resource", "class External : Ticket {}", /CS0509/u]
		, ["resource field", 'Ticket ticket = null!; _ = new Bundle("bad", default, new[] { ticket }, new[] { ticket }, new Payload(0, new byte[0]));', /CS1503/u]
		, ["immutable record", "var value = new Payload(0, new byte[0]); value.Count = 1;", /CS8852/u]
		, ["typed option", 'Option<Ticket>.Some("bad");', /CS1503/u]
		, ["typed callback", "CallbackRecordArgument1ClosureCallback f = (Ticket ticket) => null!;", /CS1661|CS1678/u]
		, ["typed closure input", "CallbackRecordArgument1Closure f = null!; Ticket value = null!; f.Invoke(value);", /CS1503/u]
		, ["async callback", "CallbackRecordArgument1ClosureCallback f = async value => { await System.Threading.Tasks.Task.Yield(); return value; };", /CS4010/u]
		, ["transparent alias", "BundleAlias value = null!; _ = value;", /CS0246/u]
		, ["closed variant", "class External : Choice {}", /CS8865|CS1729|CS7036/u]
	];
	await saveLakeFile(consumer, "Invalid.csproj", ownedDotnetTransferProject(pkg, "Invalid.cs"));
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
 * Execute the checked-in guide example without access to producer sources.
 *
 * @param options - Installed package and isolated consumer environment.
 * @param options.consumer - Offline consumer directory.
 * @param options.pkg - Prepared NuGet coordinate.
 * @param options.command - Absolute .NET SDK host.
 * @param options.env - Isolated build and execution environment.
 */
export const checkOwnedDotnetTransferDocumentation = async ({ consumer, pkg, command, env }) => {
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	const source = await readFile("tests/fixtures/documentation/consumers/dotnet/owned-transfers.cs", "utf8");
	assert.equal(guide.split("```csharp file=dotnet/owned-transfers.cs\n")[1].split("\n```")[0] + "\n", source);
	await saveLakeFile(consumer, "Example.cs", source);
	await saveLakeFile(consumer, "Example.csproj", ownedDotnetTransferProject(pkg, "Example.cs"));
	await runCopied(command, ["restore", "Example.csproj", "--configfile", "NuGet.Config"], consumer, env);
	await runCopied(command, ["build", "Example.csproj", "--no-restore", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "example"], consumer, env);
	const observed = await runCopied(command, ["example/Example.dll"], consumer, env);
	assert.deepEqual(observed, { code: 0, stdout: "transferred\n", stderr: "" });
	return { sourceSha256: sha256(source), ...observed };
};
