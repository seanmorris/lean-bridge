/**
 * Typed Java values and opaque closures for ownership-aware Lean contracts.
 *
 * @file
 */
import { compileOwnedJvmLayout } from "./owned-layout.mjs";
import { jvmGraphCompoundTypes, jvmGraphEquality, jvmGraphValueMethods } from "./copied-graph-equality.mjs";

const pascal = name => name.split(/[^A-Za-z0-9]+/u).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join("");
const camel = name => { const value = pascal(name); return value[0].toLowerCase() + value.slice(1); };
const suffix = name => name.match(/_+$/u)?.[0] ?? "";
const keywords = new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield".split(" "));
const reserved = new Set("Api Unit Option Result Pair Runtime NativeAssets GraphValues LeanBridgeException Object Class String StringBuilder System Record Throwable Error Exception RuntimeException IllegalArgumentException IllegalStateException NullPointerException IndexOutOfBoundsException Boolean Byte Short Integer Long Float Double Character Builder".split(" "));
const members = new Set("equals hashCode toString getClass clone finalize notify notifyAll wait bridgeField builder java close isClosed retain invoke asCallback callFromHost".split(" "));
const scalars = {
	unit: "Unit", bool: "boolean", char: "int"
	, uint8: "int", uint16: "int", uint32: "long", uint64: "java.math.BigInteger"
	, int8: "byte", int16: "short", int32: "int", int64: "long"
	, usize: "java.math.BigInteger", isize: "long"
	, float32: "float", float64: "double"
	, string: "String", bytes: "byte[]", nat: "java.math.BigInteger"
	, int: "java.math.BigInteger"
};
const boxes = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" };

