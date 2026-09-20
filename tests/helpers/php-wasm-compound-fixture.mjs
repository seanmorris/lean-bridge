/**
 * Independent wasm32 compound callers and public package coordinates.
 *
 * @file
 */
import { readFileSync } from "node:fs";
import { compoundSignatures } from "./compound-fixture.mjs";

const source = readFileSync(new URL("../fixtures/compound-consumers/php-wasm.php", import.meta.url), "utf8");
export const phpWasmCompoundSettings = { npm: { name: "lean-bridge-compounds-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-compounds/wasm", version: "1.0.0" } };
/**
 * Select lexical caller mode and compiler or reviewed argument names.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR source path.
 */
export const phpWasmCompoundConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);
/**
 * Serialize the independently specified signatures and installed autoload path.
 *
 * @param arrangement - Embedded npm PHP files or Composer installation.
 */
export const phpWasmCompoundRequest = arrangement => JSON.stringify({ signatures: compoundSignatures
	, module: "LeanCompounds", operations: { option: "option_unit" }
	, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-compounds/wasm/bootstrap.php" }) + "\n";
