/**
 * Reconstruct the exact verifiers before shared JVM regression checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeNativeSharedVerification } from "./native-shared-verifier-updates.mjs";

const changes = {
	"tests/helpers/test-registration-history.mjs": [
		['import { assertJvmSharedSourceTransition } from "./jvm-shared-regression-receipt.mjs";\n', ""]
		, ['\tif(await assertJvmSharedSourceTransition(path, source, expected)) return;\n', ""]
	]
	, "tests/helpers/php-wasm-shared-regression-receipt.mjs": [
		['import { beforeJvmSharedVerification } from "./jvm-shared-verifier-updates.mjs";\n', ""]
		, ['\tsource = beforeJvmSharedVerification(path, source);\n', ""]
		, ['for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeJvmSharedVerification(path, await readFile(path, "utf8"))), hash, path);', 'for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(await readFile(path)), hash, path);']
	]
};

/**
 * Reverse only the two declared integrations; retain every unrelated edit.
 * Callers authenticate the result against its complete original digest.
 *
 * @param path - Historical verifier path.
 * @param source - Complete current source text.
 */
export const beforeJvmSharedVerification = (path, source) => {
	source = beforeNativeSharedVerification(path, source);
	const edits = changes[path];
	if(!edits || edits.every(([current]) => !source.includes(current))) return source;
	for(const [current, previous] of edits)
	{
		assert.equal(source.split(current).length, 2, "Exactly one JVM regression verification edit");
		source = source.replace(current, previous);
	}
	return source;
};
