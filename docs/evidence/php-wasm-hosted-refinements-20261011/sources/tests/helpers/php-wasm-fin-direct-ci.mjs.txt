/**
 * Keep direct scalar/container Fin acceptance in the existing PHP-Wasm CI job.
 *
 * @file
 */
import assert from "node:assert/strict";

export const phpWasmDirectCiInvocation = "LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_TEST=1 LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_LEAN_TEST=1 node --test --test-concurrency=1 tests/helpers/php-wasm-fin-direct-tests.mjs";
export const phpWasmDirectCiCheck = "node scripts/check-php-wasm-direct-fin-reports.mjs --directory build/php-wasm-fin-direct";
export const phpWasmDirectCiReports = ["ordinary", "reviewed"].map(route => `build/php-wasm-fin-direct/${route}.json`);
export const phpWasmDirectCiBlock = `          ${phpWasmDirectCiInvocation}\n          ${phpWasmDirectCiCheck}\n`;
const upload = phpWasmDirectCiReports.map(path => `            ${path}\n`).join("");
const record = ` && ${phpWasmDirectCiInvocation} && ${phpWasmDirectCiCheck}`;
const anchor = "          test -s build/php-wasm-fin/reviewed.json\n";
const uploadAnchor = "            build/php-wasm-fin/reviewed.json\n";
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
export const enablePhpWasmDirectFinWorkflow = workflow => {
	assert.ok(!workflow.includes("LEAN_BRIDGE_PHP_WASM_DIRECT_FIN_"));
	workflow = swap(workflow, anchor, anchor + phpWasmDirectCiBlock);
	workflow = swap(workflow, uploadAnchor, uploadAnchor + upload);
	return swap(workflow, recordAnchor, record + recordAnchor);
};

/**
 * Remove only exact additions to reconstruct the earlier workflow.
 *
 * @param workflow - Consumer workflow with direct Fin acceptance.
 */
export const disablePhpWasmDirectFinWorkflow = workflow => {
	workflow = swap(workflow, phpWasmDirectCiBlock, "");
	workflow = swap(workflow, upload, "");
	return swap(workflow, record, "");
};

/**
 * Require acceptance in the original enforced step, with both original reports retained.
 *
 * @param workflow - Current consumer workflow text.
 */
export const assertPhpWasmDirectFinWorkflow = workflow => {
	assert.equal(enablePhpWasmDirectFinWorkflow(disablePhpWasmDirectFinWorkflow(workflow)), workflow);
	const job = workflow.match(/^ {2}php-wasm-consumers:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(job); assert.match(job, /\n {4}timeout-minutes: 330\n/u);
	assert.equal(job.split(phpWasmDirectCiInvocation).length, 3);
	assert.ok(job.includes(anchor + phpWasmDirectCiBlock));
	const index = job.indexOf(phpWasmDirectCiBlock);
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
