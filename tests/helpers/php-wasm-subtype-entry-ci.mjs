/**
 * Preserve existing PHP-Wasm CI while requiring both installed entry probes and original records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { phpWasmSubtypeEntryTestPattern } from "./php-wasm-subtype-entry-ci-tap.mjs";

export const phpWasmEntryCiOutput = "build/php-wasm-subtype-entry";
export const phpWasmEntryCiRuntime = "build/php-wasm-subtype-entry-input/php-wasm-runtime";
export const phpWasmEntryCiPrepare = `node scripts/prepare-php-wasm-subtype-entry-runtime.mjs --output ${phpWasmEntryCiRuntime} 2>&1 | tee ${phpWasmEntryCiOutput}/runtime-prepare.log`;
export const phpWasmEntryCiInvocation = `LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=${phpWasmEntryCiRuntime} LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_TEST=1 LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_OUTPUT=${phpWasmEntryCiOutput} node --test --test-concurrency=1 --test-reporter=tap --test-name-pattern='${phpWasmSubtypeEntryTestPattern}' tests/helpers/php-wasm-subtype-entry-installed-tests.mjs`;
export const phpWasmEntryCiCapture = `${phpWasmEntryCiInvocation} 2>&1 | tee ${phpWasmEntryCiOutput}/run.tap`;
export const phpWasmEntryCiCheck = `node scripts/check-php-wasm-subtype-entry-reports.mjs --directory ${phpWasmEntryCiOutput} --tap ${phpWasmEntryCiOutput}/run.tap`;
export const phpWasmEntryCiBlock = `          set -euo pipefail\n          mkdir -p ${phpWasmEntryCiOutput}\n          ${phpWasmEntryCiPrepare}\n          ${phpWasmEntryCiCapture}\n          ${phpWasmEntryCiCheck}\n`;
export const phpWasmEntryCiUpload = `            ${phpWasmEntryCiOutput}/\n`;
export const phpWasmEntryCiRecord = ` && set -euo pipefail && mkdir -p ${phpWasmEntryCiOutput} && ${phpWasmEntryCiPrepare} && ${phpWasmEntryCiCapture} && ${phpWasmEntryCiCheck}`;
const anchor = "          node scripts/check-php-wasm-subtype-reports.mjs --directory build/php-wasm-subtype\n";
const uploadAnchor = "            build/php-wasm-subtype/reviewed.json\n";
const recordAnchor = " && LEAN_BRIDGE_PHP_WASM_GENERIC_RECORD_TEST=1";
const swap = (text, from, to) => {
	assert.equal(text.split(from).length, 2, `Expected exactly one ${from}`);
	return text.replace(from, () => to);
};

/**
 * Insert only the two-route probe gate, paired check and original-record uploads.
 *
 * @param workflow - Original consumer workflow with ordinary uninstrumented Subtype gates.
 */
export const enablePhpWasmEntryWorkflow = workflow => {
	assert.ok(!workflow.includes("LEAN_BRIDGE_PHP_WASM_SUBTYPE_ENTRY_"));
	workflow = swap(workflow, anchor, anchor + phpWasmEntryCiBlock);
	workflow = swap(workflow, uploadAnchor, uploadAnchor + phpWasmEntryCiUpload);
	return swap(workflow, recordAnchor, phpWasmEntryCiRecord + recordAnchor);
};

/**
 * Reconstruct the exact workflow before this integration.
 *
 * @param workflow - Consumer workflow containing these exact three additions.
 */
export const disablePhpWasmEntryWorkflow = workflow => {
	workflow = swap(workflow, phpWasmEntryCiBlock, "");
	workflow = swap(workflow, phpWasmEntryCiUpload, "");
	return swap(workflow, phpWasmEntryCiRecord, "");
};

/**
 * Require the probe gate in the existing enforced corpus step and unconditional evidence upload.
 *
 * @param workflow - Current consumer workflow text.
 */
export const assertPhpWasmEntryWorkflow = workflow => {
	assert.equal(enablePhpWasmEntryWorkflow(disablePhpWasmEntryWorkflow(workflow)), workflow);
	const job = workflow.match(/^ {2}php-wasm-consumers:\n[^]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(job); assert.match(job, /\n {4}timeout-minutes: 330\n/u);
	assert.equal(job.split(phpWasmEntryCiInvocation).length, 3);
	assert.equal(job.split(phpWasmEntryCiPrepare).length, 3);
	assert.ok(job.includes(anchor + phpWasmEntryCiBlock));
	const index = job.indexOf(phpWasmEntryCiBlock);
	const step = job.slice(job.lastIndexOf("\n      - name: ", index), job.indexOf("\n      - name: ", index));
	assert.match(step, /\n {8}id: type_corpus_php_wasm\n/u);
	assert.doesNotMatch(step, /set \+e|\|\| true|\n {8}if:/u);
	const enforcement = job.slice(job.indexOf("      - name: Enforce PHP support\n"));
	assert.match(enforcement, /\n {8}if: [^\n]*steps\.type_corpus_php_wasm\.outcome != 'success'/u);
	assert.match(enforcement, /\n {8}run: exit 1\n/u);
	const at = job.indexOf(phpWasmEntryCiUpload), upload = job.slice(job.lastIndexOf("\n      - name: ", at), job.indexOf("\n      - name: ", at));
	assert.match(upload, /\n {8}if: always\(\)\n/u); assert.match(upload, /\n {8}uses: actions\/upload-artifact@v7\n/u);
	assert.match(upload, /\n {10}if-no-files-found: error\n/u);
	assert.ok(job.split("\n").some(line => line.includes("consumer-ci.mjs record --consumer php-wasm") && line.includes(phpWasmEntryCiRecord)));
};
