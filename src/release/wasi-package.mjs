/**
 * Implements the WASI package module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";
import { createDeterministicTarGz } from "./deterministic-archive.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;

const copy = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	await copyFile(source, destination);
};

const packagePath = path => {
	if(path === "artifacts/wasi/bin/lean-alpha-wasi-host") return "bin/lean-alpha-wasi-host";
	if(path.startsWith("artifacts/wasi/lib/")) return `lib/${basename(path)}`;
	if(path === "artifacts/wasi/component/lean-alpha.component.wasm") return "component/lean-alpha.component.wasm";
	if(path.endsWith("lean-alpha-adapter.wit")) return "wit/lean-alpha-adapter.wit";
	if(path === "bindings/wit/wit/lean-alpha.wit") return "wit/lean-alpha.wit";
	return `share/lean-bridge-alpha/${path}`;
};

/**
 * Builds WASI package from validated inputs with deterministic output suitable for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to build WASI package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 */
export const buildWasiPackage = async ({ bundleRoot, outputRoot }) => {
	const output = resolve(outputRoot);
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0) throw new Error(`WIT/WASI output is not empty: ${output}`);
	const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
	const mapping = manifest.packages.find(item => item.ecosystem === "wit-wasi");
	if(!mapping?.eligible) throw new Error(`canonical bundle is not eligible for WIT/WASI projection: ${mapping?.reason ?? "mapping absent"}`);
	const target = manifest.targets.find(item => item.id === mapping.target);
	if(!target?.eligible) throw new Error(`WIT/WASI target is not eligible: ${mapping.target}`);
	const artifacts = new Map(manifest.artifacts.map(item => [item.id, item]));
	const selected = mapping.publicArtifacts.map(id => artifacts.get(id));
	if(selected.some(item => !item)) throw new Error("WIT/WASI mapping names an absent artifact");

	const rootName = `${mapping.name}-${mapping.version}`;
	const packageRoot = join(output, rootName);
	for(const artifact of selected) await copy(join(bundle, artifact.path), join(packageRoot, packagePath(artifact.path)));
	await copy(join(bundle, "canonical-package.json"), join(packageRoot, "share/lean-bridge-alpha/canonical-package.json"));
	await copy(join(bundle, "canonical-package.sha256"), join(packageRoot, "share/lean-bridge-alpha/canonical-package.sha256"));

	const coreArtifacts = selected.filter(item => item.core).map(item => ({
		sourcePath: item.path
		, packagePath: `${rootName}/${packagePath(item.path)}`
		, sourceSha256: item.sha256
		, packageSha256: item.sha256
	}));
	const plan = {
		schemaVersion: 1
		, backend: "wit-wasi-v1"
		, ecosystem: "wit-wasi"
		, bundle: { id: manifest.component.id, manifestSha256 }
		, compilerAccess: false
		, scriptPolicy: "disabled"
		, versionSource: "canonical-manifest"
		, semanticSource: "canonical-manifest"
		, operations: ["select", "arrange", "copy", "rename", "archive", "compress"]
		, commands: ["internal-ustar package", "internal-gzip package.tar"]
		, coreArtifacts
	};
	validatePackagingBackendPlan(plan);
	await writeFile(join(output, "wit-wasi-projection.json"), json(plan));
	const archive = await createDeterministicTarGz({
		directory: packageRoot
		, archiveRoot: rootName
		, sourceDateEpoch: manifest.provenance.sourceDateEpoch
	});
	const archivePath = join(output, `${rootName}.tar.gz`);
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
