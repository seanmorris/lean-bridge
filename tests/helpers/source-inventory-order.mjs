/**
 * Reverse inventory-only ordering repairs without changing membership or receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const checkerImport = 'import { assertInventoryOrderVerification, reverseInventoryFileOrder } from "./source-inventory-order.mjs";\n';
const checkerCall = '\tif(assertInventoryOrderVerification(path, source, expected)) return true;\n';
const checkerBranch = `		if(update.kind === "reorder-files")
		{
			source = reverseInventoryFileOrder(path, source, update);
			continue;
		}
`;
const flagImport = 'import { beforeInventoryOrderVerification } from "./source-inventory-order.mjs";\n';
const flagCall = '\tsource = beforeInventoryOrderVerification(path, source);\n';
const changes = {
	"tests/helpers/source-registration-history.mjs": [checkerImport, checkerCall, checkerBranch]
	, "tests/helpers/source-registration-flags.mjs": [flagImport, flagCall]
};

/**
 * Reconstruct exactly the predecessor of the inventory-verifier integration.
 * Unrelated edits remain in the output and must fail the caller's old digest.
 *
 * @param path - Exact verifier path.
 * @param source - Complete current or predecessor source.
 */
export const beforeInventoryOrderVerification = (path, source) => {
	source = beforeWitPackageIntegration(path, source);
	const additions = changes[path];
	if(!additions || additions.every(line => !source.includes(line))) return source;
	for(const line of additions)
	{
		assert.equal(source.split(line).length, 2, "Exactly one inventory-order verifier addition");
		source = source.replace(line, "");
	}
	return source;
};

/**
 * Recognize an exact predecessor verifier, never a production-source change.
 *
 * @param path - Source under verification.
 * @param source - Complete current text.
 * @param expected - Original receipt's unchanged source digest.
 */
export const assertInventoryOrderVerification = (path, source, expected) => {
	if(!Object.hasOwn(changes, path)) return false;
	const previous = beforeInventoryOrderVerification(path, source);
	return previous !== source && sha256(previous) === expected;
};

/**
 * Reverse only a sorted files-array permutation in the two npm source inventories.
 * No path, key, script, whitespace outside that array or command may change.
 *
 * @param path - Development manifest or CLI manifest.
 * @param source - Complete current manifest.
 * @param update - Closed ordering step with its original file order and digests.
 */
export const reverseInventoryFileOrder = (path, source, update) => {
	assert.ok(["package.json", "config/cli-package.v1.json"].includes(path));
	assert.deepEqual(Object.keys(update).sort(), ["currentSha256", "kind", "path", "previousFiles", "previousSha256"]);
	assert.equal(update.kind, "reorder-files"); assert.equal(update.path, path);
	assert.equal(sha256(source), update.currentSha256);
	const current = JSON.parse(source).files, previous = update.previousFiles;
	for(const files of [current, previous])
	{
		assert.ok(Array.isArray(files) && files.length > 0);
		assert.ok(files.every(path => typeof path === "string"));
		assert.equal(new Set(files).size, files.length);
	}
	assert.deepEqual(current, [...current].sort());
	assert.deepEqual(current, [...previous].sort());
	assert.notDeepEqual(current, previous);
	const block = files => `  "files": [\n${files.map((file, index) => "    " + JSON.stringify(file) + (index === files.length - 1 ? "" : ",")).join("\n")}\n  ]`;
	const sorted = block(current);
	assert.equal(source.split(sorted).length, 2, "Exactly one explicit files array");
	const reconstructed = source.replace(sorted, block(previous));
	assert.equal(sha256(reconstructed), update.previousSha256, "Inventory ordering changed other content");
	return reconstructed;
};
