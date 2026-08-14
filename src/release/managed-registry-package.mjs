/**
 * Implements the managed registry package module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { validatePackagingBackendPlan } from "./backend-policy.mjs";
import { readVerifiedCanonicalBundle } from "./canonical-bundle-input.mjs";

/**
 * Computes the stable SHA-256 identity for supplied bytes so the deterministic release and independent-verification pipeline can detect byte drift.
 *
 * @param value - Bytes or text whose exact contents determine the returned SHA-256 digest.
 */
export const sha256 = value => createHash("sha256").update(value).digest("hex");
/**
 * Serializes supplied data as deterministic, newline-terminated JSON for the deterministic release and independent-verification pipeline.
 *
 * @param value - Registry metadata serialized with stable indentation and a trailing newline.
 */
export const json = value => `${JSON.stringify(value, null, 2)}\n`;

/**
 * Throws an ecosystem-tagged managed-package error with a stable code and structured diagnostic details.
 *
 * @param ecosystem - Registry ecosystem whose package projection failed.
 * @param code - Stable machine-readable code that identifies the failure category.
 * @param message - Human-readable explanation of the failure.
 * @param details - Structured diagnostic fields associated with the failure.
 */
export const failManagedPackage = (ecosystem, code, message, details = {}) => {
	const error = new Error(message);
	error.name = "ManagedRegistryPackageError";
	error.code = code;
	error.details = { ecosystem, ...details };
	throw error;
};

/**
 * Establishes empty output before any stateful work begins in the deterministic release and independent-verification pipeline.
 *
 * @param outputRoot - Filesystem root containing the output.
 * @param ecosystem - Registry ecosystem selecting package layout, commands, endpoint, and credential policy.
 */
export const ensureEmptyOutput = async (outputRoot, ecosystem) => {
	const output = resolve(outputRoot);
	await mkdir(output, { recursive: true });
	if((await readdir(output)).length !== 0)
	{
		failManagedPackage(ecosystem, "output-not-empty", `${ecosystem} package output is not empty: ${output}`);
	}
	return output;
};

/**
 * Creates the destination parent directory and copies source bytes without rewriting their contents.
 *
 * @param source - Existing artifact path whose bytes must remain unchanged.
 * @param destination - Package path that receives the copied artifact.
 */
export const copy = async (source, destination) => {
	await mkdir(dirname(destination), { recursive: true });
	await copyFile(source, destination);
};

/**
 * Prepares managed package in an isolated, deterministic form for the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to prepare managed package.
 * @param root0.bundleRoot - Filesystem root containing the bundle.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.ecosystem - Registry ecosystem selecting package layout, commands, endpoint, and credential policy.
 * @param root0.targetId - Stable identifier for the target.
 */
export const prepareManagedPackage = async ({ bundleRoot, outputRoot, ecosystem, targetId }) => {
	const output = await ensureEmptyOutput(outputRoot, ecosystem);
	const { root: bundle, manifest, manifestSha256 } = await readVerifiedCanonicalBundle(bundleRoot);
	const mapping = manifest.packages.find(candidate => candidate.ecosystem === ecosystem);
	if(!mapping) failManagedPackage(ecosystem, "mapping-absent", `canonical bundle has no ${ecosystem} package mapping`);
	if(!mapping.eligible)
	{
		failManagedPackage(ecosystem, "package-ineligible", `canonical bundle is not eligible for ${ecosystem} projection: ${mapping.reason}`, { reason: mapping.reason });
	}
	if(mapping.target !== targetId)
	{
		failManagedPackage(ecosystem, "target-drift", `${ecosystem} mapping targets ${mapping.target}, expected ${targetId}`);
	}
	const target = manifest.targets.find(candidate => candidate.id === targetId);
	if(!target?.eligible) failManagedPackage(ecosystem, "target-ineligible", `${targetId} is not eligible`);
	const artifactMap = new Map(manifest.artifacts.map(artifact => [artifact.id, artifact]));
	const selected = mapping.publicArtifacts.map(id => artifactMap.get(id));
	if(selected.some(artifact => !artifact)) failManagedPackage(ecosystem, "artifact-absent", `${ecosystem} mapping names an absent artifact`);
	return { output, bundle, manifest, manifestSha256, mapping, target, selected };
};

/**
 * Selects core artifacts and maps each one to an identity-preserving package-path record.
 *
 * @param root0 - Verified artifacts and path mapping used to construct the core projection.
 * @param root0.selected - Canonical-bundle artifacts selected for the managed registry package.
 * @param root0.packagePath - Mapper that chooses each artifact’s destination inside the package.
 */
export const coreProjection = ({ selected, packagePath }) => selected
  .filter(artifact => artifact.core)
  .map(artifact => ({
		sourcePath: artifact.path
		, packagePath: packagePath(artifact)
		, sourceSha256: artifact.sha256
		, packageSha256: artifact.sha256
  }));

/**
 * Writes projection plan in deterministic form with the metadata required by the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to write projection plan.
 * @param root0.output - Destination path or output record that receives the generated artifact.
 * @param root0.backend - Backend identifier or implementation selected for generation, execution, or package projection.
 * @param root0.ecosystem - Registry ecosystem selecting package layout, commands, endpoint, and credential policy.
 * @param root0.manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param root0.manifestSha256 - Expected SHA-256 identity used to detect drift in manifest.
 * @param root0.coreArtifacts - Identity-preserving core artifact mappings included in the registry projection.
 * @param root0.commands - Reproduction or packaging commands recorded in the projection plan.
 */
export const writeProjectionPlan = async ({ output, backend, ecosystem, manifest, manifestSha256, coreArtifacts, commands }) => {
	const plan = {
		schemaVersion: 1
		, backend
		, ecosystem
		, bundle: { id: manifest.component.id, manifestSha256 }
		, compilerAccess: false
		, scriptPolicy: "disabled"
		, versionSource: "canonical-manifest"
		, semanticSource: "canonical-manifest"
		, operations: ["select", "arrange", "copy", "rename", "render-registry-metadata", "archive", "compress"]
		, commands
		, coreArtifacts
	};
	validatePackagingBackendPlan(plan);
	await writeFile(join(output, `${ecosystem}-projection.json`), json(plan));
	return plan;
};

/**
 * Loads binding manifest, verifies its structure and identity, and returns it to the deterministic release and independent-verification pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to read binding manifest.
 * @param root0.bundle - Verified canonical bundle root containing the binding manifest and projected artifacts.
 * @param root0.targetId - Stable identifier for the target.
 */
export const readBindingManifest = async ({ bundle, targetId }) => {
	const path = join(bundle, `bindings/${targetId}/binding-manifest.json`);
	return JSON.parse(await readFile(path, "utf8"));
};
