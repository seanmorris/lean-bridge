/**
 * Preserve installed receipts across explicit source changes and fresh regressions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertNativeGraphJvmRegression } from "./native-graph-jvm-regression.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

/**
 * Check unchanged sources or an explicit, independently checked source lineage.
 *
 * @param name - Historical receipt name, without the extension.
 * @param path - Source path recorded in that receipt.
 * @param previousSha256 - Original immutable source hash.
 */
export const assertRecursiveSourceHistory = async (name, path, previousSha256) => {
	const source = beforeWitPackageIntegration(path, await readFile(path, "utf8"), previousSha256);
	const currentSha256 = sha256(source);
	if(currentSha256 === previousSha256) return;
	const evidence = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
	const record = evidence.historicalReceipts[name];
	assert.ok(record, `Missing historical receipt lineage: ${name}`);
	const bytes = await readFile(`docs/evidence/${name}.json`);
	assert.equal(sha256(bytes), record.receiptSha256, `Historical receipt changed: ${name}`);
	const original = JSON.parse(bytes);
	assert.equal(original.sourceHashes[path] ?? original.generatorSourceHashes?.[path], previousSha256);
	assert.deepEqual(record.sources[path], { previousSha256, currentSha256 }, path);
	if(["src/build/native-project.mjs", "src/build/native-c-projection.mjs"].includes(path))
	{
		assert.equal(name, "kotlin-collections-20260922");
		await assertNativeGraphJvmRegression(record, original);
	}
	if(["src/release/native-maven.mjs", "src/release/native-wasi.mjs"].includes(path))
		assert.equal(sha256(source.replace('"allocation-guard.h", ', "")), previousSha256, "Only the extra provenance header may differ from this historical packager");
	if(path === "tests/component-structured-codec.test.mjs")
	{
		let original = await readFile(path, "utf8");
		for(const [current, previous] of [
			['import { assertRecursiveSourceHistory } from "./helpers/recursive-source-history.mjs";\n', ""]
			, ['for(const [path, hash] of Object.entries(record.sourceHashes)) await assertRecursiveSourceHistory("npm-recursive-callable-repair-20260922", path, hash);', 'for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);']
			, [' && cell.stages.installedExecution.evidence.includes("npm-recursive-installed")', ""]
		]) {
			assert.equal(original.split(current).length, 2, "Exactly one administrative evidence-check edit");
			original = original.replace(current, previous);
		}
		assert.equal(sha256(original), previousSha256, "Only npm-specific filtering and explicit source lineage may differ from the installed test record");
	}
};
