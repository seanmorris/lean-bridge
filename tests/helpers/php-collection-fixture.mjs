/**
 * Independent collection signatures and weak/strict installed PHP callers.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { collectionSignatures } from "./collection-fixture.mjs";

const source = await readFile(new URL("../fixtures/collection-consumers/php.php", import.meta.url), "utf8");
const documentation = (await readFile("docs/php.md", "utf8")).split("### Arrays and records\n")[1]?.split("```php\n")[1]?.split("```")[0];
assert.ok(documentation?.startsWith("<?php\n"));
const documentationOutput = "[[],[3,2,1]]\n3\n42\nequal\n";

/** Exact standalone guide example compiled inside each installed PHP caller. */
export const phpCollectionDocumentation = () => ({ source: documentation, sourceSha256: sha256(documentation), stdout: documentationOutput });

/**
 * Select lexical strictness and the independently specified argument names.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR signature contract.
 */
export const phpCollectionConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`)
	.replace("/* DOCUMENTATION */", `$documentationLevel = ob_get_level(); ob_start();\n?>${documentation}\n$documentationOutput = ob_get_clean();\ncheck($documentationOutput === ${JSON.stringify(documentationOutput)}, 'exact guide output');\ncheck(ob_get_level() === $documentationLevel);\n$calls += 2;`);

/**
 * Supply the source contract independently of compiler and generator output.
 *
 * @param path - Selected source path.
 */
export const phpCollectionRequest = path => JSON.stringify({ path, signatures: collectionSignatures }) + "\n";
