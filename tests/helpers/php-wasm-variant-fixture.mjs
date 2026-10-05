/**
 * Independent wasm32 variant contracts and installed public consumers.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { phpVariantReviewedIr, phpVariantSignatures } from "./php-variant-fixture.mjs";

const source = await readFile(new URL("../fixtures/variant-consumers/php-wasm.php", import.meta.url), "utf8");
export const phpWasmVariantSettings = { npm: { name: "lean-bridge-variants-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-variants/wasm", version: "1.0.0" } };

/**
 * Compare every export, record field and variant case independently of parameter spelling.
 *
 * @param ir - Compiler-produced or independently reviewed Binding IR.
 */
export const phpWasmVariantContract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

/**
 * Select caller strictness and source-path parameter names without changing checks.
 *
 * @param mode - Weak or strict caller.
 * @param path - Ordinary-source or independently reviewed IR.
 */
export const phpWasmVariantConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);

/**
 * Select the installed autoloader and independent expected declarations.
 *
 * @param arrangement - Embedded npm PHP files or the companion Composer package.
 */
export const phpWasmVariantRequest = arrangement => JSON.stringify({
	signatures: phpVariantSignatures, types: phpVariantReviewedIr().types
	, module: "LeanVariants", operations: { echo_signal: "echo_signal" }
	, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-variants/wasm/bootstrap.php"
}) + "\n";
