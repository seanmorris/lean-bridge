/**
 * Preserve metadata compiler receipts across checked shared-layout changes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertAdministrativeSourceUpdate } from "./test-registration-history.mjs";

const verifiers = [
	"tests/jvm-copied-graph-values.test.mjs"
	, "tests/jvm-copied-graph-kotlin.test.mjs"
];
const changes = [
	['import { assertJvmGraphMetadataSource } from "./helpers/jvm-graph-metadata-source.mjs";\n', ""]
	, ['for(const [path, hash] of Object.entries(record.sourceHashes)) await assertJvmGraphMetadataSource(path, hash);', 'for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);']
];

/**
 * Undo the import and receipt loop, never any compiler or consumer checks.
 *
 * @param path - One of the two metadata receipt checkers.
 * @param source - Complete current source text.
 */
export const beforeJvmGraphMetadataVerification = (path, source) => {
	assert.ok(verifiers.includes(path), `Not a JVM metadata verifier: ${path}`);
	for(const [current, previous] of changes)
	{
		assert.equal(source.split(current).length, 2, "Exactly one metadata verification edit");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Require exact sources or independently verified shared-layout transitions.
 *
 * @param path - Source recorded by the original compiler execution.
 * @param expected - Original, unchanged source hash.
 */
export const assertJvmGraphMetadataSource = async (path, expected) => {
	if(verifiers.includes(path))
	{
		const source = await readFile(path, "utf8");
		assert.equal(sha256(beforeJvmGraphMetadataVerification(path, source)), expected, path);
		return;
	}
	await assertAdministrativeSourceUpdate(path, expected);
};
