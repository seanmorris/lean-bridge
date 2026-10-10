/**
 * Finite Java declarations for recursive copied values. Converters and installed
 * Maven acceptance are separate from these value-only declarations.
 *
 * @file
 */
import { compileCopiedCGraphLayout } from "../c/copied-graph-layout.mjs";
import { jvmGraphCompoundTypes, jvmGraphEquality, jvmGraphValueMethods } from "./copied-graph-equality.mjs";

const pascal = name => name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
const camel = name => { const value = pascal(name); return value[0].toLowerCase() + value.slice(1); };
const suffix = name => name.match(/_+$/)?.[0] ?? "";
const keywords = new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield".split(" "));
const reserved = new Set("Api Unit Option Result Pair Runtime NativeAssets Scope GraphValues GraphScope GraphBudget GraphOwner GraphOutput GraphLifecycle LeanBridgeException Object Class String StringBuilder System Record Throwable Error Exception RuntimeException IllegalArgumentException IllegalStateException NullPointerException IndexOutOfBoundsException Boolean Byte Short Integer Long Float Double Character Builder".split(" "));
const members = new Set("equals hashCode toString getClass clone finalize notify notifyAll wait bridgeField builder java".split(" "));
const scalars = { unit: "Unit", bool: "boolean", char: "int", uint8: "int", uint16: "int", uint32: "long", uint64: "java.math.BigInteger", int8: "byte", int16: "short", int32: "int", int64: "long", usize: "java.math.BigInteger", isize: "long", float32: "float", float64: "double", string: "String", bytes: "byte[]", nat: "java.math.BigInteger", int: "java.math.BigInteger" };
const boxes = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" };

/**
 * Resolve aliases without unfolding nominal recursion. Structural Java type
 * spellings have independent depth and byte bounds before source allocation.
 *
 * @param ir - Compiler-authorized, purely copied Binding IR.
 */
