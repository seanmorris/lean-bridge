/**
 * Finite Java descriptors over the explicitly owned native value ABI.
 *
 * @file
 */
import { generateOwnedJvmValues } from "./owned-values.mjs";
import { ownedJvmConversionRuntime, ownedJvmConversionSupport } from "./owned-conversion-runtime.mjs";
import { ownedJvmScalars, ownedJvmScalarNames } from "./owned-scalars.mjs";
import { ownedJvmRuntime, ownedJvmException } from "./owned-runtime.mjs";

const boxes = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" };

/**
 * Emit nominal construction and field access separately from the transport.
 *
 * @param model - Checked owned layouts and public JVM values.
 * @param options - Select the separately generated Kotlin value family.
 * @param options.kotlin - Use Kotlin public types in the same artifact.
 */
export const ownedJvmDescriptorSource = (model, { kotlin = false } = {}) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const hostNamespace = model.namespace + (kotlin ? ".kotlin" : "");
	const descriptor = name => kotlin ? `_OwnedTypes.${name}` : name;
	const className = kotlin ? "_KotlinOwnedTypes" : "_OwnedTypes";
	const typeNames = new Map(), erasedNames = new Map();
	const type = (id, erased = false) => {
		const cache = erased ? erasedNames : typeNames;
		if(cache.has(id)) return cache.get(id);
		const node = nodes.get(id), nominal = name => `${hostNamespace}.${name}`;
		const name = node.name && node.kind !== "primitive" ? nominal(node.publicType)
			: node.kind === "primitive" ? node.name === "unit" ? `${model.namespace}.Unit` : node.publicType
				: node.element ? `${type(node.element, erased)}[]`
					: nominal({ option: "Option", result: "Result", tuple: "Pair" }[node.kind]) + (erased ? "" : `<${node.fields.map(field => boxes[type(field.type)] ?? type(field.type)).join(", ")}>`);
		cache.set(id, name); return name;
	};
	let budget = 16 * 1024 * 1024 - ownedJvmConversionRuntime.length - ownedJvmScalars.length - model.layoutSource.length;
	for(const node of model.types)
	{
		budget -= 4096 + type(node.id).length * 8;
		for(const branch of node.cases) budget -= 1024 + branch.publicName.length * 4;
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)]) budget -= 256 + type(field.type).length * 4;
	}
	if(budget < 0) throw new TypeError("Invalid Java ownership graph: generated converters exceed 16 MiB");
	const finite = new Set();
	for(let changed = true; changed;)
	{
		changed = false;
		for(const node of model.types)
		{
			const all = fields => fields.every(field => finite.has(field.type));
			const inhabited = node.identity || node.kind === "primitive" || node.element || node.kind === "option"
				|| (node.kind === "variant" ? node.cases.some(branch => all(branch.fields)) : node.kind === "result" ? node.fields.some(field => finite.has(field.type)) : all(node.fields));
			if(inhabited && !finite.has(node.id))
			{ finite.add(node.id); changed = true; }
		}
	}
	const create = (name, fields) => {
		const qualified = `${hostNamespace}.${name}`, record = model.records.find(record => record.name === name);
		const arguments_ = fields.map((field, index) => `(${type(field.type)}) values[${index}]`);
		return record.builder
			? `var builder = ${qualified}.builder(); ${fields.map((field, index) => `builder.${field.publicName}(${arguments_[index]});`).join(" ")} return builder.build();`
			: `return new ${qualified}(${arguments_.join(", ")});`;
	};
	const helpers = [];
	const shapes = model.types.filter(node => node.kind !== "primitive" && !node.element && !node.identity).map(node => {
		let branch, get, make;
		if(node.kind === "variant")
		{
			branch = node.cases.map((value, index) => `if (value instanceof ${hostNamespace}.${value.publicName}) return ${index};`).join("\n            ") + '\n            throw new IllegalArgumentException("Unknown ownership variant constructor");';
			for(const [index, branch] of node.cases.entries())
			{
				const body = branch.fields.length ? `return switch (index) { ${branch.fields.map((field, j) => `case ${j} -> item.${field.publicName}();`).join(" ")} default -> throw new IndexOutOfBoundsException(index); };` : "throw new IndexOutOfBoundsException(index);";
				helpers.push(`    private static Object get${node.index}_${index}(Object value, int index) { var item = (${hostNamespace}.${branch.publicName}) value; ${body} }`);
				helpers.push(`    private static Object create${node.index}_${index}(Object[] values) { ${create(branch.publicName, branch.fields)} }`);
			}
			get = `return switch (tag) { ${node.cases.map((_, index) => `case ${index} -> get${node.index}_${index}(value, index);`).join(" ")} default -> throw new IllegalArgumentException("Unknown variant"); };`;
			make = `return switch (tag) { ${node.cases.map((_, index) => `case ${index} -> create${node.index}_${index}(values);`).join(" ")} default -> throw new IllegalArgumentException("Unknown variant"); };`;
		} else if(node.kind === "option")
		{
			branch = `return ((${hostNamespace}.Option<?>) value).isSome() ? 1 : 0;`;
			get = `return ((${hostNamespace}.Option<?>) value).value();`;
			make = `return tag == 0 ? ${hostNamespace}.Option.none() : ${hostNamespace}.Option.some(values[0]);`;
		} else if(node.kind === "result")
		{
			branch = `return ((${hostNamespace}.Result<?, ?>) value).isOk() ? 1 : 0;`;
			get = `var item = (${hostNamespace}.Result<?, ?>) value; return tag == 1 ? item.value() : item.error();`;
			make = `return tag == 1 ? ${hostNamespace}.Result.ok(values[0]) : ${hostNamespace}.Result.err(values[0]);`;
		} else if(node.kind === "tuple")
		{
			branch = "return 0;"; get = `var item = (${hostNamespace}.Pair<?, ?>) value; return index == 0 ? item.first() : item.second();`;
			make = `return new ${hostNamespace}.Pair<>(values[0], values[1]);`;
		} else
		{
			branch = "return 0;";
			get = node.fields.length ? `var item = (${type(node.id)}) value; return switch (index) { ${node.fields.map((field, i) => `case ${i} -> item.${field.publicName}();`).join(" ")} default -> throw new IndexOutOfBoundsException(index); };` : "throw new IndexOutOfBoundsException(index);";
			make = create(node.publicType, node.fields);
		}
		return `    private static final ${descriptor("Shape")} S${node.index} = new ${descriptor("Shape")}() {
        public int branch(Object value) { ${branch} }
        public Object get(Object value, int tag, int index) { ${get} }
        public Object create(int tag, Object[] values) { ${make} }
    };`;
	});
	const edge = (field, base = 0) => `new ${descriptor("Edge")}(${nodes.get(field.type).index}, ${base + field.offset}, ${field.pointer})`;
	const descriptors = model.types.map(node => {
		const branches = node.kind === "variant" ? node.cases.map(branch => branch.fields.map(field => edge(field, node.payloadOffset)))
			: node.kind === "option" ? [[], [edge(node.fields[0])]] : node.kind === "result" ? [[edge(node.fields[1])], [edge(node.fields[0])]]
				: [node.fields.map(field => edge(field))];
		const kind = node.identity ? 5 : node.kind === "primitive" ? 0 : node.element ? 1 : node.kind === "variant" ? 2 : ["option", "result"].includes(node.kind) ? 3 : 4;
		for(const [index, fields] of branches.entries()) helpers.push(`    private static ${descriptor("Edge")}[] edges${node.index}_${index}() { return new ${descriptor("Edge")}[] { ${fields.join(", ")} }; }`);
		helpers.push(`    private static ${descriptor("Node")} node${node.index}() { return new ${descriptor("Node")}(${node.index}, ${kind}, ${node.kind === "primitive" ? ownedJvmScalarNames.indexOf(node.name) : -1}, _OwnedLayouts.${node.layoutName}, ${node.aggregate}, ${finite.has(node.id)}, ${(boxes[type(node.id, true)] ?? type(node.id, true))}.class, ${node.element ? nodes.get(node.element).index : -1}, new ${descriptor("Edge")}[][] { ${branches.map((_, index) => `edges${node.index}_${index}()`).join(", ")} }, ${kind > 1 && kind < 5 ? `S${node.index}` : "null"}, ${node.identity ? `value -> ((${type(node.id)})value).handle` : "null"}); }`);
		return `        node${node.index}()`;
	});
	const typesSource = `package ${model.namespace};

@SuppressWarnings("unchecked")
final class ${className} {
    private ${className}() { }
${kotlin ? "" : `    record Edge(int type, long offset, boolean pointer) { }
    interface Shape {
        int branch(Object value);
        Object get(Object value, int tag, int index);
        Object create(int tag, Object[] fields);
    }
    record Node(int id, int kind, int scalar, java.lang.foreign.MemoryLayout layout, boolean aggregate,
        boolean inhabited, Class<?> hostType, int element, Edge[][] branches, Shape shape,\n        java.util.function.Function<Object, _OwnedRuntime.Handle> identity) {
        long size() { return layout.byteSize(); }
        long alignment() { return layout.byteAlignment(); }
    }
    record Catalog(Node[] nodes, int[][] parameters, int[] results) { }
