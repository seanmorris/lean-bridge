/**
 * Implements the component package receipt module in the release subsystem.
 *
 * @file
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = value => createHash("sha256").update(value).digest("hex");

const canonicalValue = value => {
	if(Array.isArray(value)) return value.map(canonicalValue);
	if(value !== null && typeof value === "object")
	{
		return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
	}
	return value;
};

const canonicalJson = value => `${JSON.stringify(canonicalValue(value), null, 2)}\n`;

const exactKeys = (value, keys, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError(`${label} fields are not closed`);
};

const hash = (value, label) => {
	if(typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${label} must be a SHA-256 identity`);
};

// Keep coordinate validation here so the copied, Node-only verifier stays standalone.
const npmName = /^(?:[a-z0-9][a-z0-9._-]*|@[a-z0-9._-]+\/[a-z0-9._-]+)$(?![\s\S])/;
const semver = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$(?![\s\S])/;
const npmIdentity = (name, version) => {
	if(typeof name !== "string" || name.length > 214 || !npmName.test(name)
		|| ["node_modules", "favicon.ico"].includes(name)
		|| name.split("/").some(part => [".", "..", "@.", "@.."].includes(part)))
		throw new TypeError("npm name must be a lowercase package name of at most 214 characters, starting with a letter, digit or @scope/");
	const match = typeof version === "string" && version.length <= 256 ? semver.exec(version) : null;
	if(!match || match.slice(1, 4).some(part => !Number.isSafeInteger(Number(part))))
		throw new TypeError("npm version must be an exact SemVer version, such as 1.2.3 or 1.2.3-beta.1");
	if(version.includes("+")) throw new TypeError("npm version must omit +build metadata because npm removes it when publishing");
	return Object.freeze({ name, version, coordinate: `${name}@${version}` });
};

/**
 * Resolve npm settings without changing the compiled Lean component identity.
 *
 * @param component - Default name and version from Binding IR.
 * @param settings - Optional npm-specific name and version.
 */
export const componentNpmIdentity = (component, settings = {}) => {
	const identity = npmIdentity(settings.name ?? component.name, settings.version ?? component.version);
	if(identity.name === "@lean-bridge/runtime") throw new TypeError("The component npm name cannot replace @lean-bridge/runtime");
	return identity;
};

/**
 * Parse an exact npm coordinate, including scoped names and prerelease versions.
 *
 * @param coordinate - Package name followed by its exact version.
 */
export const parseNpmPackageCoordinate = coordinate => {
	if(typeof coordinate !== "string") throw new TypeError("npm coordinate must be a string");
	const separator = coordinate.lastIndexOf("@");
	if(separator < 1) throw new TypeError("npm coordinate must include an exact version after @");
	return npmIdentity(coordinate.slice(0, separator), coordinate.slice(separator + 1));
};

/**
 * Validates component package receipt against its closed contract before it enters the deterministic release and independent-verification pipeline.
 *
 * @param receipt - Release receipt whose evidence and identities are verified.
 */
