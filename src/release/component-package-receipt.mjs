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
	if(receipt.schemaVersion !== 1 || receipt.kind !== "lean-bridge-component-package-receipt") throw new TypeError("component package receipt version or kind is unsupported");
	exactKeys(receipt.component, ["id", "name", "version"], "receipt component");
	exactKeys(receipt.source, ["treeSha256"], "receipt source");
	exactKeys(receipt.runtime, ["package", "archive", "sha256"], "receipt runtime");
	exactKeys(receipt.package, ["package", "archive", "sha256"], "receipt package");
	exactKeys(receipt.policies, ["componentCompiledOnce", "runtimeShared", "runtimeBinaryInComponent", "nativeCallablesOnly"], "receipt policies");
	if(receipt.component.id !== `${receipt.component.name}@${receipt.component.version}`) throw new TypeError("receipt component identity is inconsistent");
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
		if(typeof item.package !== "string" || item.package === "" || typeof item.archive !== "string" || item.archive === "" || item.archive.includes("/") || item.archive.includes(".."))
		{
			throw new TypeError("receipt package coordinates or archive path are invalid");
		}
	}
	if(receipt.package.package !== receipt.component.id) throw new TypeError("receipt package does not name the component");
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
