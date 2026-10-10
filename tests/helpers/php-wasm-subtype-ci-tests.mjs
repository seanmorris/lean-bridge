/**
 * Refuse CI omissions and preserve the native PHP job and all earlier acceptance commands.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertPhpWasmSubtypeWorkflow, disablePhpWasmSubtypeWorkflow, enablePhpWasmSubtypeWorkflow, phpWasmSubtypeCiBlock, phpWasmSubtypeCiCheck, phpWasmSubtypeCiInvocation, phpWasmSubtypeCiReports } from "./php-wasm-subtype-ci.mjs";
import { beforePhpWasmSubtypeAcceptanceSource } from "./php-wasm-subtype-acceptance-history.mjs";
import { assertPhpWasmDirectFinWorkflow } from "./php-wasm-fin-direct-ci.mjs";

test("PHP-Wasm Subtype CI preserves the earlier workflow and requires both installed source routes and fresh constructor analysis", async () => {
	const path = ".github/workflows/consumer-matrix.yml", current = await readFile(path, "utf8");
	assertPhpWasmSubtypeWorkflow(current);
	const previous = beforePhpWasmSubtypeAcceptanceSource(path, current);
	assertPhpWasmDirectFinWorkflow(previous);
	assert.notEqual(previous, current);
	assert.equal(disablePhpWasmSubtypeWorkflow(current), previous);
	assert.equal(enablePhpWasmSubtypeWorkflow(previous), current);
	const root = await readFile("tests/php-wasm-fin.test.mjs", "utf8");
	for(const name of ["tests", "report-tests", "ci-tests", "acceptance-history-tests"])
		assert.ok(root.includes(`import "./helpers/php-wasm-subtype-${name}.mjs";`));
});

test("PHP-Wasm Subtype CI refuses lost producers, checks, uploads and failure suppression", async () => {
	const current = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const changed of [
		current.replace(phpWasmSubtypeCiBlock, "")
		, current.replace(phpWasmSubtypeCiInvocation, phpWasmSubtypeCiInvocation.replace("_TEST=1", "_TEST=0"))
		, current.replace(`          ${phpWasmSubtypeCiCheck}\n`, "")
		, current.replace(phpWasmSubtypeCiBlock, phpWasmSubtypeCiBlock.replace("\n", " || true\n"))
		, current.replace(phpWasmSubtypeCiBlock, "          set +e\n" + phpWasmSubtypeCiBlock)
		, current.replace(phpWasmSubtypeCiBlock, "      - name: misplaced\n        run: |\n" + phpWasmSubtypeCiBlock)
		, current.replace(` && ${phpWasmSubtypeCiInvocation} && ${phpWasmSubtypeCiCheck}`, "")
		, ...phpWasmSubtypeCiReports.map(path => current.replace(`            ${path}\n`, ""))
		, current.replace("  php-wasm-consumers:\n", "  wrong-job:\n")
		, current.replaceAll("      - name: Enforce PHP support\n", "      - name: Unenforced PHP support\n")
	]) assert.throws(() => assertPhpWasmSubtypeWorkflow(changed));
});
