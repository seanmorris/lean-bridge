/**
 * Build a net8.0 assembly over the elaborated IO adapter, then pack its exact bytes.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateDotnetIO } from "../backends/dotnet/sync-io.mjs";
import { compilePreparedAssembly } from "../build/native-dotnet-projection.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { writeNugetManifest } from "./native-nuget.mjs";
import { writePackageSetReceipt } from "./package-set-receipt.mjs";

/**
 * Package verified native outputs with their generated assembly and source notices.
 *
 * @param o - Authenticated IO declarations, compiled native files and private staging paths.
 */
export const writeDotnetIORelease = async o => {
	const { workRoot, name, version, prefix, wire, files, api, evidence, manifest, runtimeIdentity, componentIdentity, bindingIrSha256, floor, projectContract } = o;
	const library = "lib" + prefix + ".so", libraries = {}, profile = "native-dotnet-io-v1";
	for(const path of [library, "liblean_bridge_native.so", "libleanshared.so"])
	{
		const file = "lib/" + path, bytes = files.get(file);
		if(!bytes || (path !== library && sha256(bytes) !== manifest.files[file]?.sha256)) throw new Error("Missing or inconsistent .NET native library: " + path);
		libraries[path] = sha256(bytes);
	}
	if(files.size !== Object.keys(libraries).length) throw new Error("Unexpected .NET IO native payload");
	const auth = { library, libraries, componentId: api.component.id, componentReceiptSha256: componentIdentity, runtimeIdentity };
	const { assembly, files: sources } = await generateDotnetIO({ api, wire, evidence: auth });
	const stage = await mkdtemp(join(workRoot, ".dotnet-io-")), root = join(stage, "package"), compiler = join(stage, "managed");
	const write = async (dir, path, data) => {
		await mkdir(dirname(join(dir, path)), { recursive: true });
		await writeFile(join(dir, path), data, { flag: "wx" });
	};
	try
	{
		const project = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks><GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>1591</NoWarn><TreatWarningsAsErrors>true</TreatWarningsAsErrors><Deterministic>true</Deterministic>
    <AssemblyName>${assembly}</AssemblyName><Version>${version}</Version><DebugType>none</DebugType>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
  </PropertyGroup>
</Project>
`;
		const inventory = {};
		const save = async (path, data) => { await write(root, path, data); inventory[path] = { bytes: Buffer.byteLength(data), sha256: sha256(data) }; };
		for(const [f, s] of Object.entries({ ...sources, [assembly + ".csproj"]: project }))
		{
			await write(compiler, `src/${assembly}/${f}`, s);
			await save(`lean-bridge/dotnet/src/${assembly}/${f}`, s);
		}
		await write(compiler, "NuGet.Config", "<configuration><packageSources><clear /></packageSources></configuration>\n");
		const sdk = await compilePreparedAssembly({ root: compiler, scratch: join(stage, "scratch"), working: stage, assembly, environment: o.environment, signal: o.signal });
		for(const ext of ["dll", "xml"])
		{
			const path = `lib/net8.0/${assembly}.${ext}`; await save(path, await readFile(join(compiler, path)));
		}
		for(const lib of Object.keys(libraries)) await save("runtimes/linux-x64/native/" + lib, files.get("lib/" + lib));
		await save("lean-bridge/dotnet/global.json", await readFile(join(compiler, "global.json")));
		await save("lean-bridge/binding-ir.json", canonicalJson(api)); await save("lean-bridge/elaboration.json", canonicalJson(evidence));
		await save("lean-bridge/runtime.json", canonicalJson(manifest));
		await save("lean-bridge/licenses/LeanBridge-LICENSE", await readFile(new URL("../../LICENSE", import.meta.url)));
		for(const f of ["LICENSE", "LICENSES"]) await save("lean-bridge/licenses/Lean-" + f, await readFile(join(o.leanPrefix, f)));
		for(const [p, data] of Object.entries(projectContract.notices)) await save("lean-bridge/licenses/" + p, data);
		await save("README.md", `# ${name} ${version}\n\nCall ${assembly}.Api synchronously on the process main thread. Returned Except values are Result<T,E>; thrown EIO raises DeclaredError<T> with its Lean declaration and typed payload. OS errors raise LeanIOException. .NET 8, Linux x86-64 with glibc ${floor}+; the exact native runtime is included and verified automatically. No Lean compiler or event loop needed.\n`);
		await writeNugetManifest(save, name, version, projectContract.metadata ?? {});
		await write(root, "lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
			, kind: "lean-bridge-native-dotnet-io", profile, name, version
			, component: api.component, componentIdentity, bindingIrSha256
			, sourceTreeSha256: projectContract.sourceTreeSha256
			, runtimeIdentity, assembly, namespace: assembly, sdk
			, glibcMinimumVersion: floor, files: inventory }));
		const archive = name + "." + version + ".nupkg", bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
		await writeFile(join(o.output, archive), bytes, { flag: "wx" });
		const receipt = await writePackageSetReceipt({ root: workRoot
			, component: api.component
			, source: { treeSha256: projectContract.sourceTreeSha256 }
			, profiles: [{ id: profile, bindingIrSha256, runtimeIdentity }]
			, signal: o.signal
			, packages: [{ target: "nuget", ecosystem: "nuget", name, version
				, profile, role: "component", runtimeIdentity
				, runtimeDelivery: "embedded", requires: []
				, artifacts: [{ path: "archives/" + archive, bytes: bytes.length, sha256: sha256(bytes) }] }] });
		return { receipt, api, evidence, bindingIrSha256, runtimeIdentity };
	} finally
	{ await rm(stage, { recursive: true, force: true }); }
};
