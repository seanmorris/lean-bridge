import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { createDeterministicZip } from "./deterministic-zip.mjs";
import {
	copy,
	coreProjection,
	json,
	prepareManagedPackage,
	readBindingManifest,
	sha256,
	writeProjectionPlan,
} from "./managed-registry-package.mjs";

const xml = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Builds nuget package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build nuget package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 */
export const buildNugetPackage = async ({ bundleRoot, outputRoot }) => {
	const prepared = await prepareManagedPackage({ bundleRoot, outputRoot, ecosystem: "nuget", targetId: "dotnet" });
	const { output, bundle, manifest, manifestSha256, mapping, selected } = prepared;
	const binding = await readBindingManifest({ bundle, targetId: "dotnet" });
	if(binding.bindingIrSha256 !== manifest.bindingIr.semanticSha256) throw new Error(".NET binding identity differs from the canonical Binding IR");
	const root = join(output, "package");
	const packagePath = artifact => {
		if(artifact.path.startsWith("artifacts/managed/dotnet/lib/net8.0/")) return `lib/net8.0/${basename(artifact.path)}`;
		if(artifact.path.startsWith("artifacts/native/lib/")) return `runtimes/linux-x64/native/${basename(artifact.path)}`;
		return `lean-bridge/${artifact.path}`;
	};
	for(const artifact of selected) await copy(join(bundle, artifact.path), join(root, packagePath(artifact)));
	const nuspecName = `${mapping.name}.nuspec`;
	await mkdir(join(root, "_rels"), { recursive: true });
	await writeFile(join(root, nuspecName), `<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd"><metadata><id>${xml(mapping.name)}</id><version>${xml(mapping.version)}</version><authors>Lean Bridge</authors><description>Generated .NET bindings for ${xml(manifest.component.name)} with the native Lean component.</description><license type="expression">${xml(manifest.licenses.expression)}</license><repository type="git" url="${xml(manifest.source.repository)}" commit="${xml(manifest.source.revision)}"/><requireLicenseAcceptance>false</requireLicenseAcceptance></metadata></package>\n`);
	await writeFile(join(root, "_rels/.rels"), `<?xml version="1.0" encoding="utf-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/${xml(nuspecName)}" Id="R1" /></Relationships>\n`);
	await writeFile(join(root, "[Content_Types].xml"), `<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="psmdcp" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Default Extension="dll" ContentType="application/octet"/><Default Extension="so" ContentType="application/octet"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="json" ContentType="application/json"/><Default Extension="md" ContentType="text/markdown"/><Default Extension="txt" ContentType="text/plain"/><Default Extension="nuspec" ContentType="application/octet"/></Types>\n`);
	await writeFile(join(root, "lean-bridge/package-receipt.json"), json({ schemaVersion: 1, ecosystem: "nuget", component: manifest.component.id, canonicalManifestSha256: manifestSha256 }));
	const coreArtifacts = coreProjection({ selected, packagePath });
	await writeProjectionPlan({ output, backend: "nuget-v1", ecosystem: "nuget", manifest, manifestSha256, coreArtifacts, commands: ["internal-zip package.nupkg"] });
	const archive = await createDeterministicZip({ directory: root, sourceDateEpoch: manifest.provenance.sourceDateEpoch });
	const archivePath = join(output, `${mapping.name}.${mapping.version}.nupkg`);
	await writeFile(archivePath, archive);
	return Object.freeze({ package: `${mapping.name}@${mapping.version}`, output, archive: archivePath, archiveSha256: sha256(archive), canonicalManifestSha256: manifestSha256, coreArtifacts: Object.freeze(coreArtifacts) });
};
