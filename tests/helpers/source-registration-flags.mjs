/**
 * Reconstruct verifier sources from before numeric test flags were recognized.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeInventoryOrderVerification } from "./source-inventory-order.mjs";

const integration = 'import { beforeNumericTestFlags } from "./source-registration-flags.mjs";\n';
const currentLoop = 'for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(beforeNumericTestFlags(path, await readFile(path, "utf8"))), hash, path);';
const previousLoop = 'for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);';
const integrationCall = '\tsource = beforeNumericTestFlags(path, source);\n';

/**
 * Reverse only the flag grammar correction and its historical-verifier integration.
 * The caller must still compare the complete reconstructed source's original hash.
 *
 * @param path - Exact verifier path, never a production source or manifest.
 * @param source - Current complete text.
 */
export const beforeNumericTestFlags = (path, source) => {
	source = beforeInventoryOrderVerification(path, source);
	if(path === "tests/helpers/source-registration-history.mjs")
	{
		const current = "LEAN_BRIDGE_[A-Z0-9_]+_TEST", previous = "LEAN_BRIDGE_[A-Z_]+_TEST";
		assert.equal(source.split(current).length, 3, "Exactly two test-flag grammar corrections");
		return source.replaceAll(current, previous);
	}
	if(path === "tests/helpers/native-asset-tamper-history.mjs")
	{
		for(const [current, previous] of [[integration, ""], [integrationCall, ""], [currentLoop, previousLoop]])
		{
			assert.equal(source.split(current).length, 2, "Exactly one numeric-flag verifier integration");
			source = source.replace(current, previous);
		}
	}
	return source;
};
