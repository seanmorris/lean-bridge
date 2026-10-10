/**
 * Finite PHP declarations for recursive copied values, without a native loader.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { phpClassName, phpFieldName, reservedPhpNames } from "./copied-names.mjs";
import { copiedPhpValues } from "./copied-support.mjs";
import { phpValueMethods } from "./copied-equality.mjs";
import { phpGraphScalars } from "./copied-graph-scalars.mjs";
import { phpGraphWalk } from "./copied-graph-walk.mjs";

const literal = value => value === null ? "null" : typeof value === "number" ? String(value)
	: typeof value === "string" ? `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
		: Array.isArray(value) ? `[${value.map(literal).join(", ")}]`
			: `[${Object.entries(value).map(([key, child]) => `${literal(key)} => ${literal(child)}`).join(", ")}]`;
const pascal = name => name.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (name.match(/_+$/)?.[0] ?? "");
const bigint = "\\Brick\\Math\\BigInteger";

/**
 * Retain finite nominal edges, PHPDoc container types and transparent aliases.
 * Integer width describes PHP values; word width describes Lean USize/ISize.
 * The reused finite C graph supplies node identities, not a PHP-Wasm ABI claim.
 *
 * @param ir - Pure copied Binding IR.
 * @param options - Checked host and Lean integer widths.
 * @param options.integerBits - PHP int width.
 * @param options.wordBits - Lean machine-word width.
 */
