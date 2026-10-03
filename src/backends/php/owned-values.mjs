/**
 * Finite PHP declarations for explicit resource-bearing ownership graphs.
 *
 * @file
 */
import { generateOwnedCValues } from "../c/owned-values.mjs";
import { phpClassName, phpFieldName, reservedPhpNames } from "./copied-names.mjs";
import { copiedPhpValues } from "./copied-support.mjs";
import { phpValueMethods } from "./copied-equality.mjs";
import { phpGraphScalars } from "./copied-graph-scalars.mjs";
import { ownedPhpValueResources } from "./owned-value-resources.mjs";
import { ownedPhpValueWalk } from "./owned-value-walk.mjs";
import { ownedPhpBorrowValue, ownedPhpBorrowAccess } from "./owned-borrows.mjs";
import { ownedPhpReceiverMembers, ownedPhpReceiverOwners } from "./owned-receivers.mjs";

const literal = value => value === null ? "null" : typeof value === "number" ? String(value)
	: typeof value === "string" ? `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`
		: Array.isArray(value) ? `[${value.map(literal).join(", ")}]`
			: `[${Object.entries(value).map(([key, child]) => `${literal(key)} => ${literal(child)}`).join(", ")}]`;
const pascal = name => name.split("_").filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("") + (name.match(/_+$/u)?.[0] ?? "");
const bigint = "\\Brick\\Math\\BigInteger";

/**
 * Keep nominal recursion finite, aliases transparent, and PHP/Lean word widths
 * independent. This value projection does not admit native or Wasm transport.
 *
 * @param ir - Compiler-authenticated explicit ownership contract.
 * @param options - Checked PHP and Lean integer widths.
 * @param options.integerBits - PHP integer width.
 * @param options.wordBits - Lean machine-word width.
 * @param options.transferredInputs - Admit explicitly consuming arguments.
 * @param options.anchoredResults - Admit original-owner borrowed results.
 * @param options.receiverExports - Admit checked methods and properties.
 * @param options.callbackResultAnchors - Preserve callback-local result owners.
 * @param options.hostCallbacks - Admit synchronous host callbacks and copied returns.
 */
