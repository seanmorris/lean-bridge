/**
 * Independent native PHP primitive callable signatures and lexical-mode callers.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { callableSignatures, callableArities } from "./callable-fixture.mjs";

export const phpCallableSignatures = [...callableSignatures
	, { name: "Callables.retainCallback", parameters: [{ callback: { parameters: ["uint32"], result: "uint32" } }], result: { callback: { parameters: ["uint32"], result: "uint32" } } }
	, { name: "Callables.combine", parameters: ["string", "uint64", { callback: { parameters: ["string", "uint64"], result: "string" } }, { callback: { parameters: ["string"], result: "string" } }], result: "string" }
	, { name: "Callables.wide", parameters: ["uint32", { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } }], result: "uint32" }
	, { name: "Callables.makeWide", parameters: ["uint32"], result: { callback: { parameters: Array(16).fill("uint32"), result: "uint32" } } }
	, { name: "Callables.makeAdder", parameters: ["uint32"], result: { callback: { parameters: ["uint32"], result: "uint32" } } }];
export const phpCallableArities = { ...callableArities, "Callables.retainCallback": 1, "Callables.makeWide": 1, "Callables.makeAdder": 1 };
const fixture = await readFile(new URL("../fixtures/callable-consumers/php.php", import.meta.url), "utf8");

/**
 * Preserve exact declarations while varying PHP's lexical argument typing mode.
 *
 * @param mode - Weak or strict caller.
 * @param sourcePath - Ordinary source or independently reviewed IR.
 */
export const phpCallableConsumer = (mode, sourcePath) => fixture
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${sourcePath === "reviewed-ir" ? "value" : "arg"}';`);

/**
 * Bind the installed caller to an independently specified source-path contract.
 *
 * @param sourcePath - Ordinary source or reviewed IR.
 */
export const phpCallableRequest = sourcePath => JSON.stringify({ sourcePath, signatures: phpCallableSignatures }) + "\n";
