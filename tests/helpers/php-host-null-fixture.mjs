/**
 * Independent PHP HostNull callers and exact package coordinates.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { canonicalJson } from "../../src/capsule/node.mjs";

const template = await readFile(new URL("../fixtures/host-null-consumers/php.php", import.meta.url), "utf8");
const settings = Object.freeze({
	native: Object.freeze({ name: "host-null-demo/api", version: "1.0.0" })
	, wasm: Object.freeze({
		npm: Object.freeze({ name: "host-null-demo-wasm", version: "1.0.0" })
		, composer: Object.freeze({ name: "host-null-demo/wasm", version: "1.0.0" })
	})
});

export const phpHostNullSettings = settings;

const source = (mode, path, profile) => {
	const wasm = profile === "php-wasm";
	return template
		.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
		.replace("// LEAN_BRIDGE_AUTOLOAD", wasm ? "" : "require 'vendor/autoload.php';")
		.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`)
		.replace("const SOURCE_PATH = 'ordinary-source';", `const SOURCE_PATH = '${path}';`)
		.replace("const CALLER_MODE = 'weak';", `const CALLER_MODE = '${mode}';`)
		.replace("const HOST_PROFILE = 'php-native';", `const HOST_PROFILE = '${profile}';`)
		.replace("LEAN_BRIDGE_UINT32_FACTORY", wasm ? "BigInteger::of($value)" : "(int) $value")
		.replace("LEAN_BRIDGE_UINT32_INCREMENT", wasm ? "$value->plus(1)" : "$value + 1")
		.replace("LEAN_BRIDGE_WORD_BITS", wasm ? "32" : "64");
};

const request = (profile, path, arrangement = null) => canonicalJson({
	schemaVersion: 1
	, profile
	, path
	, namespace: "LeanHostNullDemo"
	, ...(arrangement ? {
		arrangement
		, module: "LeanHostNullDemo"
		, operations: { hostNull: "echo_" }
		, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/host-null-demo/wasm/bootstrap.php" } : {})
});

/**
 * Render one native PHP lexical caller.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR author route.
 */
export const phpHostNullNativeConsumer = (mode, path) => source(mode, path, "php-native");
/**
 * Render the native PHP request observed by the independent caller.
 *
 * @param path - Ordinary-source or reviewed-IR author route.
 */
export const phpHostNullNativeRequest = path => request("php-native", path);
/**
 * Render one PHP-Wasm lexical caller.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR author route.
 */
export const phpHostNullWasmConsumer = (mode, path) => source(mode, path, "php-wasm");
/**
 * Render the PHP-Wasm request for an installed loading arrangement.
 *
 * @param arrangement - Embedded npm files or the Composer package.
 * @param path - Ordinary-source or reviewed-IR author route.
 */
export const phpHostNullWasmRequest = (arrangement, path) => request("php-wasm", path, arrangement);