export const generateCopiedJvmGraphValues = ir => {
	const layout = compileCopiedCGraphLayout(ir);
	const fail = message => { throw new TypeError(`Invalid Java copied graph: ${message}`); };
	if(keywords.has(layout.prefix)) fail("Java package name is a reserved word");
	const occupied = new Set(reserved), names = new Map();
	const claim = name => {
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || occupied.has(name)) fail(`reserved or duplicate name: ${name}`);
		occupied.add(name); return name;
	};
	for(const definition of [...ir.types].sort((a, b) => a.id.localeCompare(b.id)))
		if(definition.kind !== "alias") names.set(definition.id, claim(pascal(definition.name)));
	const nodes = new Map(layout.nodes.map(node => [node.id, node])), types = new Map();
	let structuralText = 0;
	const type = id => {
		const pending = [{ id, ready: false }];
		while(pending.length)
		{
			const entry = pending.pop();
			if(types.has(entry.id)) continue;
			const node = nodes.get(entry.id);
			if(node.ref.kind === "named")
			{ types.set(entry.id, { name: names.get(node.ref.id), depth: 0 }); continue; }
			if(node.kind === "primitive")
			{ types.set(entry.id, { name: scalars[node.ref.name], depth: 0 }); continue; }
			const children = node.element ? [node.element] : node.fields.map(field => field.type);
			if(!entry.ready)
			{
				pending.push({ id: entry.id, ready: true });
				for(const child of children) if(!types.has(child)) pending.push({ id: child, ready: false });
				continue;
			}
			const values = children.map(child => types.get(child)), depth = 1 + Math.max(...values.map(child => child.depth));
			if(depth > 32 || values.reduce((sum, child) => sum + child.name.length, 0) > 65500)
				fail("expanded Java structural type exceeds 32 container levels or 65536 characters; introduce a named record or variant");
			const name = node.element ? `${values[0].name}[]`
				: `${{ option: "Option", result: "Result", tuple: "Pair" }[node.kind]}<${values.map(child => boxes[child.name] ?? child.name).join(", ")}>`;
			structuralText += name.length;
			if(structuralText > 4 * 1024 * 1024) fail("expanded Java type catalog exceeds 4 MiB");
			types.set(entry.id, { name, depth });
		}
		return types.get(id).name;
	};
	const fields = values => {
		const seen = new Set(members);
		return values.map(field => {
			let publicName = camel(field.sourceName) + suffix(field.sourceName);
			if(keywords.has(publicName)) publicName += "_";
			if(seen.has(publicName)) fail(`duplicate or reserved field: ${publicName}`);
			seen.add(publicName); return { ...field, publicName, publicType: type(field.type) };
		});
	};
	const models = layout.nodes.map((node, index) => ({ ...node
		, index
		, publicType: type(node.id)
		, fields: fields(node.fields)
		, cases: node.cases.map(branch => ({ ...branch, publicName: claim(type(node.id) + pascal(branch.sourceName) + suffix(branch.sourceName)), fields: fields(branch.fields) })) }));
	const functionNames = new Set(members);
	const functions = layout.roots.map(root => {
		const publicName = camel(root.name.slice(layout.prefix.length + 1));
		if(functionNames.has(publicName) || keywords.has(publicName)) fail(`duplicate or reserved function: ${publicName}`);
		functionNames.add(publicName); return { ...root, publicName };
	});
	const definitions = new Map(ir.types.map(definition => [definition.id, definition]));
	const contractType = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named" ? definitions.get(ref.id).name
		: `${ref.constructor}<${ref.arguments.map(contractType).join(", ")}>`;
	const aliases = layout.aliases.map(alias => {
		const definition = definitions.get(alias.id);
		return { id: alias.id, name: definition.name, target: structuredClone(definition.target), contractType: contractType(definition.target), managedType: type(alias.target) };
	});
	const records = models.flatMap(node => node.kind === "record" ? [{ name: node.publicType, fields: node.fields, parent: null }]
		: node.kind === "variant" ? node.cases.map(branch => ({ name: branch.publicName, fields: branch.fields, parent: node.publicType })) : []);
	// JVM methods have at most 255 argument slots, including the receiver.
	// Wider constructors use a typed builder without dropping any source fields.
	for(const record of records) record.builder = record.fields.reduce((sum, field) => sum + (["long", "double"].includes(field.publicType) ? 2 : 1), 0) > 254;
	const estimated = records.reduce((sum, record) => sum + 2048 + record.name.length * 12
		+ record.fields.reduce((total, field) => total + 512 + field.publicType.length * 8 + field.publicName.length * 10, 0), 0);
	if(estimated > 4 * 1024 * 1024) fail("generated Java declarations exceed 4 MiB");
	const namespace = `org.leanbridge.${layout.prefix}`, prefix = `src/main/java/${namespace.replaceAll(".", "/")}`;
	const files = {}, add = (name, source) => { files[`${prefix}/${name}.java`] = `package ${namespace};\n\n${source}`; };
	add("Unit", "public enum Unit { INSTANCE }\n");
	for(const [name, source] of Object.entries(jvmGraphCompoundTypes)) add(name, source);
	for(const node of models.filter(node => node.kind === "variant"))
		add(node.publicType, `public sealed interface ${node.publicType} permits ${node.cases.map(branch => branch.publicName).join(", ")} { }\n`);
	const access = record => record.fields.length ? `    Object bridgeField(int index) {
        return switch (index) {
${record.fields.map((field, index) => `            case ${index} -> ${field.publicName};`).join("\n")}
            default -> throw new IndexOutOfBoundsException(index);
        };
    }\n` : "";
	for(const record of records)
	{
		const { name, fields, parent, builder } = record, implements_ = parent ? ` implements ${parent}` : "";
		const checked = field => !Object.hasOwn(boxes, field.publicType);
		const source = !builder ? `public record ${name}(${fields.map(field => `${field.publicType} ${field.publicName}`).join(", ")})${implements_} {
${fields.some(checked) ? `    public ${name} {\n${fields.filter(checked).map(field => `        java.util.Objects.requireNonNull(${field.publicName});`).join("\n")}\n    }\n` : ""}${access(record)}${jvmGraphValueMethods}
}
` : `/** Immutable copied value. A typed builder accommodates the JVM argument-slot limit. */
public final class ${name}${implements_} {
${fields.map(field => `    private final ${field.publicType} ${field.publicName};`).join("\n")}
    private ${name}(Builder source) {
${fields.map((field, index) => `        this.${field.publicName} = source.field${index};`).join("\n")}
    }
${fields.map(field => `    public ${field.publicType} ${field.publicName}() { return ${field.publicName}; }`).join("\n")}
    public static Builder builder() { return new Builder(); }
    public static final class Builder {
        private final java.util.BitSet assigned = new java.util.BitSet(${fields.length});
${fields.map((field, index) => `        private ${field.publicType} field${index};`).join("\n")}
        private Builder() { }
${fields.map((field, index) => `        public Builder ${field.publicName}(${field.publicType} value) {
            field${index} = ${checked(field) ? "java.util.Objects.requireNonNull(value)" : "value"}; assigned.set(${index}); return this;
        }`).join("\n")}
        public ${name} build() {
            if (assigned.cardinality() != ${fields.length}) throw new IllegalStateException("Every copied field must be assigned");
            return new ${name}(this);
        }
    }
${access(record)}${jvmGraphValueMethods}
}
`;
		add(name, source);
	}
	const publicFiles = Object.keys(files);
	add("GraphValues", jvmGraphEquality(records, namespace));
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 4 * 1024 * 1024) fail("generated Java declarations exceed 4 MiB");
	return { layout, namespace, files, publicFiles, internalFiles: [`${prefix}/GraphValues.java`], types: models, functions, aliases, records };
};
