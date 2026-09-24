/**
 * Verify current source bindings while preserving original Composer observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";
import { assertRecursiveDocumentationSource } from "./recursive-documentation-history.mjs";

/**
 * Restore the exact two-line receipt-checker change, not its installed test bodies.
 *
 * @param source - Complete current Composer test module.
 */
export const beforeCurrentPhpGraphVerification = source => {
	for(const [current, previous] of [
		['import { assertCurrentPhpGraphSources } from "./helpers/current-php-graph-evidence.mjs";\n', 'import { assertAdministrativeSourceUpdate } from "./helpers/test-registration-history.mjs";\n']
		, ['await assertCurrentPhpGraphSources(record);', 'for(const [path, hash] of Object.entries(record.sourceHashes)) await assertAdministrativeSourceUpdate(path, hash);']
	]) {
		assert.equal(source.split(current).length, 2, "Exactly one Composer evidence-checker upgrade");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Require current compiled-source evidence and separately reviewed documentation.
 *
 * @param record - Unchanged recursive Composer receipt.
 */
export const assertCurrentPhpGraphSources = async record => {
	for(const [path, expected] of Object.entries(record.sourceHashes))
	{
		const source = await readFile(path, "utf8");
		if(sha256(source) === expected) continue;
		if(path === "tests/php-graph-package.test.mjs")
			assert.equal(sha256(beforeCurrentPhpGraphVerification(source)), expected, path);
		else if(path.startsWith("docs/"))
			assert.equal(await assertRecursiveDocumentationSource(path, source, expected), true, path);
		else await assertAdministrativeSourceUpdate(path, expected);
	}
};
