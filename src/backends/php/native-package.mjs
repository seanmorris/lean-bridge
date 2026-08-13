import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";
import { generatePhpBindingPackage } from "./generate.mjs";
import { generatePhpNativeRuntimePackage } from "./native-runtime.mjs";
import { generatePhpZendExtensionPackage } from "./zend-extension.mjs";

/**
 * Reports PHP native package failures with stable machine-readable codes and structured diagnostic context.
 */
export class PhpNativePackageError extends Error
{
	/**
   * Initializes the error used to report PHP native package failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "PhpNativePackageError";
		this.code = code;
		this.details = Object.freeze(structuredClone(details));
	}
}

const fail = (code, message, details = {}) => {
	throw new PhpNativePackageError(code, message, details);
};

const sha256 = source => createHash("sha256").update(source).digest("hex");
const hashPattern = /^[0-9a-f]{64}$/;

const requireObject = (value, path) => {
	if(value === null || typeof value !== "object" || Array.isArray(value))
	{
		fail("invalid-native-package-manifest", `${path} must be an object`, { path });
	}
};

const requireKeys = (value, required, path) => {
	requireObject(value, path);
	const expected = new Set(required);
	const missing = required.filter(key => !(key in value));
	const unknown = Object.keys(value).filter(key => !expected.has(key));
	if(missing.length || unknown.length)
	{
		fail("invalid-native-package-manifest", `${path} has missing or unknown fields`, {
			path
			, missing
			, unknown
		});
	}
};

const requireString = (value, path, pattern = null) => {
	if(typeof value !== "string" || value.length === 0 || pattern && !pattern.test(value))
	{
		fail("invalid-native-package-manifest", `${path} has an invalid string value`, { path, value });
	}
};

const requireRelativePath = (value, path) => {
	requireString(value, path);
	const normalized = normalize(value);
	if(isAbsolute(value) || normalized === ".." || normalized.startsWith(`..${sep}`) || normalized !== value)
	{
		fail("invalid-native-package-manifest", `${path} must be a normalized project-relative path`, {
			path
			, value
		});
	}
};

/**
 * Validates PHP native package manifest against its closed contract before it enters the generated native-language binding pipeline.
 *
 * @param manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 */
export const validatePhpNativePackageManifest = manifest => {
	requireKeys(manifest, [
		"schemaVersion"
		, "packageId"
		, "bindingIr"
		, "lean"
		, "target"
		, "artifacts"
		, "sourceDateEpoch"
	], "manifest");
	if(manifest.schemaVersion !== 1) fail("unsupported-native-package-schema", "native PHP package schemaVersion must be 1");
	requireString(manifest.packageId, "manifest.packageId");

	requireKeys(manifest.bindingIr, ["path", "fileSha256", "semanticSha256"], "manifest.bindingIr");
	requireRelativePath(manifest.bindingIr.path, "manifest.bindingIr.path");
	requireString(manifest.bindingIr.fileSha256, "manifest.bindingIr.fileSha256", hashPattern);
	requireString(manifest.bindingIr.semanticSha256, "manifest.bindingIr.semanticSha256", hashPattern);

	requireKeys(manifest.lean, ["source", "sourceSha256", "module", "initializer"], "manifest.lean");
	requireRelativePath(manifest.lean.source, "manifest.lean.source");
	requireString(manifest.lean.sourceSha256, "manifest.lean.sourceSha256", hashPattern);
	requireString(manifest.lean.module, "manifest.lean.module", /^[A-Za-z][A-Za-z0-9_.]*$/);
	requireString(manifest.lean.initializer, "manifest.lean.initializer", /^initialize_[A-Za-z][A-Za-z0-9_]*$/);

	requireKeys(manifest.target, ["system", "architecture", "php", "threadSafety", "sharedRuntimeAbi"], "manifest.target");
	if(manifest.target.system !== "linux" || manifest.target.architecture !== "x86_64")
	{
		fail("unsupported-native-package-target", "the native PHP POC targets x86_64 Linux", { target: manifest.target });
	}
	if(manifest.target.php !== ">=8.2 <9" || manifest.target.threadSafety !== "nts" || manifest.target.sharedRuntimeAbi !== 1)
	{
		fail("unsupported-native-package-target", "the native PHP POC requires PHP 8.2 or newer NTS and shared runtime ABI 1", {
			target: manifest.target
		});
	}

	requireKeys(manifest.artifacts, ["runtimeLibrary", "extension", "composerPackage", "metadata"], "manifest.artifacts");
	for(const [name, path] of Object.entries(manifest.artifacts)) requireRelativePath(path, `manifest.artifacts.${name}`);
	if(
		manifest.artifacts.runtimeLibrary !== "lib/liblean_bridge_native.so"
    || !/^lib\/php\/[a-z0-9_]+\.so$/.test(manifest.artifacts.extension)
    || manifest.artifacts.composerPackage !== "share/php/component"
    || manifest.artifacts.metadata !== "share/lean-bridge"
	) {
		fail("unsupported-native-package-layout", "the native PHP package layout does not match version 1", {
			artifacts: manifest.artifacts
		});
	}
	if(!Number.isSafeInteger(manifest.sourceDateEpoch) || manifest.sourceDateEpoch < 1)
	{
		fail("invalid-native-package-manifest", "manifest.sourceDateEpoch must be a positive safe integer");
	}
	return true;
};

const checkedProjectPath = (projectRoot, path, field) => {
	const absolute = resolve(projectRoot, path);
	const inside = relative(projectRoot, absolute);
	if(inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside))
	{
		fail("native-package-path-escape", `${field} escapes the project root`, { field, path });
	}
	return absolute;
};

