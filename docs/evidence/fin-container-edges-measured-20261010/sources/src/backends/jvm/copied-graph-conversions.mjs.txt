/**
 * Finite private Java graph descriptors and iterative native converters.
 *
 * @file
 */
import { compileCopiedJvmGraphLayout } from "./copied-graph-layout.mjs";
import { jvmGraphRuntime } from "./copied-graph-runtime.mjs";
import { jvmGraphScalars, jvmGraphScalarNames } from "./copied-graph-scalars.mjs";

const boxes = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" };

/**
 * Emit a finite host-value catalog over the shared JVM conversion engine.
 *
 * @param model - Checked graph layouts and Java-compatible value signatures.
 * @param options - Select metadata-backed Kotlin host classes.
 * @param options.kotlin - Reference the Kotlin value family in the same artifact.
 */
export const jvmGraphDescriptorSource = (model, { kotlin = false } = {}) => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const hostNamespace = model.namespace + (kotlin ? ".kotlin" : "");
	const descriptor = name => kotlin ? `_GraphTypes.${name}` : name;
	const className = kotlin ? "_KotlinGraphTypes" : "_GraphTypes";
	const typeNames = new Map(), erasedNames = new Map();
	const type = (id, erased = false) => {
		const cache = erased ? erasedNames : typeNames;
		if(cache.has(id)) return cache.get(id);
		const node = nodes.get(id), nominal = name => `${hostNamespace}.${name}`;
		const name = node.ref.kind === "named" ? nominal(node.publicType)
			: node.kind === "primitive" ? node.ref.name === "unit" ? `${model.namespace}.Unit` : node.publicType
				: node.element ? `${type(node.element, erased)}[]`
					: nominal({ option: "Option", result: "Result", tuple: "Pair" }[node.kind]) + (erased ? "" : `<${node.fields.map(field => boxes[type(field.type)] ?? type(field.type)).join(", ")}>`);
		cache.set(id, name); return name;
	};
	let budget = 16 * 1024 * 1024 - jvmGraphRuntime.length - jvmGraphScalars.length - model.layoutSource.length;
	for(const node of model.types)
	{
		budget -= 4096 + type(node.id).length * 8;
		for(const branch of node.cases) budget -= 1024 + branch.publicName.length * 4;
		for(const field of [...node.fields, ...node.cases.flatMap(branch => branch.fields)]) budget -= 256 + type(field.type).length * 4;
	}
	if(budget < 0) throw new TypeError("Invalid Java copied graph: generated converters exceed 16 MiB");
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
	const create = (name, fields) => {
		const qualified = `${hostNamespace}.${name}`, record = model.records.find(record => record.name === name);
		const arguments_ = fields.map((field, index) => `(${type(field.type)}) values[${index}]`);
		return record.builder
			? `var builder = ${qualified}.builder(); ${fields.map((field, index) => `builder.${field.publicName}(${arguments_[index]});`).join(" ")} return builder.build();`
			: `return new ${qualified}(${arguments_.join(", ")});`;
	};
	const helpers = [];
	const shapes = model.types.filter(node => node.kind !== "primitive" && !node.element).map(node => {
		let branch, get, make;
		if(node.kind === "variant")
		{
			branch = node.cases.map((value, index) => `if (value instanceof ${hostNamespace}.${value.publicName}) return ${index};`).join("\n            ") + '\n            throw new IllegalArgumentException("Unknown copied variant constructor");';
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
	const edge = (field, base = 0) => `new ${descriptor("Edge")}(${nodes.get(field.type).index}, ${base + field.offset}, ${field.storage === "pointer"})`;
	const descriptors = model.types.map(node => {
		const branches = node.kind === "variant" ? node.cases.map(branch => branch.fields.map(field => edge(field, node.payloadOffset)))
			: node.kind === "option" ? [[], [edge(node.fields[0])]] : node.kind === "result" ? [[edge(node.fields[1])], [edge(node.fields[0])]]
				: [node.fields.map(field => edge(field))];
		const kind = node.kind === "primitive" ? 0 : node.element ? 1 : node.kind === "variant" ? 2 : ["option", "result"].includes(node.kind) ? 3 : 4;
		for(const [index, fields] of branches.entries()) helpers.push(`    private static ${descriptor("Edge")}[] edges${node.index}_${index}() { return new ${descriptor("Edge")}[] { ${fields.join(", ")} }; }`);
		helpers.push(`    private static ${descriptor("Node")} node${node.index}() { return new ${descriptor("Node")}(${node.index}, ${kind}, ${node.kind === "primitive" ? jvmGraphScalarNames.indexOf(node.ref.name) : -1}, _GraphLayouts.${node.layoutName}, ${node.aggregate}, ${finite.has(node.id)}, ${(boxes[type(node.id, true)] ?? type(node.id, true))}.class, ${node.element ? nodes.get(node.element).index : -1}, new ${descriptor("Edge")}[][] { ${branches.map((_, index) => `edges${node.index}_${index}()`).join(", ")} }, ${kind > 1 ? `S${node.index}` : "null"}); }`);
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
        boolean inhabited, Class<?> hostType, int element, Edge[][] branches, Shape shape) {
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
	if(typesSource.length > 16 * 1024 * 1024) throw new TypeError("Invalid JVM copied graph: generated descriptors exceed 16 MiB");
	return typesSource;
};

/**
 * Keep public values free of native handles. A C cleanup shim uses the already
 * allocated result pointer, without allocating a Java release handle on failure.
 *
 * @param ir - Concrete copied Binding IR.
 */
export const generateCopiedJvmGraphConversions = ir => {
	const model = compileCopiedJvmGraphLayout(ir), typesSource = jvmGraphDescriptorSource(model);
	const prefix = `src/main/java/${model.namespace.replaceAll(".", "/")}`;
	const files = { ...model.files
		, [`${prefix}/_GraphLayouts.java`]: model.layoutSource
		, [`${prefix}/_GraphTypes.java`]: typesSource
		, [`${prefix}/_GraphRuntime.java`]: `package ${model.namespace};\n\n${jvmGraphRuntime}`
		, [`${prefix}/_GraphScalars.java`]: `package ${model.namespace};\n\n${jvmGraphScalars}`
		, [`${prefix}/LeanBridgeException.java`]: `package ${model.namespace};

public final class LeanBridgeException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final int status;
    public int status() { return status; }
    LeanBridgeException(int status, String message, Throwable cause) { super(message, cause); this.status = status; }
}
` };
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 16 * 1024 * 1024)
		throw new TypeError("Invalid Java copied graph: generated converters exceed 16 MiB");
	const nativeReleaseSource = `#include <stddef.h>
#include <stdint.h>
#include <string.h>
/* Root-only cleanup does not inspect tags, child pointers or Java objects. */
void ${model.layout.prefix}_jvm_graph_clear(void *value) {
  if (!value) return;
  void *owner; void (*release)(void *);
  _Static_assert(sizeof(owner) == 8 && sizeof(release) == 8, "64-bit graph ABI");
  memcpy(&owner, value, sizeof(owner));
  memcpy(&release, (uint8_t *)value + 8, sizeof(release));
  memset(value, 0, 16);
  if (owner && release) release(owner);
}
`;
	return { ...model
		, files, typesSource, nativeReleaseSource
		, nativeReleaseSymbol: `${model.layout.prefix}_jvm_graph_clear`
		, publicFiles: [...model.publicFiles, `${prefix}/LeanBridgeException.java`]
		, internalFiles: [...model.internalFiles, ...["_GraphLayouts", "_GraphTypes", "_GraphRuntime", "_GraphScalars"].map(name => `${prefix}/${name}.java`)] };
};
