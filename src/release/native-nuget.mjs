/**
 * Assemble deterministic ordinary NuGet archives without compiler access.
 *
 * @file
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../build/native-artifacts.mjs";
import { ordinaryDotnetEvidence } from "../build/native-dotnet-artifacts.mjs";
import { generateCopiedDotnetPackage } from "../backends/dotnet/copied-values.mjs";
import { validateOrdinaryNugetSettings } from "../backends/dotnet/copied-model.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

/**
 * Package exact managed/native artifacts, provenance, and dependency licenses.
 *
 * @param options - Verified inputs and optional NuGet coordinates.
 * @param options.working - Private output staging directory.
 * @param options.dotnetRoot - Compiled managed artifacts and inventory.
 * @param options.nativeRoot - Compiled component and source evidence.
 * @param options.runtimeRoot - Shared runtime and identity.
 * @param options.adapterRoot - Checked compiled C adapter.
 * @param options.leanPrefix - Lean license notices.
 * @param options.settings - Optional NuGet name and version.
 * @param options.glibcMinimumVersion - Validated Linux ABI floor.
 */
export const packageOrdinaryNuget = async ({ working, dotnetRoot, nativeRoot, runtimeRoot, adapterRoot, leanPrefix, settings = {}, glibcMinimumVersion }) => {
	validateOrdinaryNugetSettings(settings);
	const { model, projection, evidence, receipt } = await ordinaryDotnetEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	const compiled = JSON.parse(await readFile(join(dotnetRoot, "native-dotnet.json"), "utf8"));
	await verifyNativeFiles(dotnetRoot, compiled.files);
	if(compiled.schemaVersion !== 1 || compiled.profile !== "native-library-v1" || compiled.bindingIrSha256 !== model.bindingIrSha256
		|| compiled.assembly !== projection.assembly || canonicalJson(compiled.evidence) !== canonicalJson(evidence)
		|| !/^8\.0\.\d+$/.test(compiled.sdk)
		|| (await nativeArtifactPaths(dotnetRoot)).some(path => path !== "native-dotnet.json" && !Object.hasOwn(compiled.files, path))) throw new Error("Compiled .NET projection differs from the source model or native evidence");
	for(const [path, contents] of Object.entries(generateCopiedDotnetPackage(model.bindingIr, evidence)))
		if(await readFile(join(dotnetRoot, path), "utf8") !== contents) throw new Error("Generated .NET source differs from the compiled package model");
	if(await readFile(join(dotnetRoot, "global.json"), "utf8") !== canonicalJson({ sdk: { version: compiled.sdk, rollForward: "disable", allowPrerelease: false } })) throw new Error(".NET SDK selection differs from the compiled projection");
	const name = settings.name ?? projection.assembly, version = settings.version ?? model.component.version;
	validateOrdinaryNugetSettings({ name, version });
	const root = join(working, "packages/nuget", `${name}.${version}`);
	const save = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes, { flag: "wx" }); };
	const copy = async (source, path) => save(path, await readFile(source));
	for(const extension of ["dll", "xml"]) await copy(join(dotnetRoot, `lib/net8.0/${projection.assembly}.${extension}`), `lib/net8.0/${projection.assembly}.${extension}`);
	for(const file of Object.keys(evidence.libraries))
	{
		const source = file === evidence.library ? join(adapterRoot, "lib", file) : file === receipt.library ? join(nativeRoot, file) : join(runtimeRoot, "lib", file);
		await copy(source, `runtimes/linux-x64/native/${file}`);
	}
	for(const path of Object.keys(compiled.files).filter(path => path.startsWith("src/") || path === "binding-manifest.json")) await copy(join(dotnetRoot, path), `lean-bridge/dotnet/${path}`);
	await copy(join(dotnetRoot, "native-dotnet.json"), "lean-bridge/native-dotnet.json");
	await copy(join(dotnetRoot, "global.json"), "lean-bridge/dotnet/global.json");
	for(const path of ["native-component.json", "model.json", "metadata.json", "binding-ir.json", "generated.lean", "component.h", "artifacts.json"])
		await copy(join(nativeRoot, path), `lean-bridge/component/${path}`);
	if(receipt.sourceIdentity.lakeDependencies?.generatedSourcesSha256 !== undefined) await copy(join(nativeRoot, "lake-generated-sources.json"), "lean-bridge/component/lake-generated-sources.json");
	await copy(join(adapterRoot, "native-c-adapter.json"), "lean-bridge/native-c-adapter.json");
	await copy(join(runtimeRoot, "runtime.json"), "lean-bridge/runtime.json");
	await copy(join(leanPrefix, "LICENSE"), "lean-bridge/licenses/Lean-LICENSE");
	await copy(join(leanPrefix, "LICENSES"), "lean-bridge/licenses/Lean-LICENSES");
	await copy(fileURLToPath(new URL("../../LICENSE", import.meta.url)), "lean-bridge/licenses/LeanBridge-LICENSE");
	await save("README.md", `# ${name} ${version}\n\nInstall this prepared NuGet archive and call ${projection.namespace}.Api. Requires .NET 8 and Linux x86-64 with glibc ${glibcMinimumVersion} or newer. The native component and compatible shared runtime are included and loaded automatically. Consumers do not need Lean, Node, a C compiler or handwritten marshalling.\n\n${await readFile(join(dotnetRoot, "README.md"), "utf8")}\n`);
	await save(`${name}.nuspec`, `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd"><metadata><id>${name}</id><version>${version}</version><authors>${name}</authors><description>Compiled Lean API with generated C# conversions and native runtime.</description><readme>README.md</readme><requireLicenseAcceptance>false</requireLicenseAcceptance><dependencies><group targetFramework="net8.0" /></dependencies></metadata></package>\n`);
	await save("_rels/.rels", `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/${name}.nuspec" Id="R1" /></Relationships>\n`);
	await save("[Content_Types].xml", `<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${["rels", "dll", "so", "xml", "json", "md", "txt", "nuspec", "cs", "csproj", "lean", "h"].map(extension => `<Default Extension="${extension}" ContentType="${extension === "rels" ? "application/vnd.openxmlformats-package.relationships+xml" : "application/octet-stream"}"/>`).join("")}</Types>\n`);
	const inventory = {};
	for(const path of await nativeArtifactPaths(root))
	{ const bytes = await readFile(join(root, path)); inventory[path] = { bytes: bytes.length, sha256: sha256(bytes) }; }
	await save("lean-bridge/package-receipt.json", canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-nuget-package", ecosystem: "nuget", name, version, component: model.component, bindingIrSha256: model.bindingIrSha256, runtimeIdentity: evidence.runtimeIdentity, sourceIdentity: model.sourceIdentity, glibcMinimumVersion, namespace: projection.namespace, assembly: projection.assembly, compiledProjectionSha256: sha256(canonicalJson(compiled)), files: inventory }));
	const archive = `${name}.${version}.nupkg`, bytes = await createDeterministicZip({ directory: root, sourceDateEpoch: 315532800 });
	await mkdir(join(working, "archives"), { recursive: true });
	await writeFile(join(working, "archives", archive), bytes, { flag: "wx" });
	return { ecosystem: "nuget", backend: "ordinary-dotnet-v1", runtimeIdentity: evidence.runtimeIdentity, glibcMinimumVersion, namespace: projection.namespace, assembly: projection.assembly, packages: [{ archive, name, version, bytes: bytes.length, sha256: sha256(bytes), compilerAccess: false }] };
};
