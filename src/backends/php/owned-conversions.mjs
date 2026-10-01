/**
 * Finite native PHP schemas for the public ownership C API.
 *
 * @file
 */
import { generateOwnedPhpValues } from "./owned-values.mjs";
import { copiedPhpHelpers } from "./copied-support.mjs";
import { ownedPhpConversionSupport } from "./owned-conversion-support.mjs";
import { ownedPhpConversionTransfer } from "./owned-conversion-transfer.mjs";
import { ownedPhpIntegerSupport } from "./owned-integers.mjs";

const literal = value => value === null ? "null" : typeof value === "boolean" || typeof value === "number" ? String(value)
	: typeof value === "string" ? `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
		: Array.isArray(value) ? `[${value.map(literal).join(", ")}]`
			: `[${Object.entries(value).map(([key, child]) => `${literal(key)} => ${literal(child)}`).join(", ")}]`;

/**
 * Generate bounded native converters, without admitting a prepared package.
 * The private call layer supplies an authenticated, pinned FFI binding and
 * constructs identity wrappers using the result's lease or callback scope.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedPhpConversions = (ir, options = {}) => {
	const model = generateOwnedPhpValues(ir, { ...options, integerBits: 64, wordBits: 64 });
	const transferredInputs = model.functions.some(fn => fn.transfers?.length);
	const anchoredResults = model.c.anchoredResults;
	const { c, namespace } = model, nodes = new Map(model.types.map(node => [node.id, node]));
	for(const name of ["lb_php_integer", "lb_php_owned_bytes", "lb_php_owned_slot"
		, ...["new", "free", "text"].map(suffix => `${c.prefix}_php_integer_${suffix}`)])
		if(new RegExp(`\\b${name}\\b`, "u").test(c.header)) throw new TypeError(`Owned PHP native helper collides with ${name}`);
	const finite = new Set();
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of model.types)
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.kind === "primitive" || node.identity || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields))
					: node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabited && !finite.has(node.id))
			{ finite.add(node.id); changed = true; }
		}
	}
	const field = (item, path = [], key = item.publicName) => ({ type: item.index, path: [...path, item.name], pointer: item.pointer, key });
	const descriptors = model.types.map(node => ({ ctype: node.cName
		, kind: node.kind
		, scalar: node.kind === "primitive" ? node.name : null
		, identity: node.identity
		, class: node.identity ? `${namespace}\\${node.publicType}` : null
		, leaf: node.leaf, inhabited: finite.has(node.id)
		, element: node.element ? nodes.get(node.element).index : null
		, flag: { variant: "kind", option: "has_value", result: "is_ok" }[node.kind] ?? null
		, branches: node.kind === "variant" ? node.cases.map(branch => ({ class: `${namespace}\\${branch.publicName}`, fields: branch.fields.map(item => field(item, ["cases", branch.name])) }))
			: node.kind === "option" ? [{ class: null, fields: [] }, { class: `${namespace}\\Some`, fields: [field(node.fields[0], [], "value")] }]
				: node.kind === "result" ? [1, 0].map(index => ({ class: `${namespace}\\${index ? "Err" : "Ok"}`, fields: [field(node.fields[index], [], "value")] }))
					: [{ class: node.kind === "record" ? `${namespace}\\${node.publicType}` : null, fields: node.fields.map(item => field(item)) }] }));
	const definitions = `typedef struct lb_php_integer lb_php_integer;
typedef const lb_php_integer *mpz_srcptr;
typedef uint8_t *lb_php_owned_bytes;
typedef uint8_t **lb_php_owned_slot;
${c.header.replace(/^#.*\n/gmu, "").replace(/^extern "C" \{\n|^\}\n/gmu, "")}
${c.prefix}_status ${c.prefix}_php_integer_new(const char *, size_t, mpz_srcptr *);
void ${c.prefix}_php_integer_free(mpz_srcptr *);
${c.prefix}_status ${c.prefix}_php_integer_text(mpz_srcptr, char *, size_t, size_t *);
`;
	const support = `${copiedPhpHelpers.slice(copiedPhpHelpers.indexOf("final class ScalarCodec"))}\n${ownedPhpConversionSupport({ transferredInputs: transferredInputs && !anchoredResults, anchoredResults })}\n${ownedPhpConversionTransfer}`
		.replaceAll("@PREFIX@", c.prefix).replaceAll("@NAMESPACE@", `\\${namespace}`);
	const files = { ...model.files
		, "src/Internal/OwnedNativeTypes.php": `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nfinal class OwnedNativeTypes\n{\n    public const DEFINITIONS = <<<'CDEFS'\n${definitions}CDEFS;\n    public const NODES = ${literal(descriptors)};\n}\n`
		, "src/Internal/OwnedConversions.php": `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nrequire_once __DIR__ . '/Values.php';\nrequire_once __DIR__ . '/OwnedNativeTypes.php';\n${support}` };
	if(Object.values(files).reduce((sum, source) => sum + Buffer.byteLength(source), 0) > 8 * 1024 * 1024)
		throw new TypeError("Owned PHP converters exceed 8 MiB");
	return { ...model, files, definitions, descriptors, nativeSource: ownedPhpIntegerSupport(c.prefix) };
};
