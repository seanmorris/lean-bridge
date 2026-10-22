/**
 * Closed deployment controls for separate instrumented PHP-Wasm drivers.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { phpWasmEntryProbeDeploymentFiles } from "./type-corpus-php-wasm-install.mjs";

test("installed PHP-Wasm probes retain the legacy driver closure", () => {
	assert.deepEqual(phpWasmEntryProbeDeploymentFiles(true), [
		{ source: "tests/fixtures/php-wasm-subtype-entry/driver.mjs", destination: "driver.mjs" }
		, { source: "tests/helpers/php-wasm-subtype-entry-trace.mjs", destination: "entry-trace.mjs" }
		, { source: "tests/helpers/php-wasm-subtype-entry-cases.mjs", destination: "entry-cases.mjs" }
	]);
});

test("installed PHP-Wasm probes accept one explicit closed driver dependency set", () => {
	const selected = {
		driver: "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
		, support: [
			{ source: "tests/helpers/php-wasm-subtype-entry-trace.mjs", destination: "entry-trace.mjs" }
		]
	};
	assert.deepEqual(phpWasmEntryProbeDeploymentFiles(selected), [
		{ source: selected.driver, destination: "driver.mjs" }, ...selected.support
	]);
	assert.deepEqual(selected.support, [
		{ source: "tests/helpers/php-wasm-subtype-entry-trace.mjs", destination: "entry-trace.mjs" }
	]);
});

test("installed PHP-Wasm probe drivers cannot escape or overlap the deployment", () => {
	const valid = { driver: "tests/fixtures/php-wasm-refinement-entry/driver.mjs", support: [] };
	for(const value of [
		null, false, {}, { ...valid, extra: true }
		, { ...valid, driver: "src/driver.mjs" }
		, { ...valid, driver: "tests/../src/driver.mjs" }
		, { ...valid, support: [{ source: "tests/helpers/x.mjs", destination: "driver.mjs" }] }
		, { ...valid, support: [{ source: "tests/helpers/x.mjs", destination: "../x.mjs" }] }
		, { ...valid, support: [
			{ source: "tests/helpers/x.mjs", destination: "x.mjs" }
			, { source: "tests/helpers/y.mjs", destination: "x.mjs" }
		] }
	]) assert.throws(() => phpWasmEntryProbeDeploymentFiles(value));
});
