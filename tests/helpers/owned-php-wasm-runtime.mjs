/**
 * Give each ownership test a verified input or its own fresh PHP-Wasm runtime.
 *
 * @file
 */
import { join, resolve } from "node:path";
import { buildPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedRuntime } from "../../src/build/php-wasm-copied-artifacts.mjs";

/**
 * Never depend on another test's output or modify an explicitly supplied input.
 *
 * @param directory - Fresh test-owned directory, removed by its test context.
 */
export const prepareOwnedPhpWasmRuntime = async directory => {
	const supplied = process.env.LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME;
	const root = supplied === undefined ? join(directory, "php-wasm-runtime") : resolve(supplied);
	if(supplied === undefined)
		await buildPhpWasmCopiedRuntime({ outputRoot: root
			, emsdkRoot: resolve(process.env.LEAN_BRIDGE_PHP_EMSDK ?? ".toolchains/emsdk-php-wasm")
			, leanRuntimeRoot: resolve(process.env.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`) });
	return { root, ...await readVerifiedPhpWasmCopiedRuntime(root), supplied: supplied !== undefined };
};
