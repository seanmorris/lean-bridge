/**
 * Assemble owned-value NuGet archives from authenticated compiled artifacts.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compiledPackageMetadata, nugetPackageMetadata } from "../analyze/package-metadata.mjs";
import { generateOwnedDotnetPackage } from "../backends/dotnet/owned-package.mjs";
import { validateOrdinaryNugetSettings } from "../backends/dotnet/copied-model.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { ownedDotnetEvidence } from "../build/owned-dotnet-artifacts.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";
import { readVerifiedSourceNotices } from "./source-notices.mjs";

/**
 * Verify generated sources and both compiled inventories without any compiler.
 *
 * @param options - Closed managed/native roots and optional NuGet coordinates.
 */
export const packageOwnedNuget = async options => {
	const { working, dotnetRoot, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion } = options;
	validateOrdinaryNugetSettings(settings);
	if(!/^2\.\d+$/u.test(glibcMinimumVersion)) throw new TypeError("Invalid owned NuGet glibc floor");
	const { model, projection, evidence, receipt, libraryPaths, adapter } = await ownedDotnetEvidence(options);
	const compiled = JSON.parse(await readFile(join(dotnetRoot, "native-dotnet.json"), "utf8"));
	await verifyNativeFiles(dotnetRoot, compiled.files);
	if(compiled.schemaVersion !== 1 || compiled.profile !== "native-library-v1" || compiled.bindingIrSha256 !== model.bindingIrSha256
		|| compiled.assembly !== projection.assembly || canonicalJson(compiled.evidence) !== canonicalJson(evidence)
		|| canonicalJson(compiled.ownedValues ?? null) !== canonicalJson(projection.contract)
		|| !/^8\.0\.\d+$/u.test(compiled.sdk)
		|| (await nativeArtifactPaths(dotnetRoot)).some(path => path !== "native-dotnet.json" && !Object.hasOwn(compiled.files, path)))
		throw new Error("Compiled owned C# projection differs from compiler-authenticated types or native evidence");
	for(const [path, contents] of Object.entries(generateOwnedDotnetPackage(model.bindingIr, evidence).files))
		if(await readFile(join(dotnetRoot, path), "utf8") !== contents) throw new Error(`Generated owned C# source differs: ${path}`);
	if(await readFile(join(dotnetRoot, "global.json"), "utf8") !== canonicalJson({ sdk: { version: compiled.sdk, rollForward: "disable", allowPrerelease: false } }))
		throw new Error("Owned C# SDK selection differs from the compiled projection");
	const name = settings.name ?? projection.assembly, version = settings.version ?? model.component.version;
	validateOrdinaryNugetSettings({ name, version });
	const root = join(working, "packages/nuget", `${name}.${version}`);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const extension of ["dll", "xml"])
		await copy(join(dotnetRoot, `lib/net8.0/${projection.assembly}.${extension}`), `lib/net8.0/${projection.assembly}.${extension}`);
	for(const [file, path] of Object.entries(libraryPaths)) await copy(path, `runtimes/linux-x64/native/${file}`);
	for(const path of Object.keys(compiled.files).filter(path => path.startsWith("src/") || path === "binding-manifest.json"))
		await copy(join(dotnetRoot, path), `lean-bridge/dotnet/${path}`);
	await copy(join(dotnetRoot, "native-dotnet.json"), "lean-bridge/native-dotnet.json");
	await copy(join(dotnetRoot, "global.json"), "lean-bridge/dotnet/global.json");
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "allocation-guard.h", "artifacts.json", "callbacks.c"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined)
	{
		const bytes = await readFile(join(nativeRoot, "lake-generated-sources.json"));
		if(sha256(bytes) !== receipt.sourceIdentity.lakeDependencies.generatedSourcesSha256) throw new Error("Owned C# generated Lean inputs differ from compilation");
		await save("lean-bridge/component/lake-generated-sources.json", bytes);
	}
	await copy(join(adapterRoot, "native-dotnet-adapter.json"), "lean-bridge/native-dotnet-adapter.json");
	for(const path of Object.keys(adapter.files).filter(path => !path.startsWith("lib/") && !path.startsWith("gmp/lib/")))
		await copy(join(adapterRoot, path), `lean-bridge/adapter/${path}`);
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "lean-bridge/licenses/Lean-LICENSES");
	await copy(new URL("../../LICENSE", import.meta.url), "lean-bridge/licenses/LeanBridge-LICENSE");
	for(const [path, bytes] of (await readVerifiedSourceNotices(nativeRoot, model.sourceIdentity)).files)
		await save(`lean-bridge/licenses/${path}`, bytes);
	await save("README.md", `# ${name} ${version}\n\nRequires .NET 8 and Linux x86-64 with glibc ${glibcMinimumVersion} or newer. Consumers install this prepared NuGet archive without Lean, Node or native build tools.\n\n${await readFile(join(dotnetRoot, "README.md"), "utf8")}\n`);
	await save(`${name}.nuspec`, `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd"><metadata><id>${name}</id><version>${version}</version>${nugetPackageMetadata(compiledPackageMetadata(model.sourceIdentity))}<readme>README.md</readme><requireLicenseAcceptance>false</requireLicenseAcceptance><dependencies><group targetFramework="net8.0" /></dependencies></metadata></package>\n`);
	await save("_rels/.rels", `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/${name}.nuspec" Id="R1" /></Relationships>\n`);
	await save("[Content_Types].xml", `<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${["rels", "dll", "so", "10", "xml", "json", "md", "txt", "nuspec", "cs", "csproj", "lean", "h", "c", "cpp", "xz"].map(extension => `<Default Extension="${extension}" ContentType="${extension === "rels" ? "application/vnd.openxmlformats-package.relationships+xml" : "application/octet-stream"}"/>`).join("")}</Types>\n`);
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1
		, kind: "lean-bridge-owned-nuget-package", ecosystem: "nuget", name, version
		, component: model.component, bindingIrSha256: model.bindingIrSha256
		, runtimeIdentity: evidence.runtimeIdentity
		, sourceIdentity: model.sourceIdentity, glibcMinimumVersion
		, namespace: projection.namespace, assembly: projection.assembly
		, compiledProjectionSha256: sha256(canonicalJson(compiled))
		, ownedValues: projection.contract, files: inventory }));
	const archive = `${name}.${version}.nupkg`, bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "nuget", backend: "owned-dotnet-v1"
		, runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion
		, namespace: projection.namespace, assembly: projection.assembly
		, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
