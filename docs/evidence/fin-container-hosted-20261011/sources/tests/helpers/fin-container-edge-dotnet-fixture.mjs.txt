/**
 * Real Lean and production C# wrappers in a synthetic NuGet receipt for observer source controls.
 * This is not canonical two-root installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { generateCopiedDotnetPackage } from "../../src/backends/dotnet/copied-values.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { compileFinContainerEdgeSplitFixture } from "./fin-container-edge-compiled-fixture.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Compile actual Lean, native adapters and the unmodified generated managed API.
 *
 * @param t - Source test owning the temporary files.
 */
export const finContainerEdgeDotnetPublicFixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-edge-dotnet-public-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const compiled = join(root, "compiled"); await mkdir(compiled);
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2/bin/lean");
	const { model, prefix } = await compileFinContainerEdgeSplitFixture(compiled, lean, { relocatable: true });
	const payload = join(root, "payload"), nativeDirectory = join(payload, "runtimes/linux-x64/native");
	await mkdir(nativeDirectory, { recursive: true });
	const libraries = {};
	for(const name of ["libedge-source.so", "liblean_bridge_native.so", "libleanshared.so", "libleanshared_1.so", "libleanshared_2.so"])
	{
		const source = join(name.startsWith("libleanshared") ? join(prefix, "lib/lean") : compiled, name);
		const dynamic = await runCopied("/usr/bin/readelf", ["-d", source], root);
		assert.ok(!dynamic.stdout.includes(prefix), `.NET fixture ${name} must not load libraries from the compiler tree`);
		await copyFile(source, join(nativeDirectory, name)); libraries[name] = sha256(await readFile(source));
	}
	const bindingIrSha256 = hashBindingIr(model.bindingIr);
	const generated = generateCopiedDotnetPackage(model.bindingIr, { componentId: model.component.id
		, runtimeIdentity: sha256("synthetic .NET edge source runtime")
		, componentReceiptSha256: sha256(canonicalJson({ libraries, bindingIrSha256 }))
		, library: "libedge-source.so", libraries });
	const manifest = JSON.parse(generated["binding-manifest.json"]), { assembly } = manifest;
	const command = await realpath(resolve(process.env.LEAN_BRIDGE_DOTNET ?? ".toolchains/dotnet/dotnet"));
	const author = join(root, "author");
	for(const [path, bytes] of Object.entries(generated)) await saveLakeFile(author, path, bytes);
	const env = { ...copiedCleanEnvironment, DOTNET_ROOT: dirname(command), DOTNET_CLI_HOME: join(root, "dotnet-home"), DOTNET_CLI_TELEMETRY_OPTOUT: "1", DOTNET_NOLOGO: "1" };
	await runCopied(command, ["build", `src/${assembly}/${assembly}.csproj`, "--disable-build-servers", "-p:UseSharedCompilation=false", "-p:NuGetAudit=false", "-o", "out"], author, env);
	for(const suffix of ["dll", "xml"]) await saveLakeFile(payload, `lib/net8.0/${assembly}.${suffix}`, await readFile(join(author, `out/${assembly}.${suffix}`)));
	const name = assembly, version = model.component.version;
	await saveLakeFile(payload, `${name}.nuspec`, `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd"><metadata><id>${name}</id><version>${version}</version><authors>Fixture</authors><description>Real Lean source observer control</description><dependencies><group targetFramework="net8.0" /></dependencies></metadata></package>\n`);
	await saveLakeFile(payload, "_rels/.rels", `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/${name}.nuspec" Id="R1" /></Relationships>\n`);
	await saveLakeFile(payload, "[Content_Types].xml", '<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="dll" ContentType="application/octet-stream"/><Default Extension="nuspec" ContentType="application/octet-stream"/></Types>\n');
	const modelBytes = Buffer.from(JSON.stringify({ ...model, bindingIrSha256 }));
	await saveLakeFile(payload, "lean-bridge/component/model.json", modelBytes);
	const files = {};
	for(const path of await nativeArtifactPaths(payload))
	{
		const bytes = await readFile(join(payload, path)); files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	const receiptPath = "lean-bridge/package-receipt.json";
	const receiptBytes = Buffer.from(canonicalJson({ schemaVersion: 1, kind: "lean-bridge-ordinary-nuget-package", ecosystem: "nuget", name, version, assembly, component: model.component, bindingIrSha256, files }));
	await saveLakeFile(payload, receiptPath, receiptBytes);
	const bytes = await createDeterministicZip({ directory: payload, sourceDateEpoch: 315532800 });
	const archiveName = `${name}.${version}.nupkg`;
	await saveLakeFile(root, archiveName, bytes);
	return { root, command, payload, nativeDirectory, libraries, model, modelBytes
		, receiptPath, receiptBytes
		, archive: join(root, archiveName), archiveSha256: sha256(bytes)
		, handoff: root
		, packages: [{ role: "component", name, version, artifacts: [{ path: archiveName, sha256: sha256(bytes) }] }] };
};