/**
 * Loads PHP native package inputs, verifies its structure and identity, and returns it to the generated native-language binding pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to read PHP native package inputs.
 * @param root0.projectRoot - Filesystem root containing the project.
 * @param root0.manifestPath - Filesystem path to the manifest.
 */
export const readPhpNativePackageInputs = async ({ projectRoot, manifestPath }) => {
	const manifestAbsolute = checkedProjectPath(projectRoot, manifestPath, "manifestPath");
	let manifest;
	try
	{
		manifest = JSON.parse(await readFile(manifestAbsolute, "utf8"));
	} catch(error)
	{
		fail("invalid-native-package-manifest", `cannot read ${manifestPath}`, { cause: error.message });
	}
	validatePhpNativePackageManifest(manifest);
	const bindingIrAbsolute = checkedProjectPath(projectRoot, manifest.bindingIr.path, "bindingIr.path");
	const leanSourceAbsolute = checkedProjectPath(projectRoot, manifest.lean.source, "lean.source");
	const [bindingIrSource, leanSource] = await Promise.all([
		readFile(bindingIrAbsolute)
		, readFile(leanSourceAbsolute)
	]);
	if(sha256(bindingIrSource) !== manifest.bindingIr.fileSha256)
	{
		fail("native-package-input-drift", "Binding IR file hash does not match the package manifest", {
			path: manifest.bindingIr.path
		});
	}
	if(sha256(leanSource) !== manifest.lean.sourceSha256)
	{
		fail("native-package-input-drift", "Lean source hash does not match the package manifest", {
			path: manifest.lean.source
		});
	}
	const bindingIr = JSON.parse(bindingIrSource.toString("utf8"));
	validateBindingIr(bindingIr);
	if(hashBindingIr(bindingIr) !== manifest.bindingIr.semanticSha256)
	{
		fail("native-package-input-drift", "Binding IR semantic hash does not match the package manifest", {
			path: manifest.bindingIr.path
		});
	}
	if(bindingIr.component.id !== manifest.packageId.replace(/-php-native(?=@)/, ""))
	{
		fail("native-package-component-mismatch", "packageId does not identify the Binding IR component", {
			packageId: manifest.packageId
			, component: bindingIr.component.id
		});
	}
	return Object.freeze({
		manifest: Object.freeze(structuredClone(manifest))
		, bindingIr: Object.freeze(bindingIr)
		, manifestAbsolute
		, bindingIrAbsolute
		, leanSourceAbsolute
	});
};

/**
 * Generates PHP native package sources from validated semantic input without introducing behavior outside the generated native-language binding pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to generate PHP native package sources.
 * @param root0.manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param root0.bindingIr - Binding IR document that defines the source types and operations.
 */
export const generatePhpNativePackageSources = ({ manifest, bindingIr }) => {
	validatePhpNativePackageManifest(manifest);
	validateBindingIr(bindingIr);
	if(hashBindingIr(bindingIr) !== manifest.bindingIr.semanticSha256)
	{
		fail("native-package-input-drift", "Binding IR semantic hash changed before generation");
	}
	return Object.freeze({
		composer: generatePhpBindingPackage(bindingIr)
		, zend: generatePhpZendExtensionPackage(bindingIr)
		, runtime: generatePhpNativeRuntimePackage(bindingIr)
	});
};

/**
 * Binds validated PHP native inputs, generated sources, target facts, and artifact hashes into the release manifest.
 *
 * @param root0 - Named inputs and dependency overrides used to create PHP native release manifest.
 * @param root0.manifest - Domain manifest whose schema, closed fields, and recorded identities are validated or serialized.
 * @param root0.bindingIr - Binding IR document that defines the source types and operations.
 * @param root0.observedTarget - Compiler-observed PHP target triple recorded in the native package manifest.
 * @param root0.artifacts - Artifact records whose paths, sizes, and content identities are bound into the result.
 * @param root0.generated - Generated native package sources and metadata included in the PHP release manifest.
 */
export const createPhpNativeReleaseManifest = ({ manifest, bindingIr, observedTarget, artifacts, generated }) => {
	validatePhpNativePackageManifest(manifest);
	const artifactRecords = Object.entries(artifacts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, value]) => ({ path, bytes: value.length, sha256: sha256(value) }));
	return Object.freeze({
		schemaVersion: 1
		, packageId: manifest.packageId
		, component: bindingIr.component
		, bindingIr: structuredClone(manifest.bindingIr)
		, lean: structuredClone(manifest.lean)
		, target: structuredClone(manifest.target)
		, observedTarget: structuredClone(observedTarget)
		, sharedRuntime: {
			abiVersion: manifest.target.sharedRuntimeAbi
			, scope: "php-process"
			, identityDomain: "php-process"
			, threadPolicy: "php-nts-only"
		}
		, generators: {
			composer: JSON.parse(generated.composer["binding-manifest.json"]).generator
			, zend: JSON.parse(generated.zend["zend-manifest.json"]).generator
			, runtime: JSON.parse(generated.runtime["native-runtime-manifest.json"]).generator
		}
		, sourceDateEpoch: manifest.sourceDateEpoch
		, artifacts: artifactRecords
		, reproducibility: {
			releaseCriterion: "byte-identical"
			, cleanBuildsRequired: 2
			, rebuildCommand: "npm run test:php-native-package"
			, pathPolicy: "prefix-mapped, stripped native binaries with relative runtime search path"
		}
	});
};
