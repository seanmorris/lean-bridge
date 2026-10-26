/**
 * Bind an extracted npm manifest to its receipt before checking installed files.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Return the independently expected installation name after verifying its receipt identity.
 *
 * @param entry - Component or runtime archive entry from the verified receipt.
 * @param manifest - Package manifest extracted from that exact archive.
 * @param expectedName - Independently specified component or runtime package name.
 */
export const structuralSubtypeNpmPackageName = (entry, manifest, expectedName) => {
	assert.equal(manifest.name, expectedName);
	assert.equal(typeof manifest.version, "string");
	assert.ok(manifest.version.length > 0);
	assert.equal(entry.package, `${manifest.name}@${manifest.version}`);
	return expectedName;
};
