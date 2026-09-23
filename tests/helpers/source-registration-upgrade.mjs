/**
 * Extend existing receipt verification to additive test-manifest registrations.
 * Reconstruct the older verifier byte-for-byte; never exempt production sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Admit only an exactly reversible checker addition or an existing checked test
 * registration. This is also used by the immutable Perl regression receipt.
 *
 * @param path - Original receipt's source path.
 * @param source - Current complete file text.
 * @param expected - Original receipt digest, not a refreshed acceptance claim.
 */
export const assertTestManifestRegistration = async (path, source, expected) => {
	if(path === "tests/helpers/source-registration-history.mjs")
	{
		for(const addition of [
			'import { assertTestManifestRegistration } from "./source-registration-upgrade.mjs";\n'
			, '\tif(await assertTestManifestRegistration(path, source, expected)) return true;\n'
		]){
			assert.equal(source.split(addition).length, 2, "Exactly one test-manifest verifier addition");
			source = source.replace(addition, "");
		}
		assert.equal(sha256(source), expected, path); return true;
	}
	if(path !== "src/adoption/test-profiles.mjs") return false;
	const { verifyAddedTestRegistrations } = await import("./test-registration-history.mjs");
	const history = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
	verifyAddedTestRegistrations(source, expected, history.registrationUpdates);
	return true;
};
