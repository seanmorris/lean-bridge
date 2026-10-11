/**
 * Keep checked Subtype acceptance in the existing PHP-Wasm CI job.
 *
 * @file
 */
import assert from "node:assert/strict";

export const phpWasmSubtypeCiInvocation = "LEAN_BRIDGE_PHP_WASM_SUBTYPE_TEST=1 LEAN_BRIDGE_PHP_WASM_SUBTYPE_LEAN_TEST=1 node --test --test-concurrency=1 tests/helpers/php-wasm-subtype-tests.mjs";
export const phpWasmSubtypeCiCheck = "node scripts/check-php-wasm-subtype-reports.mjs --directory build/php-wasm-subtype";
export const phpWasmSubtypeCiReports = ["ordinary", "reviewed"].map(route => `build/php-wasm-subtype/${route}.json`);
export const phpWasmSubtypeCiBlock = `          ${phpWasmSubtypeCiInvocation}\n          ${phpWasmSubtypeCiCheck}\n`;
const upload = phpWasmSubtypeCiReports.map(path => `            ${path}\n`).join("");
const record = ` && ${phpWasmSubtypeCiInvocation} && ${phpWasmSubtypeCiCheck}`;
const anchor = "          node scripts/check-php-wasm-direct-fin-reports.mjs --directory build/php-wasm-fin-direct\n";
const uploadAnchor = "            build/php-wasm-fin-direct/reviewed.json\n";
const recordAnchor = " && LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_TEST=1";
const swap = (text, from, to) => {
	assert.equal(text.split(from).length, 2, `Expected exactly one ${from}`);
	return text.replace(from, () => to);
};

/**
 * Add the producer, mandatory paired-report checker and original report uploads.
 *
 * @param workflow - Consumer workflow before this integration.
 */
export const enablePhpWasmSubtypeWorkflow = workflow => {
	assert.ok(!workflow.includes("LEAN_BRIDGE_PHP_WASM_SUBTYPE_"));
	workflow = swap(workflow, anchor, anchor + phpWasmSubtypeCiBlock);
	workflow = swap(workflow, uploadAnchor, uploadAnchor + upload);
	return swap(workflow, recordAnchor, record + recordAnchor);
};

/**
 * Remove only exact additions to reconstruct the earlier workflow.
 *
 * @param workflow - Consumer workflow with Subtype acceptance.
 */
export const disablePhpWasmSubtypeWorkflow = workflow => {
	workflow = swap(workflow, phpWasmSubtypeCiBlock, "");
	workflow = swap(workflow, upload, "");
	return swap(workflow, record, "");
};

/**
 * Require acceptance in the original enforced step, with both original reports retained.
 *
 * @param workflow - Current consumer workflow text.
 */
export const assertPhpWasmSubtypeWorkflow = workflow => {
	assert.equal(enablePhpWasmSubtypeWorkflow(disablePhpWasmSubtypeWorkflow(workflow)), workflow);
	const job = workflow.match(/^ {2}php-wasm-consumers:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(job); assert.match(job, /\n {4}timeout-minutes: 330\n/u);
	assert.equal(job.split(phpWasmSubtypeCiInvocation).length, 3);
	assert.ok(job.includes(anchor + phpWasmSubtypeCiBlock));
	const index = job.indexOf(phpWasmSubtypeCiBlock);
	const step = job.slice(job.lastIndexOf("\n      - name: ", index), job.indexOf("\n      - name: ", index));
	assert.match(step, /\n {8}id: type_corpus_php_wasm\n/u);
	assert.doesNotMatch(step, /set \+e|\|\| true|\n {8}if:/u);
	const enforcement = job.slice(job.indexOf("      - name: Enforce PHP support\n"));
	assert.match(enforcement, /\n {8}if: [^\n]*steps\.type_corpus_php_wasm\.outcome != 'success'/u);
	assert.match(enforcement, /\n {8}run: exit 1\n/u);
	const at = job.indexOf(upload), uploadStep = job.slice(job.lastIndexOf("\n      - name: ", at), job.indexOf("\n      - name: ", at));
	assert.match(uploadStep, /\n {8}if: always\(\)\n/u);
	assert.match(uploadStep, /\n {8}uses: actions\/upload-artifact@v7\n/u);
	assert.match(uploadStep, /\n {10}if-no-files-found: error\n/u);
	assert.ok(job.split("\n").some(line => line.includes("consumer-ci.mjs record --consumer php-wasm") && line.includes(record)));
};
