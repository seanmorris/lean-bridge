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
 * Builds maven package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build maven package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 */
export const buildMavenPackage = async ({ bundleRoot, outputRoot }) => {
	const prepared = await prepareManagedPackage({ bundleRoot, outputRoot, ecosystem: "maven", targetId: "jvm" });
	const { output, bundle, manifest, manifestSha256, mapping, selected } = prepared;
	const binding = await readBindingManifest({ bundle, targetId: "jvm" });
	if(binding.bindingIrSha256 !== manifest.bindingIr.semanticSha256) throw new Error("JVM binding identity differs from the canonical Binding IR");
	const separator = mapping.name.indexOf(":");
	if(separator < 1) throw new Error("Maven package name must be groupId:artifactId");
	const groupId = mapping.name.slice(0, separator);
	const artifactId = mapping.name.slice(separator + 1);
	const coordinateRoot = join(output, "repository", ...groupId.split("."), artifactId, mapping.version);
	const jarRoot = join(output, "jar");
	const packagePath = artifact => {
		if(artifact.path.startsWith("artifacts/managed/jvm/classes/")) return artifact.path.slice("artifacts/managed/jvm/classes/".length);
		if(artifact.path.startsWith("artifacts/native/lib/")) return `META-INF/lean-bridge/native/linux-x64/${basename(artifact.path)}`;
		return `META-INF/lean-bridge/${artifact.path}`;
	};
	for(const artifact of selected)
	{
		await copy(join(bundle, artifact.path), join(jarRoot, packagePath(artifact)));
	}
	await mkdir(join(jarRoot, "META-INF"), { recursive: true });
	await writeFile(join(jarRoot, "META-INF/MANIFEST.MF"), `Manifest-Version: 1.0\nImplementation-Title: ${artifactId}\nImplementation-Version: ${mapping.version}\n\n`);
	await writeFile(join(jarRoot, "META-INF/lean-bridge/package-receipt.json"), json({ schemaVersion: 1, ecosystem: "maven", component: manifest.component.id, canonicalManifestSha256: manifestSha256 }));
	const jar = await createDeterministicZip({ directory: jarRoot, sourceDateEpoch: manifest.provenance.sourceDateEpoch });
	const jarName = `${artifactId}-${mapping.version}.jar`;
	const pomName = `${artifactId}-${mapping.version}.pom`;
	const pom = `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd"><modelVersion>4.0.0</modelVersion><groupId>${xml(groupId)}</groupId><artifactId>${xml(artifactId)}</artifactId><version>${xml(mapping.version)}</version><name>${xml(manifest.component.name)}</name><description>Generated JVM bindings with the native Lean component.</description><url>${xml(manifest.source.repository)}</url><licenses><license><name>${xml(manifest.licenses.expression)}</name></license></licenses></project>\n`;
	await mkdir(coordinateRoot, { recursive: true });
	const jarPath = join(coordinateRoot, jarName);
	const pomPath = join(coordinateRoot, pomName);
	await writeFile(jarPath, jar);
	await writeFile(pomPath, pom);
	await writeFile(`${jarPath}.sha256`, `${sha256(jar)}\n`);
	await writeFile(`${pomPath}.sha256`, `${sha256(pom)}\n`);
	const coreArtifacts = coreProjection({ selected, packagePath });
	await writeProjectionPlan({ output, backend: "maven-v1", ecosystem: "maven", manifest, manifestSha256, coreArtifacts, commands: ["internal-zip package.jar"] });
	return Object.freeze({ package: `${mapping.name}:${mapping.version}`, output, repository: join(output, "repository"), jar: jarPath, pom: pomPath, jarSha256: sha256(jar), pomSha256: sha256(pom), canonicalManifestSha256: manifestSha256, coreArtifacts: Object.freeze(coreArtifacts) });
};