/**
 * Preserve named records, variants, nested presence and independent identities.
 * Host callbacks receive borrowed closure wrappers; invoking a returned closure
 * accepts host callbacks. The asCallback method bridges those two directions.
 *
 * @param ir - Concrete compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedJvmValues = (ir, options = {}) => {
	const layout = compileOwnedJvmLayout(ir, options), c = layout.c;
	const fail = message => { throw new TypeError("Invalid owned JVM values: " + message); };
	if(keywords.has(c.prefix)) fail("Java package name is a reserved word");
	const occupied = new Set(reserved), names = new Map();
	const claim = name => {
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || occupied.has(name)) fail("reserved or duplicate name: " + name);
		occupied.add(name); return name;
	};
	for(const node of layout.types) if(node.kind !== "primitive" && node.name)
		names.set(node.id, claim(node.kind === "callback"
			? pascal(node.cName.slice(c.prefix.length + 1, -2)) + "Closure" : pascal(node.name)));
	const delegates = new Map(layout.types.filter(node => node.kind === "callback")
		.map(node => [node.id, claim(names.get(node.id) + "Callback")]));
	const table = new Map(layout.types.map(node => [node.id, node])), cache = new Map();
	let structuralText = 0;
	const type = id => {
		const pending = [{ id, ready: false }];
		while(pending.length)
		{
			const entry = pending.pop();
			if(cache.has(entry.id)) continue;
			const node = table.get(entry.id);
			if(names.has(entry.id) || node.kind === "primitive")
			{ cache.set(entry.id, { name: names.get(entry.id) ?? scalars[node.name], depth: 0 }); continue; }
			const children = node.element ? [node.element] : node.fields.map(field => field.type);
			if(!entry.ready)
			{
				pending.push({ id: entry.id, ready: true });
				for(const child of children) if(!cache.has(child)) pending.push({ id: child, ready: false });
				continue;
			}
			const args = children.map(child => cache.get(child));
			const depth = 1 + Math.max(...args.map(child => child.depth));
			if(depth > 32 || args.reduce((sum, child) => sum + child.name.length, 0) > 65500)
				fail("expanded Java structural type exceeds 32 levels or 65536 characters; introduce a named record or variant");
			const name = node.element ? `${args[0].name}[]`
				: `${{ option: "Option", result: "Result", tuple: "Pair" }[node.kind]}<${args.map(child => boxes[child.name] ?? child.name).join(", ")}>`;
			structuralText += name.length;
			if(structuralText > 4 * 1024 * 1024) fail("expanded Java type catalog exceeds 4 MiB");
			cache.set(entry.id, { name, depth });
		}
		return cache.get(id).name;
	};
	const fields = values => {
		const seen = new Set(members);
		return values.map(field => {
			// Anonymous product positions are ABI fields, not public identifiers.
			let publicName = /^\d+$/u.test(field.sourceName) ? "field" + field.sourceName : camel(field.sourceName) + suffix(field.sourceName);
			if(keywords.has(publicName)) publicName += "_";
			if(seen.has(publicName)) fail("duplicate or reserved field: " + publicName);
			seen.add(publicName); return { ...field, publicName, publicType: type(field.type) };
		});
	};
	const types = layout.types.map(node => ({ ...node, publicType: type(node.id)
		, delegateType: delegates.get(node.id) ?? null
		, fields: fields(node.fields)
		, cases: node.cases.map(branch => ({ ...branch
			, publicName: claim(type(node.id) + pascal(branch.sourceName) + suffix(branch.sourceName))
			, fields: fields(branch.fields) })) }));
	const methods = new Set(members);
	const functions = c.functions.map(fn => {
		const publicName = camel(fn.cName.slice(c.prefix.length + 1));
		if(methods.has(publicName) || keywords.has(publicName)) fail("reserved or duplicate function: " + publicName);
		methods.add(publicName); return { ...fn, publicName };
	});
	const definitions = new Map(ir.types.map(node => [node.id, node]));
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
		? definitions.get(ref.id).name : `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const aliases = c.native.aliases.map(alias => ({ ...alias
		, name: definitions.get(alias.id).name, managedType: type(alias.target)
		, contractType: contract(definitions.get(alias.id).target) }));
	const callbacks = c.callbacks.map(fn => ({ ...fn
		, publicType: type(fn.id), delegateType: delegates.get(fn.id)
		, returnType: table.get(fn.result).name === "unit" ? "void" : type(fn.result)
		, hostParameters: fn.parameters.slice(1).map(type)
		, invokeParameters: fn.parameters.slice(1).map(id => delegates.get(id) ?? type(id)) }));
	const records = types.flatMap(node => node.kind === "record" ? [{ name: node.publicType, fields: node.fields, parent: null }]
		: node.kind === "variant" ? node.cases.map(branch => ({ name: branch.publicName, fields: branch.fields, parent: node.publicType })) : []);
	for(const record of records) record.builder = record.fields.reduce((sum, field) => sum + (["long", "double"].includes(field.publicType) ? 2 : 1), 0) > 254;
	const estimated = records.reduce((sum, record) => sum + 2048 + record.name.length * 12
		+ record.fields.reduce((total, field) => total + 512 + field.publicType.length * 8 + field.publicName.length * 10, 0), 0)
		+ callbacks.reduce((sum, fn) => sum + 4096 + fn.returnType.length * 16
			+ [...fn.hostParameters, ...fn.invokeParameters].reduce((total, name) => total + name.length * 16, 0), 0);
	if(estimated > 4 * 1024 * 1024) fail("generated Java declarations exceed 4 MiB");
	const namespace = layout.namespace, prefix = `src/main/java/${namespace.replaceAll(".", "/")}`;
	const files = {}, add = (name, source) => { files[`${prefix}/${name}.java`] = `package ${namespace};\n\n${source}`; };
	add("Unit", "public enum Unit { INSTANCE }\n");
	for(const [name, source] of Object.entries(jvmGraphCompoundTypes)) add(name, source);
	for(const node of types.filter(node => node.kind === "variant"))
		add(node.publicType, `public sealed interface ${node.publicType} permits ${node.cases.map(branch => branch.publicName).join(", ")} { }\n`);
	const access = record => record.fields.length ? `    Object bridgeField(int index) {
        return switch (index) {
${record.fields.map((field, index) => `            case ${index} -> ${field.publicName};`).join("\n")}
            default -> throw new IndexOutOfBoundsException(index);
        };
    }
` : "";
	for(const record of records)
	{
		const { name, fields, parent, builder } = record, implements_ = parent ? ` implements ${parent}` : "";
		const checked = field => !Object.hasOwn(boxes, field.publicType);
		const source = !builder ? `public record ${name}(${fields.map(field => `${field.publicType} ${field.publicName}`).join(", ")})${implements_} {
${fields.some(checked) ? `    public ${name} {\n${fields.filter(checked).map(field => `        java.util.Objects.requireNonNull(${field.publicName});`).join("\n")}\n    }\n` : ""}${access(record)}${jvmGraphValueMethods}
}
` : `public final class ${name}${implements_} {
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
            if (assigned.cardinality() != ${fields.length}) throw new IllegalStateException("Every field must be assigned");
            return new ${name}(this);
        }
    }
${access(record)}${jvmGraphValueMethods}
}
`;
		add(name, source);
	}
	for(const node of types.filter(node => node.identity))
	{
		const name = node.publicType, fn = callbacks.find(fn => fn.id === node.id);
		const parameters = fn?.invokeParameters.map((type, index) => `${type} arg${index}`).join(", ");
		add(name, `/** A thread-bound Lean ${fn ? "closure" : "resource"}. retain creates an independent owner. */
