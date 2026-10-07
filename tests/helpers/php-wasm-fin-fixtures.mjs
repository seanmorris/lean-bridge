/**
 * Fin fixtures for installed PHP-Wasm packages (VO #1220, PHP-Wasm slice 1). Each wasm32 caller
 * is the fixture's native PHP consumer, unchanged except for loading and its final report, so
 * every case, snapshot comparison and recovery runs on both PHP hosts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { finProductRefinements } from "./fin-product-install.mjs";
import { finRecordRefinements } from "./fin-record-install.mjs";

const settings = name => ({ npm: { name: `lean-bridge-${name}-wasm`, version: "1.0.0" }, composer: { name: `lean-bridge-${name}/wasm`, version: "1.0.0" } });
/** Lean projects, expected trees and native PHP callers reused on PHP-Wasm. */
const products = {
	root: "tests/fixtures/onboarding/native-fin-products"
	, module: "FinProducts", refinements: finProductRefinements
	, namespace: "LeanFinproducts", operation: "first"
	, consumer: "tests/fixtures/fin-product-consumers/php-native.php"
	, settings: settings("finproducts")
};
const records = {
	root: "tests/fixtures/onboarding/native-fin-records"
	, module: "FinRecords", refinements: finRecordRefinements
	, namespace: "LeanFinrecords", operation: "tile_sum"
	, consumer: "tests/fixtures/fin-record-consumers/php-native.php"
	, settings: settings("finrecords")
};
export const phpWasmFinFixtures = Object.freeze({ products, records });

/**
 * Turn a native PHP consumer into a PHP-Wasm caller: the driver loads the selected autoloader,
 * the caller strictness is set per mode, and the success line becomes a JSON observation.
 *
 * @param source - Native PHP consumer text.
 * @param mode - Weak or strict caller.
 */
export const phpWasmFinConsumer = (source, mode) => {
	const lines = source.split("\n");
	if(lines[1] !== "declare(strict_types=0);" || lines[2] !== "require 'vendor/autoload.php';" || !/^echo "fin-[a-z-]+-ok:\$checks\\n";$/u.test(lines.at(-2)) || lines.at(-1) !== "")
		throw new TypeError("Unexpected native PHP Fin consumer layout");
	lines[1] = `declare(strict_types=${mode === "strict" ? 1 : 0});`;
	lines.splice(2, 1);
	lines[lines.length - 2] = "echo json_encode(['checks' => $checks, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . \"\\n\";";
	return lines.join("\n");
};

/**
 * Read a fixture's caller and the request the shared PHP-Wasm driver expects.
 *
 * @param fixture - Entry of phpWasmFinFixtures.
 */
export const phpWasmFinCaller = async fixture => {
	const source = await readFile(fixture.consumer, "utf8");
	const autoload = arrangement => arrangement === "composer" ? "vendor/autoload.php" : `vendor/${fixture.settings.composer.name}/bootstrap.php`;
	const request = arrangement => `${JSON.stringify({ module: fixture.namespace, operations: { probe: fixture.operation }, autoload: autoload(arrangement) })}\n`;
	return { source: mode => phpWasmFinConsumer(source, mode), request };
};
