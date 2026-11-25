/**
 * Build a net8.0 assembly over the elaborated IO adapter, then pack its exact bytes.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateDotnetIO, generateDotnetTasks } from "../backends/dotnet/sync-io.mjs";
import { dotnetHostSignatures, generateDotnetHostApi } from "../backends/dotnet/host-api.mjs";
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
	const { workRoot, name, version, prefix, wire, host, files, api, evidence, manifest, runtimeIdentity, componentIdentity, bindingIrSha256, floor, projectContract } = o;
	const delivery=host?.workerWire??wire;
	const library = "lib" + prefix + ".so", libraries = {}, mode = delivery?.wait ? "task" : "io", profile = "native-dotnet-" + mode + "-v1";
	for(const path of [library, "liblean_bridge_native.so", "libleanshared.so"])
	{
		const file = "lib/" + path, bytes = files.get(file);
		if(!bytes || (path !== library && sha256(bytes) !== manifest.files[file]?.sha256)) throw new Error("Missing or inconsistent .NET native library: " + path);
		libraries[path] = sha256(bytes);
	}
	let resourceLedger;
	if(delivery?.leases?.length)
	{
		if(!/^[a-f0-9]{64}$/u.test(o.ledgerId)) throw new Error("Missing .NET resource ledger identity");
		const path = "liblb_task_resources_" + o.ledgerId + ".so", bytes = files.get("lib/" + path);
		if(!bytes) throw new Error("Missing .NET resource ledger library");
		libraries[path] = sha256(bytes); resourceLedger = { id: o.ledgerId, library: path, sha256: libraries[path] };
	}
	if(host)
	{
		const { id, name: path } = host.domain, bytes = files.get("lib/" + path);
		if(wire || !bytes || !/^[a-f0-9]{64}$/u.test(id) || path !== "liblb_dotnet_host_" + runtimeIdentity + ".so") throw new Error("Invalid CLR host domain");
		libraries[path] = sha256(bytes);
	}
	if(files.size !== Object.keys(libraries).length) throw new Error("Unexpected .NET IO native payload");
	const auth = { library
		, libraries
		, componentId: api.component.id
		, componentReceiptSha256: componentIdentity
		, runtimeIdentity, ...resourceLedger ? { ledgerId: resourceLedger.id } : {} };
	const { assembly, files: sources, contracts = {} } = host ? await generateDotnetHostApi({ ...host, api, prefix, evidence: auth })
		: await (wire.wait ? generateDotnetTasks : generateDotnetIO)({ api, wire, evidence: auth });
	const stage = await mkdtemp(join(workRoot, ".dotnet-io-")), root = join(stage, "package"), compiler = join(stage, "managed");
	const write = async (dir, path, data) => {
		await mkdir(dirname(join(dir, path)), { recursive: true });
		await writeFile(join(dir, path), data, { flag: "wx" });
	};
	try
	{
		const csproj = (id, v, refs = "") => `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework><Nullable>enable</Nullable><ImplicitUsings>disable</ImplicitUsings>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks><GenerateDocumentationFile>true</GenerateDocumentationFile>
    <NoWarn>1591</NoWarn><TreatWarningsAsErrors>true</TreatWarningsAsErrors><Deterministic>true</Deterministic>
    <AssemblyName>${id}</AssemblyName><Version>${v}</Version><DebugType>none</DebugType>
    <EnableNETAnalyzers>false</EnableNETAnalyzers>
  </PropertyGroup>
${refs}</Project>
`;
		const inventory = {};
		const save = async (path, data) => { await write(root, path, data); inventory[path] = { bytes: Buffer.byteLength(data), sha256: sha256(data) }; };
		const contractIds = Object.keys(contracts).sort();
		const refs = contractIds.length ? "  <ItemGroup>" + contractIds.map(id => `<ProjectReference Include="../${id}/${id}.csproj" />`).join("") + "</ItemGroup>\n" : "";
		for(const id of contractIds) for(const [file, data] of [["Resource.cs", contracts[id]], [id + ".csproj", csproj(id, "1.0.0")]])
		{
			await write(compiler, `src/${id}/${file}`, data);
			await save(`lean-bridge/dotnet/src/${id}/${file}`, data);
		}
		for(const [f, s] of Object.entries({ ...sources, [assembly + ".csproj"]: csproj(assembly, version, refs) }))
		{
			await write(compiler, `src/${assembly}/${f}`, s);
			await save(`lean-bridge/dotnet/src/${assembly}/${f}`, s);
		}
		await write(compiler, "NuGet.Config", "<configuration><packageSources><clear /></packageSources></configuration>\n");
		const sdk = await compilePreparedAssembly({ root: compiler, scratch: join(stage, "scratch"), working: stage, assembly, environment: o.environment, signal: o.signal, projectReferences: contractIds.length > 0 });
		for(const id of [assembly, ...contractIds]) for(const ext of ["dll", "xml"])
		{
			const path = `lib/net8.0/${id}.${ext}`; await save(path, await readFile(join(compiler, path)));
		}
		for(const lib of Object.keys(libraries)) await save("runtimes/linux-x64/native/" + lib, files.get("lib/" + lib));
		await save("lean-bridge/dotnet/global.json", await readFile(join(compiler, "global.json")));
		await save("lean-bridge/binding-ir.json", canonicalJson(api)); await save("lean-bridge/elaboration.json", canonicalJson(evidence));
		await save("lean-bridge/runtime.json", canonicalJson(manifest));
		await save("lean-bridge/licenses/LeanBridge-LICENSE", await readFile(new URL("../../LICENSE", import.meta.url)));
		for(const f of ["LICENSE", "LICENSES"]) await save("lean-bridge/licenses/Lean-" + f, await readFile(join(o.leanPrefix, f)));
		for(const [p, data] of Object.entries(projectContract.notices)) await save("lean-bridge/licenses/" + p, data);
		await save("README.md", host ? `# ${name} ${version}\n\nBind application classes with \`using var hosts = ${assembly}.Api.BindHosts<${host.ir.types.map(t => t.name).join(", ")}>();\`. Call the generated instance methods on the process main thread. Dispose the binding when done.${host.entries.some(e=>e.result.kind==="io-closure") ? " Keep the binding open while using a returned function. Call its Invoke method synchronously and dispose it with using. Disposing the binding revokes its remaining functions. Finalizer cleanup runs at the next binding call or when you call Api.DrainHostCloses() on the owner thread." : ""}${host.workerWire ? ` Start ${assembly}.LeanRuntime.Run(async () => { /* application */ }) on the process main thread for worker calls. Await methods on the binding for operations carrying your objects; copied-only workers are static Api methods. Use await foreach for cursor results. Disposing the binding cancels its pending deliveries and invalidates its cold sequences without cancelling other bindings.` : ""} The package verifies and loads its own native libraries. Requires .NET 8, Linux x86-64 and glibc ${floor}+.\n\nRequired public C# members (replace each contract class name with your implementing class):\n\n${dotnetHostSignatures(host).map(s => "- `" + s + "`").join("\n")}\n` : wire.wait
			? `# ${name} ${version}\n\nStart ${assembly}.LeanRuntime.Run(async () => { /* application */ }) once on the process main thread. Await generated Api methods and use await foreach for pull streams. Pass a CancellationToken to a task or WithCancellation(token) to a stream. No polling, Lean compiler or external runtime setup is required. Native calls stay on the owner thread. For .NET 8 on Linux x86-64 with glibc ${floor}+.\n`
			: `# ${name} ${version}\n\nCall ${assembly}.Api synchronously on the process main thread. Returned Except values are Result<T,E>; thrown EIO raises DeclaredError<T> with its Lean declaration and typed payload. OS errors raise LeanIOException. .NET 8, Linux x86-64 with glibc ${floor}+; the exact native runtime is included and verified automatically. No Lean compiler or event loop needed.\n`);
		await writeNugetManifest(save, name, version, projectContract.metadata ?? {});
		await write(root, "lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
			, kind: "lean-bridge-native-dotnet-" + mode, profile, name, version
			, component: api.component, componentIdentity, bindingIrSha256
			, sourceTreeSha256: projectContract.sourceTreeSha256
			, runtimeIdentity, assembly, namespace: assembly, sdk
			, ...resourceLedger ? { resourceLedger, resourceContracts: contractIds } : {}
			, ...host ? { hostDomain: { id: host.domain.id, library: host.domain.name, sha256: libraries[host.domain.name] } } : {}
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
