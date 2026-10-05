/**
 * Independent wasm32 collection callers and executable guide example.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { collectionSignatures } from "./collection-fixture.mjs";

const source = await readFile(new URL("../fixtures/collection-consumers/php-wasm.php", import.meta.url), "utf8");
const documentation = (await readFile("docs/php.md", "utf8")).split("#### Arrays and records on wasm32\n")[1]?.split("```php\n")[1]?.split("```")[0];
assert.ok(documentation?.startsWith("<?php\n"));
const documentationOutput = '[[],["3","2","1"]]\n3\n42\nequal\n';
export const phpWasmCollectionSettings = { npm: { name: "lean-bridge-collections-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-collections/wasm", version: "1.0.0" } };

/** Exact guide file executed after loading either installed PHP arrangement. */
export const phpWasmCollectionDocumentation = () => ({ source: documentation, sourceSha256: sha256(documentation), stdout: documentationOutput });

/**
 * Select lexical caller mode and independently specified parameter names.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or reviewed-IR path.
 */
export const phpWasmCollectionConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`)
	.replace("/* DOCUMENTATION */", `$documentationLevel = ob_get_level(); ob_start();\n?>${documentation}\n$documentationOutput = ob_get_clean();\ncheck($documentationOutput === ${JSON.stringify(documentationOutput)}, 'exact guide output');\ncheck(ob_get_level() === $documentationLevel);\n$calls += 3;`);

/**
 * Supply the original signatures and selected installed autoload arrangement.
 *
 * @param arrangement - Embedded npm PHP files or Composer install.
 */
export const phpWasmCollectionRequest = arrangement => JSON.stringify({ signatures: collectionSignatures
	, module: "LeanCollections", operations: { reverse: "array_reverse_uint32" }
	, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-collections/wasm/bootstrap.php" }) + "\n";
