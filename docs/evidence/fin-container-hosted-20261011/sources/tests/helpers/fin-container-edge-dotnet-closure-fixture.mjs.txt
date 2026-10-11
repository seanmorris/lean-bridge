/**
 * Build a tiny synthetic NuGet package with a real managed library for guard controls.
 * It contains no Lean algorithm and is not installed Fin acceptance evidence.
 *
 * @file
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Create a real CLR library, a synthetic receipt and a deterministic local package.
 *
 * @param t - Test context owning all temporary files.
 */
export const finContainerEdgeDotnetFixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-dotnet-closure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const command = resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet");
	const project = join(root, "author"), payload = join(root, "payload");
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await saveLakeFile(project, "Probe.csproj", '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework><AssemblyName>Probe.Api</AssemblyName><NuGetAudit>false</NuGetAudit><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>');
	await saveLakeFile(project, "Api.cs", "namespace Probe; public static class Api { public static int Value() => 1; }\n");
	await saveLakeFile(project, "NuGet.Config", '<configuration><packageSources><clear/></packageSources></configuration>');
	await runCopied(command, ["build", "--disable-build-servers", "-p:UseSharedCompilation=false", "-o", "out"], project, env);
	await saveLakeFile(payload, "lib/net8.0/Probe.Api.dll", await readFile(join(project, "out/Probe.Api.dll")));
	await saveLakeFile(payload, "lib/net8.0/Probe.Api.xml", '<doc><assembly><name>Probe.Api</name></assembly><members/></doc>');
	await saveLakeFile(payload, "Probe.Api.nuspec", '<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd"><metadata><id>Probe.Api</id><version>1.0.0</version><authors>Fixture</authors><description>Synthetic guard control</description><dependencies><group targetFramework="net8.0" /></dependencies></metadata></package>\n');
	await saveLakeFile(payload, "_rels/.rels", '<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/Probe.Api.nuspec" Id="R1" /></Relationships>\n');
	await saveLakeFile(payload, "[Content_Types].xml", '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="dll" ContentType="application/octet-stream"/><Default Extension="nuspec" ContentType="application/octet-stream"/></Types>\n');
	const files = {};
	for(const path of await nativeArtifactPaths(payload))
	{
		const bytes = await readFile(join(payload, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await saveLakeFile(payload, "lean-bridge/package-receipt.json", canonicalJson({
		schemaVersion: 1, kind: "lean-bridge-ordinary-nuget-package"
		, ecosystem: "nuget", name: "Probe.Api", version: "1.0.0"
		, assembly: "Probe.Api", files }));
	return { root, payload, command
		, pack: async name => {
			const handoff = join(root, `handoff-${name}`), bytes = await createDeterministicZip({ directory: payload, sourceDateEpoch: 315532800 });
			await saveLakeFile(handoff, "Probe.Api.1.0.0.nupkg", bytes);
			return { handoff
				, packages: [{ role: "component", name: "Probe.Api", version: "1.0.0"
					, artifacts: [{ path: "Probe.Api.1.0.0.nupkg", sha256: sha256(bytes) }] }] };
		}
	};
};
