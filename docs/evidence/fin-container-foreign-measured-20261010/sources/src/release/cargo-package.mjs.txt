/**
 * Implements the Cargo package module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import {
	copyFile,
	mkdir,
	readFile,
	readdir,
	writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const tomlString = value => JSON.stringify(value);

const fail = (code, message, details = {}) => {
	const error = new Error(message);
	error.name = "CargoPackageError";
	error.code = code;
	error.details = details;
	throw error;
};

const ensureEmptyOutput = async output => {
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0) fail("output-not-empty", `Cargo package output is not empty: ${output}`);
};

const copy = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	await copyFile(source, destination);
};

const cargoManifest = ({ mapping, manifest, manifestSha256, target }) => `# Generated from canonical package ${manifestSha256}.
[package]
name = ${tomlString(mapping.name)}
version = ${tomlString(mapping.version)}
edition = "2021"
description = "Generated Rust bindings for ${manifest.component.name}."
license = ${tomlString(manifest.licenses.expression)}
repository = ${tomlString(manifest.source.repository)}
readme = "README.md"
include = ["src/**", "README.md", "LICENSE", "binding-manifest.json", "metadata/**", "lean-bridge/**", ".cargo_vcs_info.json"]

[lib]
path = "src/lib.rs"

[features]
default = []

[package.metadata.docs.rs]
all-features = true

[package.metadata.lean_bridge]
component = ${tomlString(manifest.component.id)}
binding_ir_sha256 = ${tomlString(manifest.bindingIr.semanticSha256)}
canonical_manifest_sha256 = ${tomlString(manifestSha256)}
target = ${tomlString(target.id)}
runtime_scope = ${tomlString(manifest.runtime.scope)}
shared_runtime = true
`;

const artifactMap = manifest => new Map(manifest.artifacts.map(artifact => [artifact.id, artifact]));

/**
 * Builds cargo package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build cargo package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 */
export const buildCargoPackage = async ({ bundleRoot, outputRoot }) => {
	const output = resolve(outputRoot);
	await ensureEmptyOutput(output);
	const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
	const mapping = manifest.packages.find(packageMapping => packageMapping.ecosystem === "cargo");
	if(!mapping) fail("mapping-absent", "canonical bundle has no Cargo package mapping");
	if(!mapping.eligible)
	{
		fail("package-ineligible", `canonical bundle is not eligible for Cargo projection: ${mapping.reason}`, {
			ecosystem: "cargo"
			, reason: mapping.reason
		});
	}
	const target = manifest.targets.find(candidate => candidate.id === mapping.target);
	if(!target?.eligible) fail("target-ineligible", `Cargo target is not eligible: ${mapping.target}`);

	const artifacts = artifactMap(manifest);
	const selected = mapping.publicArtifacts.map(id => artifacts.get(id));
	if(selected.some(artifact => !artifact)) fail("artifact-absent", "Cargo mapping names an absent artifact");
	const rustPrefix = "bindings/rust/";
	const rustArtifacts = manifest.artifacts.filter(artifact => artifact.path.startsWith(rustPrefix));
	for(const artifact of rustArtifacts)
	{
		if(!mapping.publicArtifacts.includes(artifact.id))
		{
			fail("binding-artifact-omitted", `Cargo mapping omits generated Rust artifact ${artifact.path}`);
		}
	}

	const generatedManifest = JSON.parse(await readFile(join(bundle, `${rustPrefix}binding-manifest.json`), "utf8"));
	if(generatedManifest.bindingIrSha256 !== manifest.bindingIr.semanticSha256)
	{
		fail("binding-identity-drift", "Rust binding manifest differs from the canonical Binding IR");
	}

	const crateRootName = `${mapping.name}-${mapping.version}`;
	const crateRoot = join(output, crateRootName);
	for(const path of generatedManifest.files)
	{
		if(path === "Cargo.toml") continue;
		await copy(join(bundle, `${rustPrefix}${path}`), join(crateRoot, path));
	}
	await copy(join(bundle, "LICENSE"), join(crateRoot, "LICENSE"));
	await writeFile(join(crateRoot, "Cargo.toml"), cargoManifest({ mapping, manifest, manifestSha256, target }));
	await writeFile(join(crateRoot, ".cargo_vcs_info.json"), json({
		git: { sha1: manifest.source.revision }
		, path_in_vcs: ""
	}));

	const metadataCopies = [
		["canonical-package.json", "metadata/canonical-package.json"]
		, ["canonical-package.sha256", "metadata/canonical-package.sha256"]
		, ["bundle-identity.json", "metadata/bundle-identity.json"]
		, ["metadata/assurance.json", "metadata/assurance.json"]
		, ["metadata/core-artifact-set.json", "metadata/core-artifact-set.json"]
		, ["metadata/sbom.spdx.json", "metadata/sbom.spdx.json"]
		, ["metadata/provenance.intoto.json", "metadata/provenance.intoto.json"]
	];
	for(const [source, destination] of metadataCopies) await copy(join(bundle, source), join(crateRoot, destination));
	for(const artifact of selected)
	{
		await copy(
			join(bundle, artifact.path),
			join(crateRoot, "lean-bridge/artifacts", artifact.path),
		);
	}

	const coreArtifacts = selected.filter(artifact => artifact.core).map(artifact => ({
		sourcePath: artifact.path
		, packagePath: `lean-bridge/artifacts/${artifact.path}`
		, sourceSha256: artifact.sha256
		, packageSha256: artifact.sha256
	}));
	const plan = {
		schemaVersion: 1
		, backend: "cargo-v1"
		, ecosystem: "cargo"
		, bundle: { id: manifest.component.id, manifestSha256 }
		, compilerAccess: false
		, scriptPolicy: "disabled"
		, versionSource: "canonical-manifest"
		, semanticSource: "canonical-manifest"
		, operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"]
		, commands: ["internal-ustar crate", "internal-gzip crate.tar"]
		, coreArtifacts
	};
	validatePackagingBackendPlan(plan);
	await writeFile(join(output, "cargo-projection.json"), json(plan));

	const archive = await createDeterministicTarGz({
		directory: crateRoot
		, archiveRoot: crateRootName
		, sourceDateEpoch: manifest.provenance.sourceDateEpoch
	});
	const archivePath = join(output, `${crateRootName}.crate`);
	await writeFile(archivePath, archive);
	return Object.freeze({
		package: `${mapping.name}@${mapping.version}`
		, output
		, archive: archivePath
		, archiveSha256: sha256(archive)
		, canonicalManifestSha256: manifestSha256
		, coreArtifacts: Object.freeze(coreArtifacts)
	});
};
