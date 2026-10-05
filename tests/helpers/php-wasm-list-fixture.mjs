/**
 * Independent wasm32 list callers and public package coordinates.
 *
 * @file
 */
import { readFileSync } from "node:fs";
import { listSignatures } from "./list-fixture.mjs";

const source = readFileSync(new URL("../fixtures/list-consumers/php-wasm.php", import.meta.url), "utf8");
export const phpWasmListSettings = { npm: { name: "lean-bridge-lists-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-lists/wasm", version: "1.0.0" } };
/**
 * Select lexical caller mode and compiler or reviewed argument names.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR source path.
 */
export const phpWasmListConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);
/**
 * Serialize the independently specified signatures and installed autoload path.
 *
 * @param arrangement - Embedded npm PHP files or Composer installation.
 */
export const phpWasmListRequest = arrangement => JSON.stringify({ signatures: listSignatures
	, module: "LeanLists", operations: { reverse: "reverse_uint32" }
	, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-lists/wasm/bootstrap.php" }) + "\n";
