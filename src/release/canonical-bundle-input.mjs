import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
	hashCanonicalPackageManifest,
	parseCanonicalPackageManifest,
} from "./canonical-package-manifest.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");

/**
 * Loads verified canonical bundle, verifies its structure and identity, and returns it to the deterministic release and independent-verification pipeline.
 *
 * @param bundleRoot - Filesystem root containing the bundle.
 */
export const readVerifiedCanonicalBundle = async bundleRoot => {
	const root = resolve(bundleRoot);
	const source = await readFile(join(root, "canonical-package.json"), "utf8");
	const manifest = parseCanonicalPackageManifest(source);
	const manifestSha256 = hashCanonicalPackageManifest(manifest);
	const inventory = await readFile(join(root, "canonical-package.sha256"), "utf8");
	if(inventory !== `${manifestSha256}  canonical-package.json\n`)
	{
		throw new Error("canonical package hash inventory does not match the manifest");
	}
	for(const artifact of manifest.artifacts)
	{
		const bytes = await readFile(join(root, artifact.path));
		if(bytes.length !== artifact.bytes || sha256(bytes) !== artifact.sha256)
		{
			throw new Error(`canonical bundle artifact changed: ${artifact.path}`);
		}
	}
	const [identity, core] = await Promise.all([
		readFile(join(root, "bundle-identity.json"), "utf8").then(JSON.parse)
		, readFile(join(root, "metadata/core-artifact-set.json"), "utf8").then(JSON.parse)
	]);
	if(
		identity?.schemaVersion !== 1
    || identity.component !== manifest.component.id
    || identity.canonicalManifestSha256 !== manifestSha256
    || identity.coreArtifactSetSha256 !== core?.identitySha256
	) {
		throw new Error("bundle identity does not match the canonical manifest and core artifact set");
	}
	return Object.freeze({ root, manifest, manifestSha256 });
};