export const generateCopiedPhpGraphValues = (ir, { integerBits = 64, wordBits = integerBits } = {}) => {
	if(![32, 64].includes(integerBits) || ![32, 64].includes(wordBits)) throw new TypeError("PHP and Lean integer widths must be 32 or 64");
	const layout = compileCopiedCGraphLayout(ir), namespace = `Lean${pascal(layout.prefix)}`;
	const fail = message => { throw new TypeError(`Invalid PHP copied graph: ${message}`); };
	const occupied = new Set([...reservedPhpNames, "some", "ok", "err"]), names = new Map();
	const claim = source => {
		const name = phpClassName(source);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || occupied.has(name.toLowerCase())) fail(`reserved or duplicate name: ${name}`);
		occupied.add(name.toLowerCase()); return name;
	};
	for(const definition of [...ir.types].sort((a, b) => a.id.localeCompare(b.id)))
		names.set(definition.id, claim(definition.name));
	const nodes = new Map(layout.nodes.map((node, index) => [node.id, { ...node, index }]));
	const scalar = name => {
		const basic = { unit: "null", bool: "bool", char: "string", string: "string", bytes: "Bytes", float32: "float", float64: "float" }[name];
		if(basic) return { publicType: basic, kind: "primitive", name };
		const bits = name === "usize" || name === "isize" ? wordBits : Number(name.match(/\d+/)?.[0]);
		const unsigned = name === "nat" || name.startsWith("u");
		const min = bits ? unsigned ? "0" : String(-(1n << BigInt(bits - 1))) : unsigned ? "0" : null;
		const max = bits ? String((1n << BigInt(bits - (unsigned ? 0 : 1))) - 1n) : null;
		const big = !bits || bits > integerBits || unsigned && bits === integerBits;
		return { publicType: big ? bigint : "int", kind: "primitive", name, host: big ? "bigint" : "int", min, max };
	};
	const annotations = new Map(); let expanded = 0;
	const annotation = id => {
		const pending = [{ id, ready: false }];
		while(pending.length)
		{
			const entry = pending.pop(); if(annotations.has(entry.id)) continue;
			const node = nodes.get(entry.id);
			if(node.ref.kind === "named")
			{ annotations.set(entry.id, { publicType: names.get(node.ref.id), docType: names.get(node.ref.id), depth: 0 }); continue; }
			if(node.kind === "primitive")
			{ const value = scalar(node.ref.name); annotations.set(entry.id, { publicType: value.publicType, docType: value.publicType, depth: 0 }); continue; }
			const children = node.element ? [node.element] : node.fields.map(field => field.type);
			if(!entry.ready)
			{ pending.push({ ...entry, ready: true }); for(const id of children) if(!annotations.has(id)) pending.push({ id, ready: false }); continue; }
			const values = children.map(id => annotations.get(id)), depth = 1 + Math.max(...values.map(value => value.depth));
			if(depth > 32 || values.reduce((sum, value) => sum + value.docType.length, 0) > 65500) fail("PHPDoc type exceeds 32 structural levels or 65536 characters; introduce a named type");
			const docs = values.map(value => value.docType);
			const docType = node.element ? `list<${docs[0]}>` : node.kind === "option" ? `Some<${docs[0]}>|null`
				: node.kind === "result" ? `Ok<${docs[0]}>|Err<${docs[1]}>` : `array{${docs.join(", ")}}`;
			expanded += docType.length; if(expanded > 4 * 1024 * 1024) fail("PHPDoc catalog exceeds 4 MiB");
			annotations.set(entry.id, { publicType: node.element || node.kind === "tuple" ? "array" : node.kind === "option" ? "Some|null" : "Ok|Err", docType, depth });
		}
		return annotations.get(id);
	};
	const fields = values => {
		const seen = new Set();
		return values.map(field => {
			const publicName = phpFieldName(field.sourceName, fail);
			if(seen.has(publicName)) fail(`duplicate field: ${publicName}`); seen.add(publicName);
			return { ...field, publicName, ...annotation(field.type), index: nodes.get(field.type).index };
		});
	};
	const types = [...nodes.values()].map(node => ({ ...node, ...annotation(node.id), fields: fields(node.fields)
		, cases: node.cases.map(branch => ({ ...branch, publicName: claim(names.get(node.ref.id) + pascal(branch.sourceName)), fields: fields(branch.fields) })) }));
	const records = types.flatMap(node => node.kind === "record" ? [{ name: node.publicType, fields: node.fields, parent: null, index: node.index }]
		: node.cases.map(branch => ({ name: branch.publicName, fields: branch.fields, parent: node.publicType, index: node.index })));
	const functionNames = new Set();
	const functions = layout.roots.map(root => {
		const declaration = ir.declarations.find(item => item.id === root.bindingId), publicName = phpClassName(root.name.slice(layout.prefix.length + 1));
		if(functionNames.has(publicName.toLowerCase())) fail(`duplicate function: ${publicName}`);
		functionNames.add(publicName.toLowerCase()); const seen = new Set();
		const parameters = declaration.parameters.map(parameter => {
			const name = phpFieldName(parameter.name, fail);
			if(seen.has(name)) fail(`duplicate parameter: ${name}`); seen.add(name); return name;
		});
		return { ...root, declaration, publicName, parameters };
	});
	const aliases = layout.aliases.map(alias => ({ id: alias.id
		, name: ir.types.find(item => item.id === alias.id).name
		, target: structuredClone(ir.types.find(item => item.id === alias.id).target)
		, phpType: annotation(alias.target).docType }));
	const qualified = name => `${namespace}\\${name}`;
	const classes = Object.fromEntries([...records.map(record => [qualified(record.name), { fields: record.fields.map(field => [field.publicName, field.index]) }])
		, ...["Some", "Ok", "Err"].map(name => [qualified(name), { fields: [["value", null]] }])]);
	const catalog = types.map(node => node.kind === "primitive" ? (() => { const value = scalar(node.ref.name); delete value.publicType; return value; })()
		: { kind: node.kind
			, element: node.element ? nodes.get(node.element).index : null
			, fields: node.fields.map((field, index) => [node.kind === "tuple" ? index : field.publicName, field.index])
			, classes: (node.kind === "record" ? [node.publicType] : node.kind === "option" ? ["Some"] : node.kind === "result" ? ["Ok", "Err"] : node.cases.map(branch => branch.publicName)).map(qualified) });
	const source = `<?php
declare(strict_types=1);
namespace ${namespace};

require_once __DIR__ . '/Internal/Values.php';

${aliases.length ? `/** Copied aliases retain their target PHP values, without wrapper classes.\n${aliases.map(alias => ` * ${alias.name}: ${alias.phpType}`).join("\n")}\n */\n` : ""}${copiedPhpValues.replaceAll("is_string(", "\\is_string(").replaceAll("strlen(", "\\strlen(")}
${["Some", "Ok", "Err"].map(name => `/** @template T */
final readonly class ${name}
{
    /** @var T */
    public mixed $value;
    /** @param T $value */
    public function __construct(mixed $value) {
        if (\\func_num_args() !== 1) throw new \\ArgumentCountError('${name} requires one payload');
        $this->value = $value;
    }
${phpValueMethods}
}`).join("\n\n")}
${types.filter(node => node.kind === "variant").map(node => `abstract readonly class ${node.publicType} {}`).join("\n")}
${records.map(record => `final readonly class ${record.name}${record.parent ? ` extends ${record.parent}` : ""}
{
${record.fields.map(field => `    /** @var ${field.docType} */\n    public ${field.publicType} $${field.publicName};`).join("\n")}
    public function __construct(${record.fields.map(field => `mixed $${field.publicName}`).join(", ")}) {
        if (\\func_num_args() !== ${record.fields.length}) throw new \\ArgumentCountError('${record.name} requires exactly ${record.fields.length} fields');
        Internal\\Values::checkFields(self::class, [${record.fields.map(field => `$${field.publicName}`).join(", ")}]);
${record.fields.map(field => `        $this->${field.publicName} = $${field.publicName};`).join("\n")}
    }
${phpValueMethods}
}`).join("\n\n")}
`;
	const files = { "src/Api.php": source
		, "src/Internal/Values.php": `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nrequire_once __DIR__ . '/GraphTypes.php';\n${phpGraphScalars.replaceAll("GRAPH_NAMESPACE", `\\${namespace}`)}\n${phpGraphWalk(namespace)}`
		, "src/Internal/GraphTypes.php": `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nfinal class GraphTypes\n{\n    public const NODES = [\n${catalog.map(node => `        ${literal(node)},`).join("\n")}\n    ];\n    public const CLASSES = [\n${Object.entries(classes).map(([name, entry]) => `        ${literal(name)} => ${literal(entry)},`).join("\n")}\n    ];\n}\n` };
	if(Object.values(files).reduce((sum, source) => sum + Buffer.byteLength(source), 0) > 4 * 1024 * 1024) fail("PHP declarations exceed 4 MiB");
	return { layout, namespace, integerBits, wordBits, files, types, records, functions, aliases, publicFiles: ["src/Api.php"] };
};