public final class ${name} implements AutoCloseable, _OwnedValue {
    final _OwnedRuntime.Handle handle;
    private final java.util.function.Function<_OwnedRuntime.Handle, ${name}> retain;
${fn ? `    @FunctionalInterface interface Invocation { ${fn.returnType} invoke(${parameters}); }
    private final Invocation invocation;
` : ""}    ${name}(_OwnedRuntime.Handle handle, java.util.function.Function<_OwnedRuntime.Handle, ${name}> retain${fn ? ", Invocation invocation" : ""}) {
        this.handle = java.util.Objects.requireNonNull(handle);
        this.retain = java.util.Objects.requireNonNull(retain);${fn ? "\n        this.invocation = java.util.Objects.requireNonNull(invocation);" : ""}
    }
    public boolean isClosed() { return handle.isClosed(); }
    @Override public void close() { handle.close(); }
    public ${name} retain() {
        try { return retain.apply(handle); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
${fn ? `    public ${fn.returnType} invoke(${parameters}) {
        try { ${fn.returnType === "void" ? "" : "return "}invocation.invoke(${fn.invokeParameters.map((_, i) => `arg${i}`).join(", ")}); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
    private ${fn.returnType} callFromHost(${fn.hostParameters.map((type, i) => `${type} arg${i}`).join(", ")}) {
        ${fn.returnType === "void" ? "" : "return "}invoke(${fn.parameters.slice(1).map((id, i) => `arg${i}${delegates.has(id) ? ".asCallback()" : ""}`).join(", ")});
    }
    public ${fn.delegateType} asCallback() { return this::callFromHost; }
` : ""}}
`);
	}
	for(const fn of callbacks) add(fn.delegateType, `/** Synchronous host callback. Borrowed arguments expire when it returns. */
@FunctionalInterface
public interface ${fn.delegateType} {
    ${fn.returnType} invoke(${fn.hostParameters.map((type, index) => `${type} arg${index}`).join(", ")});
}
`);
	const publicFiles = Object.keys(files);
	add("_OwnedValue", "interface _OwnedValue { }\n");
	const equality = jvmGraphEquality(records, namespace).replace("if (value == null || value instanceof Unit", "if (value instanceof _OwnedValue || value == null || value instanceof Unit");
	add("GraphValues", equality);
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 4 * 1024 * 1024) fail("generated Java declarations exceed 4 MiB");
	return { ...layout, types, functions, callbacks, aliases, records, files
		, publicFiles
		, internalFiles: [`${prefix}/GraphValues.java`, `${prefix}/_OwnedValue.java`] };
};
