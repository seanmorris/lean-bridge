/**
 * Preserve historical verifier bytes around the current installed-regression gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeNativeSharedTestUpdates, beforeNumericFlagTests } from "./native-shared-test-updates.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const integration = 'import { beforeNativeSharedVerification } from "./native-shared-verifier-updates.mjs";\n';
const changes = {
	"tests/helpers/jvm-shared-verifier-updates.mjs": [
		[integration, ""]
		, ['\tsource = beforeNativeSharedVerification(path, source);\n', ""]
	]
	, "tests/helpers/jvm-shared-regression-receipt.mjs": [
		[integration, ""]
		, ['for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(beforeNativeSharedVerification(path, await readFile(path, "utf8"))), hash, path);'
			, 'for(const [path, hash] of Object.entries(record.verifierSources)) assert.equal(sha256(await readFile(path)), hash, path);']
	]
	, ...Object.fromEntries(["python", "ruby"].map(profile => [
		`tests/helpers/native-${profile}-graph-regression.mjs`
		, [
			['import { beforeNativeTargetVerification } from "./native-shared-verifier-updates.mjs";\n', ""]
			, ['const source = beforeNativeTargetVerification(path, await readFile(path, "utf8"));', 'const source = await readFile(path, "utf8");']
		]
	]))
};

/**
 * Restore only two exact checker insertions or one fully pinned older verifier.
 * The current shared receipt checks the new verifier and all installed results.
 * Unrelated changes remain visible for the caller's original-source comparison.
 *
 * @param path - Historical verifier path, never a production module.
 * @param source - Complete current or predecessor source.
 */
export const beforeNativeSharedVerification = (path, source) => {
	source = beforeWitPackageIntegration(path, source);
	if(path === "tests/source-registration-history.test.mjs") return beforeNumericFlagTests(source);
	if(path === "tests/helpers/native-dotnet-graph-regression.mjs")
	{
		const record = JSON.parse(readFileSync("docs/evidence/native-shared-regressions-20260924.json", "utf8"));
		assert.equal(record.verifierBaseline.path, "docs/evidence/php-wasm-shared-regressions-20260924.json");
		const bytes = readFileSync(record.verifierBaseline.path);
		assert.equal(sha256(bytes), record.verifierBaseline.sha256);
		const original = JSON.parse(bytes), previous = record.verifierPredecessors[path];
		assert.equal(previous.sha256, original.verifierSources[path]);
		assert.equal(sha256(previous.text), previous.sha256);
		return sha256(source) === record.verifierSources[path] ? previous.text : source;
	}
	const edits = changes[path];
	if(!edits || edits.every(([current]) => !source.includes(current))) return source;
	for(const [current, previous] of edits)
	{
		assert.equal(source.split(current).length, 2, "Exactly one current native regression verifier insertion");
		source = source.replace(current, previous);
	}
	return source;
};

/**
 * Preserve preceding target tests before their existing earlier-stage checker.
 *
 * @param path - Full source path from the older package receipt.
 * @param source - Complete current source text.
 */
export const beforeNativeTargetVerification = (path, source) => {
	source = beforeNativeSharedVerification(path, source);
	if(["perl", "python", "ruby", "rust"].some(profile => path === `tests/${profile}-graph-package.test.mjs`))
		source = beforeNativeSharedTestUpdates(path, source);
	return source;
};