export const validateComponentPackageReceipt = receipt => {
	exactKeys(receipt, [
		"schemaVersion"
		, "kind"
		, "component"
		, "source"
		, "bindingIrSha256"
		, "provenanceSha256"
		, "componentBundleSha256"
		, "componentIdentitySha256"
		, "componentArtifactSha256"
		, "runtimeRequirementSha256"
		, "runtime"
		, "package"
		, "policies"
		, "verificationCommand"
	], "component package receipt");
	if(![1, 2].includes(receipt.schemaVersion) || receipt.kind !== "lean-bridge-component-package-receipt") throw new TypeError("component package receipt version or kind is unsupported");
	exactKeys(receipt.component, ["id", "name", "version"], "receipt component");
	exactKeys(receipt.source, ["treeSha256"], "receipt source");
	exactKeys(receipt.runtime, ["package", "archive", "sha256"], "receipt runtime");
	exactKeys(receipt.package, ["package", "archive", "sha256"], "receipt package");
	exactKeys(receipt.policies, ["componentCompiledOnce", "runtimeShared", "runtimeBinaryInComponent", "nativeCallablesOnly"], "receipt policies");
	if(Object.values(receipt.component).some(value => typeof value !== "string" || value === "")
		|| receipt.component.id !== `${receipt.component.name}@${receipt.component.version}`) throw new TypeError("receipt component identity is inconsistent");
	for(const key of [
		"bindingIrSha256"
		, "provenanceSha256"
		, "componentBundleSha256"
		, "componentIdentitySha256"
		, "componentArtifactSha256", "runtimeRequirementSha256"
	]) hash(receipt[key], key);
	hash(receipt.source.treeSha256, "source.treeSha256");
	hash(receipt.runtime.sha256, "runtime.sha256");
	hash(receipt.package.sha256, "package.sha256");
	for(const item of [receipt.runtime, receipt.package])
	{
		if(typeof item.package !== "string" || item.package === "" || typeof item.archive !== "string" || item.archive === ""
			|| !/^[A-Za-z0-9@_+.-]+\.tgz$(?![\s\S])/.test(item.archive))
			throw new TypeError("receipt package coordinates or archive path are invalid");
	}
	if(receipt.schemaVersion === 1 && receipt.package.package !== receipt.component.id) throw new TypeError("receipt package does not name the component");
	if(receipt.schemaVersion === 2)
	{
		componentNpmIdentity(parseNpmPackageCoordinate(receipt.package.package));
		if(parseNpmPackageCoordinate(receipt.runtime.package).name !== "@lean-bridge/runtime")
			throw new TypeError("receipt runtime must name @lean-bridge/runtime");
	}
	if(receipt.policies.componentCompiledOnce !== true || receipt.policies.runtimeShared !== true || receipt.policies.runtimeBinaryInComponent !== false || receipt.policies.nativeCallablesOnly !== true)
	{
		throw new TypeError("receipt does not preserve component package policies");
	}
	if(typeof receipt.verificationCommand !== "string" || receipt.verificationCommand === "") throw new TypeError("receipt verification command is required");
	return true;
};

/**
 * Verifies component package receipt against recorded identities and rejects any drift before the deterministic release and independent-verification pipeline proceeds.
 *
 * @param root0 - Named inputs and dependency overrides used to verify component package receipt.
 * @param root0.receiptPath - Filesystem path to the receipt.
 * @param root0.artifactRoot - Filesystem root containing the artifact.
 */
export const verifyComponentPackageReceipt = async ({ receiptPath, artifactRoot = null }) => {
	const path = resolve(receiptPath);
	const source = await readFile(path, "utf8");
	const receipt = JSON.parse(source);
	validateComponentPackageReceipt(receipt);
	if(source !== canonicalJson(receipt)) throw new TypeError("component package receipt is not canonical JSON");
	const root = resolve(artifactRoot ?? dirname(path));
	for(const item of [receipt.runtime, receipt.package])
	{
		const actual = sha256(await readFile(join(root, item.archive)));
		if(actual !== item.sha256) throw new TypeError(`package archive differs from the receipt: ${item.archive}`);
	}
	return Object.freeze({
		verified: true
		, component: receipt.component.id
		, receiptSha256: sha256(source)
		, componentIdentitySha256: receipt.componentIdentitySha256
		, runtime: receipt.runtime.package
		, package: receipt.package.package
	});
};

if(process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
{
	const options = new Map();
	for(let index = 2; index < process.argv.length; index += 2) options.set(process.argv[index], process.argv[index + 1]);
	if(!options.get("--receipt")) throw new Error("--receipt is required");
	const result = await verifyComponentPackageReceipt({
		receiptPath: resolve(options.get("--receipt"))
		, artifactRoot: options.get("--artifacts") ? resolve(options.get("--artifacts")) : null
	});
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
