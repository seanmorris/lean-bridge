/**
 * Independent PHP list callers with exact lexical-mode contracts.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { listSignatures } from "./list-fixture.mjs";

const source = await readFile(new URL("../fixtures/list-consumers/php.php", import.meta.url), "utf8");
/**
 * Select a lexical caller and independently specified argument names.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR signature contract.
 */
export const phpListConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);
/**
 * Serialize the independent public signature request, not generator metadata.
 *
 * @param path - Selected source path.
 */
export const phpListRequest = path => JSON.stringify({ path, signatures: listSignatures }) + "\n";
