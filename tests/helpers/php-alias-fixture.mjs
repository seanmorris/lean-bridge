/**
 * Independent native PHP alias representations and lexical-mode consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./native-alias-fixture.mjs";

const big = "\\Brick\\Math\\BigInteger";
export const phpAliasValueTypes = Object.freeze({
	AUnit: "null", ABool: "bool", AU8: "int", AU16: "int", AU32: "int", AU64: big
	, AI8: "int", AI16: "int", AI32: "int", AI64: "int", ANat: big, AInt: big
	, AF32: "float", AF64: "float", AText: "string", ABytes: "Bytes"
	, AChar: "string", AWord: big, ASignedWord: "int"
	, Count: "int", OtherCount: "int", ScalarsView: "Scalars"
	, Rows: "list<list<int>>", Maybe: "Some<Some<null>|null>|null"
	, Outcome: "Ok<array{int, Bytes}>|Err<string>"
	, PacketView: "Packet", Packets: "list<Packet>"
});
const ir = nativeAliasReviewedIr();
const source = await readFile(new URL("../fixtures/alias-consumers/php.php", import.meta.url), "utf8");
const contractType = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
	? ir.types.find(type => type.id === ref.id).name
	: `${ref.constructor}<${ref.arguments.map(contractType).join(", ")}>`;
export const phpAliasCatalog = ir.types.filter(type => type.kind === "alias").map(({ id, name, target }) => ({ id, name, target, phpType: phpAliasValueTypes[name] }));

/**
 * Set only the caller's lexical strictness and independently specified names.
 *
 * @param mode - Weak or strict PHP caller.
 * @param path - Ordinary-source or independently reviewed signature path.
 */
export const phpAliasConsumer = (mode, path) => source
	.replace("declare(strict_types=0);", `declare(strict_types=${mode === "strict" ? 1 : 0});`)
	.replace("const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${path === "reviewed-ir" ? "value" : "arg"}';`);

/**
 * Supply independent signatures, original definitions and consumer value types.
 *
 * @param path - Selected source path.
 */
export const phpAliasRequest = path => JSON.stringify({
	path, signatures: nativeAliasSignatures
	, types: ir.types, aliases: phpAliasCatalog }) + "\n";

/**
 * Verify installed catalog, alias chains and original field/API documentation.
 *
 * @param files - Verified installed public source, readme and manifest bytes.
 * @param path - Selected source path's parameter naming contract.
 */
export const checkPhpAliasFiles = (files, path = "reviewed-ir") => {
	const manifest = JSON.parse(files["binding-manifest.json"]), api = files["src/Api.php"];
	const aliases = [...manifest.aliases].sort((a, b) => a.id.localeCompare(b.id));
	assert.deepEqual(aliases, phpAliasCatalog);
	for(const alias of phpAliasCatalog)
	{
		assert.ok(api.includes(` * ${alias.name} = ${contractType(alias.target)}; PHP: ${alias.phpType}`));
		assert.ok(files["README.md"].includes(`| \`${alias.name}\` |`));
		assert.ok(!manifest.exports.includes(`LeanAliases\\${alias.name}`));
	}
	for(const fn of nativeAliasSignatures)
	{
		const site = api.split(`\nfunction ${fn.name.split(".").at(-1)}(`)[0].split("/**").at(-1);
		for(const [index, ref] of fn.parameters.entries()) assert.ok(site.includes(`@lean-bridge-param ${contractType(ref)} $${path === "reviewed-ir" ? "value" : "arg"}${index}`), fn.name);
		assert.ok(site.includes(`@lean-bridge-return ${contractType(fn.result)}`), fn.name);
	}
	for(const type of ir.types.filter(type => type.kind === "record"))
	{
		const body = api.split(`final readonly class ${type.name}\n`)[1].split("    public function __construct")[0];
		for(const field of type.fields)
		{
			const site = body.split(`$${field.name};`)[0].split("/**").at(-1);
			assert.ok(site.includes(`@lean-bridge-contract ${contractType(field.type)}`), `${type.name}.${field.name}`);
		}
	}
	return { aliases, originalAliasChains: true
		, originalApiSites: true, originalRecordFields: true
		, installedSourceDocumentation: true, transparentTargetValues: true };
};
