/**
 * Finite PHP FFI graph declarations and private bounded native conversions.
 *
 * @file
 */
import { generateCopiedCGraphTypes } from "../c/copied-graph-layout.mjs";
import { generateCopiedPhpGraphValues } from "./copied-graph-values.mjs";
import { copiedPhpHelpers } from "./copied-support.mjs";
import { phpGraphNativeSupport } from "./copied-graph-native.mjs";
import { phpGraphTransfer } from "./copied-graph-transfer.mjs";

const literal = value => value === null ? "null" : typeof value === "boolean" || typeof value === "number" ? String(value)
	: typeof value === "string" ? `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
		: Array.isArray(value) ? `[${value.map(literal).join(", ")}]`
			: `[${Object.entries(value).map(([key, child]) => `${literal(key)} => ${literal(child)}`).join(", ")}]`;

/**
 * Generate native Linux x86-64 converters without admitting a Composer release.
 * Public validation stays usable without FFI. The caller supplies an authenticated
 * lazy target; all inputs are validated and copied before that target is loaded.
 *
 * @param ir - Pure copied Binding IR, including finite recursive nominal types.
 */
export const generateCopiedPhpGraphConversions = ir => {
	const model = generateCopiedPhpGraphValues(ir), nodes = new Map(model.types.map(node => [node.id, node]));
	// These declarations are the actual public C graph header, without its
	// preprocessor directives or inline init/clear functions. No native symbol is
	// resolved while PHP checks the schema or allocates input scratch.
	// Store pointer typedefs in the FFI schema. Temporary parsed pointer types
	// must not become dangling metadata when an arithmetic view outlives a cast.
	const definitions = "typedef uint8_t *lb_php_graph_byte_pointer;\ntypedef uint8_t **lb_php_graph_byte_slot;\n" + generateCopiedCGraphTypes(ir).header
		.replace(/^#.*\n/gm, "").replace(/^static inline[^\n]*\{[\s\S]*?\}\n/gm, "").trim();
	const finite = new Set();
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of model.types)
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabited && !finite.has(node.id))
			{ finite.add(node.id); changed = true; }
		}
	}
	const field = (item, path = [], key = item.publicName) => ({ type: nodes.get(item.type).index
		, path: [...path, item.name], pointer: item.storage === "pointer", key });
	const descriptors = model.types.map(node => ({ ctype: node.name
		, kind: node.kind, scalar: node.ref.name ?? null
		, aggregate: node.aggregate, inhabited: finite.has(node.id)
		, element: node.element ? nodes.get(node.element).index : null
		, branches: node.kind === "variant" ? node.cases.map(branch => ({ class: `${model.namespace}\\${branch.publicName}`, fields: branch.fields.map(item => field(item, ["cases", branch.name])) }))
			: node.kind === "option" ? [{ class: null, fields: [] }, { class: `${model.namespace}\\Some`, fields: [field(node.fields[0], [], "value")] }]
				: node.kind === "result" ? [1, 0].map(index => ({ class: `${model.namespace}\\${index ? "Err" : "Ok"}`, fields: [field(node.fields[index], [], "value")] }))
					: [{ class: node.kind === "record" ? `${model.namespace}\\${node.publicType}` : null
						, fields: node.fields.map((item, index) => field(item, [], node.kind === "tuple" ? index : item.publicName)) }] }));
	const functions = model.layout.roots.map(root => ({ parameters: root.parameters.map(id => nodes.get(id).index), result: nodes.get(root.result).index }));
	const files = { ...model.files
		, "src/Internal/GraphNativeTypes.php": `<?php\ndeclare(strict_types=1);\nnamespace ${model.namespace}\\Internal;\n\nfinal class GraphNativeTypes\n{\n    public const DEFINITIONS = <<<'CDEFS'\n${definitions}\nCDEFS;\n    public const NODES = [\n${descriptors.map(node => `        ${literal(node)},`).join("\n")}\n    ];\n    public const FUNCTIONS = ${literal(functions)};\n}\n`
		, "src/Internal/GraphNative.php": `<?php\ndeclare(strict_types=1);\nnamespace ${model.namespace}\\Internal;\n\nrequire_once __DIR__ . '/Values.php';\nrequire_once __DIR__ . '/GraphNativeTypes.php';\n${copiedPhpHelpers.slice(copiedPhpHelpers.indexOf("final class ScalarCodec"))}\n${phpGraphNativeSupport}\n${phpGraphTransfer}\n`.replaceAll("GRAPH_NAMESPACE", `\\${model.namespace}`) };
	if(Object.values(files).reduce((sum, source) => sum + Buffer.byteLength(source), 0) > 8 * 1024 * 1024)
		throw new TypeError("PHP graph converters exceed 8 MiB");
	const nativeReleaseSource = `#include <stdint.h>
#include <string.h>
/* Root-only cleanup never follows child pointers, tags or lengths. */
void ${model.layout.prefix}_php_graph_clear(void *value) {
  if (!value) return;
  void *owner; void (*release)(void *);
  _Static_assert(sizeof(owner) == 8 && sizeof(release) == 8, "64-bit graph ABI");
  memcpy(&owner, value, sizeof(owner));
  memcpy(&release, (uint8_t *)value + 8, sizeof(release));
  memset(value, 0, 16);
  if (owner && release) release(owner);
}
`;
	return { ...model, files, definitions, descriptors, nativeReleaseSource };
};
