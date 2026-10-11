/**
 * Refuse CI omissions and preserve the native PHP job and all earlier acceptance commands.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertPhpWasmDirectFinWorkflow, disablePhpWasmDirectFinWorkflow, enablePhpWasmDirectFinWorkflow, phpWasmDirectCiBlock, phpWasmDirectCiCheck, phpWasmDirectCiInvocation, phpWasmDirectCiReports } from "./php-wasm-fin-direct-ci.mjs";
import { beforePhpWasmDirectFinSource } from "./php-wasm-fin-direct-history.mjs";
import { beforePhpWasmSubtypeAcceptanceSource } from "./php-wasm-subtype-acceptance-history.mjs";

test("direct PHP-Wasm Fin CI preserves the earlier workflow and requires both installed source routes", async () => {
	const path = ".github/workflows/consumer-matrix.yml", latest = await readFile(path, "utf8");
	const current = beforePhpWasmSubtypeAcceptanceSource(path, latest);
	assertPhpWasmDirectFinWorkflow(current);
	const previous = beforePhpWasmDirectFinSource(path, current);
	assert.notEqual(previous, current);
	assert.equal(disablePhpWasmDirectFinWorkflow(current), previous);
	assert.equal(enablePhpWasmDirectFinWorkflow(previous), current);
	const root = await readFile("tests/php-wasm-fin.test.mjs", "utf8");
	for(const name of ["tests", "report-tests", "ci-tests", "history-tests"])
		assert.ok(root.includes(`import "./helpers/php-wasm-fin-direct-${name}.mjs";`));
});

test("direct PHP-Wasm Fin CI refuses lost producers, checks, uploads and failure suppression", async () => {
	const path = ".github/workflows/consumer-matrix.yml";
	const current = beforePhpWasmSubtypeAcceptanceSource(path, await readFile(path, "utf8"));
	assertPhpWasmDirectFinWorkflow(current);
	for(const changed of [
		current.replace(phpWasmDirectCiBlock, "")
		, current.replace(phpWasmDirectCiInvocation, phpWasmDirectCiInvocation.replace("_TEST=1", "_TEST=0"))
		, current.replace(`          ${phpWasmDirectCiCheck}\n`, "")
		, current.replace(phpWasmDirectCiBlock, phpWasmDirectCiBlock.replace("\n", " || true\n"))
		, current.replace(phpWasmDirectCiBlock, "          set +e\n" + phpWasmDirectCiBlock)
		, current.replace(phpWasmDirectCiBlock, "      - name: misplaced\n        run: |\n" + phpWasmDirectCiBlock)
		, current.replace(` && ${phpWasmDirectCiInvocation} && ${phpWasmDirectCiCheck}`, "")
		, ...phpWasmDirectCiReports.map(path => current.replace(`            ${path}\n`, ""))
		, current.replace("  php-wasm-consumers:\n", "  wrong-job:\n")
		, current.replaceAll("      - name: Enforce PHP support\n", "      - name: Unenforced PHP support\n")
	]) assert.throws(() => assertPhpWasmDirectFinWorkflow(changed));
});
