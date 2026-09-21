/**
 * Independent wasm32 alias representations, contracts and installed callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./native-alias-fixture.mjs";

const big = "\\Brick\\Math\\BigInteger";
const valueTypes = {
	AUnit: "null", ABool: "bool", AU8: "int", AU16: "int", AU32: big, AU64: big
	, AI8: "int", AI16: "int", AI32: "int", AI64: big, ANat: big, AInt: big
	, AF32: "float", AF64: "float", AText: "string", ABytes: "Bytes"
	, AChar: "string", AWord: big, ASignedWord: "int", Count: big, OtherCount: big
	, ScalarsView: "Scalars"
	, Rows: `list<list<${big}>>`, Maybe: "Some<Some<null>|null>|null"
	, Outcome: `Ok<array{${big}, Bytes}>|Err<string>`
	, PacketView: "Packet", Packets: "list<Packet>"
};
const ir = nativeAliasReviewedIr();
const source = await readFile(new URL("../fixtures/alias-consumers/php-wasm.php", import.meta.url), "utf8");
const contractType = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
	? ir.types.find(type => type.id === ref.id).name
	: `${ref.constructor}<${ref.arguments.map(contractType).join(", ")}>`;
export const phpWasmAliasCatalog = ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, phpType: valueTypes[name] }));
export const phpWasmAliasSettings = { npm: { name: "lean-bridge-aliases-wasm", version: "1.0.0" }
	, composer: { name: "lean-bridge-aliases/wasm", version: "1.0.0" } };

/**
 * Compare the entire copied contract without source-path parameter spelling.
 *
 * @param input - Compiler-produced or independently reviewed Binding IR.
 */
export const phpWasmAliasContract = input => ({
	declarations: input.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: input.types.map(type => ({ id: type.id, name: type.name
		, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

/**
 * Set only lexical caller strictness and independent parameter names.
 *
 * @param mode - Weak or strict caller.
 * @param path - Ordinary-source or independently reviewed IR.
 */
export const phpWasmAliasConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);

/**
 * Specify independent expected types and select the installed autoloader.
 *
 * @param arrangement - Embedded npm PHP files or companion Composer package.
 */
export const phpWasmAliasRequest = arrangement => JSON.stringify({
	signatures: nativeAliasSignatures, types: ir.types
	, aliases: phpWasmAliasCatalog
	, module: "LeanAliases", operations: { increment: "increment" }
	, autoload: arrangement === "composer" ? "vendor/autoload.php" : "vendor/lean-bridge-aliases/wasm/bootstrap.php"
}) + "\n";

/**
 * Check the unflattened alias catalog and original public API contracts.
 *
 * @param files - Zend manifest and public PHP source from the selected package.
 * @param path - Source-path parameter spelling.
 */
export const checkPhpWasmAliasFiles = (files, path = "reviewed-ir") => {
	const manifest = JSON.parse(files["copied-zend-manifest.json"]), api = files["src/Api.php"];
	const aliases = [...manifest.aliases].sort((a, b) => a.id.localeCompare(b.id));
	assert.equal(manifest.integerBits, 32); assert.deepEqual(aliases, phpWasmAliasCatalog);
	for(const alias of phpWasmAliasCatalog) assert.ok(api.includes(` * ${alias.name} = ${contractType(alias.target)}; PHP: ${alias.phpType}`));
	for(const fn of nativeAliasSignatures)
	{
		const site = api.split(`\nfunction ${fn.name.split(".").at(-1)}(`)[0].split("/**").at(-1);
		for(const [index, ref] of fn.parameters.entries()) assert.ok(site.includes(`@lean-bridge-param ${contractType(ref)} $${path === "reviewed-ir" ? "value" : "arg"}${index}`), fn.name);
		assert.ok(site.includes(`@lean-bridge-return ${contractType(fn.result)}`), fn.name);
	}
	for(const type of ir.types.filter(type => type.kind === "record"))
	{
		const body = api.split(`final readonly class ${type.name}\n`)[1].split("    public function __construct")[0];
		for(const field of type.fields) assert.ok(body.split(`$${field.name};`)[0].split("/**").at(-1).includes(`@lean-bridge-contract ${contractType(field.type)}`));
	}
	return { aliases, originalAliasChains: true, originalApiSites: true
		, originalRecordFields: true, installedSourceDocumentation: true
		, transparentTargetValues: true };
};