export const generateOwnedPhpValues = (ir, { integerBits = 64, wordBits = integerBits, transferredInputs = false, anchoredResults = false, receiverExports = false, callbackResultAnchors = false, hostCallbacks = true } = {}) => {
	if(![32, 64].includes(integerBits) || ![32, 64].includes(wordBits)) throw new TypeError("PHP and Lean integer widths must be 32 or 64");
	const identityEquality = receiverExports && ir.declarations.some(item => item.receiver);
	const valueCopies = callbackResultAnchors && ir.types.some(type => type.kind === "callback" && type.callable.result.ownership === "borrow");
	const c = generateOwnedCValues(ir, { hostCallbacks, valueCopies, transferredInputs, anchoredResults, receiverExports, callbackResultAnchors, identityEquality }), namespace = `Lean${pascal(c.prefix)}`;
	callbackResultAnchors = c.callbacks.some(callback => callback.anchor !== undefined);
	anchoredResults = c.anchoredResults;
	receiverExports = c.functions.some(fn => fn.receiver === 0);
	const wholeOwners = Boolean(anchoredResults || receiverExports);
	const fail = message => { throw new TypeError(`Invalid owned PHP values: ${message}`); };
	const occupied = new Set([...reservedPhpNames, "some", "ok", "err", "withrecovery"]), names = new Map();
	if(wholeOwners) occupied.add("value");
	const claim = source => {
		const name = phpClassName(source);
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || occupied.has(name.toLowerCase())) fail(`reserved or duplicate name: ${name}`);
		occupied.add(name.toLowerCase()); return name;
	};
	const definitions = new Map(ir.types.map(node => [node.id, node]));
	for(const node of c.nodes) if(node.kind !== "primitive" && node.name) names.set(node.id, claim(node.name));
	for(const alias of c.native.aliases) claim(definitions.get(alias.id).name);
	const nodes = new Map(c.nodes.map((node, index) => [node.id, { ...node, index }]));
	const scalar = name => {
		const basic = { unit: "null", bool: "bool", char: "string", string: "string", bytes: "Bytes", float32: "float", float64: "float" }[name];
		if(basic) return { publicType: basic, kind: "primitive", name };
		const bits = name === "usize" || name === "isize" ? wordBits : Number(name.match(/\d+/u)?.[0]);
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
			if(names.has(node.id))
			{ annotations.set(entry.id, { publicType: names.get(node.id), docType: names.get(node.id), depth: 0 }); continue; }
			if(node.kind === "primitive")
			{ const value = scalar(node.name); annotations.set(entry.id, { publicType: value.publicType, docType: value.publicType, depth: 0 }); continue; }
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
	const fields = (values, tuple = false) => {
		const seen = new Set();
		return values.map((field, index) => {
			const publicName = tuple ? index : phpFieldName(field.sourceName, fail);
			if(seen.has(publicName)) fail(`duplicate field: ${publicName}`); seen.add(publicName);
			return { ...field, publicName, ...annotation(field.type), index: nodes.get(field.type).index };
		});
	};
	const types = [...nodes.values()].map(node => ({ ...node, ...annotation(node.id)
		, fields: ["option", "result", "tuple"].includes(node.kind) ? fields(node.fields, true) : fields(node.fields)
		, cases: node.cases.map(branch => ({ ...branch, publicName: claim(names.get(node.id) + pascal(branch.sourceName)), fields: fields(branch.fields) })) }));
	if(receiverExports) for(const node of types)
		if(node.representation !== "copied" && (node.identity || ["record", "variant"].includes(node.kind)))
			node.ownerType = claim(node.publicType + "Value");
	const records = types.flatMap(node => node.kind === "record" ? [{ name: node.publicType, fields: node.fields, parent: null, index: node.index }]
		: node.cases.map(branch => ({ name: branch.publicName, fields: branch.fields, parent: node.publicType, index: node.index })));
	const functionNames = new Set(), declarations = new Map(ir.declarations.map(item => [item.id, item]));
	const functions = c.functions.map(fn => {
		const declaration = declarations.get(fn.id), publicName = phpClassName(fn.cName.slice(c.prefix.length + 1));
		if(functionNames.has(publicName.toLowerCase())) fail(`duplicate function: ${publicName}`);
		functionNames.add(publicName.toLowerCase()); const seen = new Set();
		let receiverName = "receiver";
		while(declaration.parameters.some(parameter => phpFieldName(parameter.name, fail) === receiverName)) receiverName += "_";
		const publicParameters = [...declaration.receiver ? [{ name: receiverName }] : [], ...declaration.parameters].map(parameter => {
			const name = phpFieldName(parameter.name, fail);
			if(seen.has(name)) fail(`duplicate parameter: ${name}`); seen.add(name); return name;
		});
		return { ...fn, declaration, publicName, publicParameters };
	});
	const aliases = c.native.aliases.map(alias => ({ ...alias, name: definitions.get(alias.id).name
		, targetType: structuredClone(definitions.get(alias.id).target)
		, phpType: annotation(alias.target).docType }));
	const qualified = name => `${namespace}\\${name}`;
	const classes = Object.fromEntries([...records.map(record => [qualified(record.name), { fields: record.fields.map(field => [field.publicName, field.index]) }])
		, ...["Some", "Ok", "Err"].map(name => [qualified(name), { fields: [["value", null]] }])]);
	const identities = Object.fromEntries(types.filter(node => node.identity).map(node => [qualified(node.publicType), node.index]));
	const catalog = types.map(node => node.kind === "primitive" ? (() => { const value = scalar(node.name); delete value.publicType; return value; })()
		: { kind: node.kind
			, element: node.element ? nodes.get(node.element).index : null
			, fields: node.fields.map(field => [field.publicName, field.index])
			, classes: (node.identity || node.kind === "record" ? [node.publicType] : node.kind === "option" ? ["Some"] : node.kind === "result" ? ["Ok", "Err"] : node.cases.map(branch => branch.publicName)).map(qualified) });
	const resources = types.filter(node => node.identity).map(node => {
		const callback = c.callbacks.find(fn => fn.id === node.id), args = callback?.parameters.slice(1).map((_, index) => `$argument${index}`) ?? [];
		const members = receiverExports ? ownedPhpReceiverMembers(node, functions, types, true, { callbackResultAnchors }) : { doc: "", source: "" };
		return `${members.doc}final class ${node.publicType} extends Internal\\Resource
{
${members.source}${callback && callbackResultAnchors ? `    public function copyArg(mixed $index, mixed $value): Value {
        if (\\func_num_args() !== 2 || !\\is_int($index)) throw new \\TypeError('copyArg requires an argument index and value');
        return Internal\\Native::copyCallback($this, $index, $value);
    }
    public function copyResult(mixed $value): Value {
        if (\\func_num_args() !== 1) throw new \\ArgumentCountError('copyResult requires one value');
        return Internal\\Native::copyCallback($this, null, $value);
    }
` : ""}${callback ? `    public function __invoke(${args.map(arg => `mixed ${arg}`).join(", ")}): mixed {
        if (\\func_num_args() !== ${args.length}) throw new \\ArgumentCountError('Lean closure requires ${args.length} arguments');
        return Internal\\ResourceAccess::invoke($this, [${args.join(", ")}]);
    }\n` : ""}}`;
	}).join("\n\n");
	const source = `<?php\ndeclare(strict_types=1);\nnamespace ${namespace};

require_once __DIR__ . '/Internal/Values.php';

${aliases.map(alias => `/** ${alias.name} = ${alias.phpType}; no alias wrapper class. */`).join("\n")}
${copiedPhpValues.replaceAll("is_string(", "\\is_string(").replaceAll("strlen(", "\\strlen(")}
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
${resources}
`;
	const files = { "src/Api.php": source
		, "src/Internal/Values.php": `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nrequire_once __DIR__ . '/GraphTypes.php';\n${ownedPhpValueResources}\n${phpGraphScalars.replaceAll("GRAPH_NAMESPACE", `\\${namespace}`).replaceAll("Copied value", "Owned value")}\n${ownedPhpValueWalk(namespace, { anchoredResults: wholeOwners })}`
		, "src/Internal/GraphTypes.php": `<?php\ndeclare(strict_types=1);\nnamespace ${namespace}\\Internal;\n\nfinal class GraphTypes\n{\n    public const NODES = ${literal(catalog)};\n    public const CLASSES = ${literal(classes)};\n    public const IDENTITIES = ${literal(identities)};\n}\n` };
	if(wholeOwners)
	{
		const valueSource = callbackResultAnchors ? ownedPhpBorrowValue.replace(
			"    public function __invoke(mixed ...$arguments): mixed"
			, String.raw`    public function copyArg(mixed $index, mixed $value): Value {
        if (\func_num_args() !== 2 || !\is_int($index)) throw new \TypeError('copyArg requires an argument index and value');
        return Internal\Native::copyCallback($this, $index, $value);
    }
    public function copyResult(mixed $value): Value {
        if (\func_num_args() !== 1) throw new \ArgumentCountError('copyResult requires one value');
        return Internal\Native::copyCallback($this, null, $value);
    }
    public function __invoke(mixed ...$arguments): mixed`) : ownedPhpBorrowValue;
		const owners = receiverExports ? ownedPhpReceiverOwners(namespace, types, functions, { valueSource, callbackResultAnchors })
			: { value: valueSource, access: ownedPhpBorrowAccess.replaceAll("@NAMESPACE@", `\\${namespace}`) };
		files["src/Api.php"] += owners.value;
		files["src/Internal/Values.php"] += owners.access;
	}
	if(wholeOwners)
	{
		files["src/Internal/Values.php"] = files["src/Internal/Values.php"].replace(
			"    final public function close(): void { $this->binding->close(); }"
			, String.raw`    final public function close(): void { $this->binding->close(); }
    final public function sameIdentity(Resource $other): bool {
        $left = ResourceAccess::binding($this); $right = ResourceAccess::binding($other);
        if (static::class !== $other::class) return false;
        if (!$left instanceof NativeBinding || !$right instanceof NativeBinding) throw new \TypeError('Expected native PHP resources');
        return $left->sameIdentity($right);
    }`);
	}
	if(Object.values(files).reduce((sum, contents) => sum + Buffer.byteLength(contents), 0) > 4 * 1024 * 1024) fail("PHP declarations exceed 4 MiB");
	return { c, namespace, integerBits, wordBits, files, source: files["src/Api.php"], types, records, functions, aliases, wholeOwners, receiverExports, hostCallbacks, callbackResultAnchors, publicFiles: ["src/Api.php"] };
};
