/**
 * Authenticate complete nominal npm archives without extracting or executing them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateComponentPackageReceipt, parseNpmPackageCoordinate } from "../../src/release/component-package-receipt.mjs";
import { readOwnedPerlCallbackVariantTar as readRepositoryTar } from "./owned-perl-callback-result-variant-archives.mjs";

/**
 * Enumerate the receipt and both complete archive originals retained by a browser run.
 *
 * @param receipt - Independently validated npm handoff receipt.
 */
export const nominalSubtypeBrowserHandoffRecords = receipt => {
	validateComponentPackageReceipt(receipt);
	return ["component-package-receipt.json"
		, "verify-component-package-receipt.mjs"
		, receipt.runtime.archive, receipt.package.archive
	].map(path => "handoff/" + path);
};

/**
 * Bind installed file closures and package-lock integrity to actual archive bytes.
 *
 * @param read - Selection-relative original byte reader.
 * @param npm - Validated npm execution report.
 * @param original - Frozen producer source reader.
 */
export const assertNominalSubtypeBrowserHandoff = async (read, npm, original) => {
	validateComponentPackageReceipt(npm.receipt);
	assert.equal((await read("handoff/component-package-receipt.json")).toString(), canonicalJson(npm.receipt));
	assert.deepEqual(await read("handoff/verify-component-package-receipt.mjs"), original("src/release/component-package-receipt.mjs"));
	const basisBytes = await read("browser-javascript/installed-runtime-identity.json");
	const basis = JSON.parse(basisBytes);
	assert.equal(basisBytes.toString(), canonicalJson(basis));
	assert.equal(typeof basis.packing.collationLocale, "string");
	assert.ok(basis.packing.collationLocale.length > 0);
	const artifacts = {};
	for(const item of [npm.receipt.runtime, npm.receipt.package])
	{
		const bytes = await read("handoff/" + item.archive);
		assert.equal(sha256(bytes), item.sha256, item.archive);
		const files = readRepositoryTar(bytes, "package", basis.packing.collationLocale);
		const metadata = JSON.parse(files.get("package.json"));
		const { name, version } = parseNpmPackageCoordinate(item.package);
		assert.equal(metadata.name, name); assert.equal(metadata.version, version);
		assert.deepEqual(Object.fromEntries([...files].map(([path, bytes]) => [path, sha256(bytes)])), npm.trees[name]);
		if(name === "@lean-bridge/runtime")
		{
			assert.deepEqual(files.get("runtime-identity.json"), basisBytes);
			assert.equal(metadata.leanBridge.runtimeIdentity, sha256(basisBytes));
			assert.deepEqual([...files.keys()].sort(), [...basis.files.map(file => file.path), "package.json", "runtime-identity.json"].sort());
			assert.equal(new Set(basis.files.map(file => file.path)).size, basis.files.length);
			for(const file of basis.files) assert.equal(sha256(files.get(file.path)), file.sha256, file.path);
		}
		else assert.equal(name, "nominalsubtypes");
		artifacts[name] = { bytes: bytes.length, sha256: sha256(bytes)
			, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") };
	}
	return artifacts;
};