`}
${shapes.join("\n")}
${helpers.join("\n")}
    static final ${descriptor("Node")}[] NODES = {
${descriptors.join(",\n")}
    };
    static final int[][] PARAMETERS = { ${model.functions.map(fn => `{ ${fn.parameters.map(id => nodes.get(id).index).join(", ")} }`).join(", ")} };
    static final int[] RESULTS = { ${model.functions.map(fn => nodes.get(fn.result).index).join(", ")} };
    static final ${descriptor("Catalog")} CATALOG = new ${descriptor("Catalog")}(NODES, PARAMETERS, RESULTS);
}
`;
	if(typesSource.length > 16 * 1024 * 1024) throw new TypeError("Invalid JVM ownership graph: generated descriptors exceed 16 MiB");
	return typesSource;
};

/**
 * Converters neither load libraries nor invoke Lean. Call adapters supply
 * authenticated factories, native targets and owning or expiring leases.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedJvmConversions = (ir, options = {}) => {
	const model = generateOwnedJvmValues(ir, options), typesSource = ownedJvmDescriptorSource(model);
	const transferredInputs = model.c.functions.some(fn => fn.transfers?.length);
	const anchoredResults = [...model.c.functions, ...model.c.callbacks].some(fn => fn.anchor !== undefined);
	const wholeOwners = anchoredResults || model.c.functions.some(fn => fn.receiver === 0);
	const prefix = `src/main/java/${model.namespace.replaceAll(".", "/")}`;
	const internal = { _OwnedLayouts: model.layoutSource, _OwnedTypes: typesSource
		, _OwnedConvert: `package ${model.namespace};\n\n${ownedJvmConversionSupport({ transferredInputs, anchoredResults: wholeOwners })}`
		, _OwnedScalars: `package ${model.namespace};\n\n${ownedJvmScalars}`
		, _OwnedRuntime: `package ${model.namespace};\n\n${ownedJvmRuntime(model.c.prefix, { transferredInputs, anchoredResults, wholeOwners })}` };
	const exceptionPath = `${prefix}/LeanBridgeException.java`;
	const files = { ...model.files
		, [exceptionPath]: `package ${model.namespace};\n\n${ownedJvmException}`
		, ...Object.fromEntries(Object.entries(internal).map(([name, source]) => [`${prefix}/${name}.java`, source])) };
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned JVM conversion source exceeds 16 MiB");
	return { ...model, files, typesSource
		, publicFiles: [...model.publicFiles, exceptionPath]
		, internalFiles: [...model.internalFiles, ...Object.keys(internal).map(name => `${prefix}/${name}.java`)] };
};
