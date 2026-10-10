/**
 * Typed Java values and opaque closures for ownership-aware Lean contracts.
 *
 * @file
 */
import { compileOwnedJvmLayout } from "./owned-layout.mjs";
import { jvmGraphCompoundTypes, jvmGraphEquality, jvmGraphValueMethods } from "./copied-graph-equality.mjs";
import { ownedJvmWholeValue } from "./owned-borrows.mjs";
import { ownedJvmCallbackArguments, ownedJvmCallbackResult } from "./owned-callback-arguments.mjs";

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
	const anchors = [...c.functions, ...c.callbacks].some(fn => fn.anchor !== undefined);
	const callbackReplies = Boolean(c.hostArgument) && c.callbacks.some(fn => fn.anchor !== undefined);
	const receivers = c.functions.some(fn => fn.receiver === 0);
	const wholeOwners = anchors || receivers;
	const fail = message => { throw new TypeError("Invalid owned JVM values: " + message); };
	if(keywords.has(c.prefix)) fail("Java package name is a reserved word");
	const occupied = new Set(reserved), names = new Map();
	if(wholeOwners) occupied.add("Value");
	if(callbackReplies) occupied.add("CallbackResult");
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
		, ...receivers && ["resource", "record", "variant"].includes(node.kind) && node.representation !== "copied"
			? { ownerType: claim(type(node.id) + "Value") } : {}
		, delegateType: delegates.get(node.id) ?? null
		, fields: fields(node.fields)
		, cases: node.cases.map(branch => ({ ...branch
			, publicName: claim(type(node.id) + pascal(branch.sourceName) + suffix(branch.sourceName))
			, fields: fields(branch.fields) })) }));
	const methods = new Set(members);
	const functions = c.functions.map(fn => {
		const publicName = camel(fn.cName.slice(c.prefix.length + 1));
		if(methods.has(publicName) || keywords.has(publicName)) fail("reserved or duplicate function: " + publicName);
		methods.add(publicName); return { ...fn, publicName
			, ...fn.receiver === 0 ? { receiverKind: ir.declarations.find(item => item.id === fn.id).kind } : {} };
	});
	const definitions = new Map(ir.types.map(node => [node.id, node]));
	const contract = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named"
		? definitions.get(ref.id).name : `${ref.constructor}<${ref.arguments.map(contract).join(", ")}>`;
	const aliases = c.native.aliases.map(alias => ({ ...alias
		, name: definitions.get(alias.id).name, managedType: type(alias.target)
		, contractType: contract(definitions.get(alias.id).target) }));
	const callbacks = (c.callbacks ?? []).map(fn => {
		const invocations = ownedJvmCallbackArguments(c, fn).map((variant, index) => ({
			fn: variant, suffix: index ? `Native${index}` : ""
			, parameters: fn.parameters.slice(1).map((id, position) => c.hostArgument?.(fn, position + 1) && !variant.nativeCallbacks?.includes(position + 1)
				? delegates.get(id) : fn.anchor === position + 1 ? `Value<${type(id)}>` : type(id))
		}));
		const result = table.get(fn.result), rawResult = result.name === "unit" ? "void" : type(fn.result);
		return { ...fn
			, publicType: type(fn.id), delegateType: delegates.get(fn.id)
			, returnType: rawResult
			, hostReturnType: callbackReplies && fn.anchor !== undefined ? `CallbackResult<${boxes[type(fn.result)] ?? type(fn.result)}>` : rawResult
			, invokeReturnType: wholeOwners && result.representation !== "copied"
				? types.find(node => node.id === fn.result).ownerType ?? `Value<${type(fn.result)}>` : rawResult
			, hostParameters: fn.parameters.slice(1).map(type)
			, invokeParameters: invocations[0].parameters, invocations };
	});
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
	if(wholeOwners) add("Value", receivers ? ownedJvmWholeValue.replace("public final class Value<T>", "public class Value<T>") : ownedJvmWholeValue);
	if(callbackReplies) add("CallbackResult", ownedJvmCallbackResult);
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
		const returnType = fn?.invokeReturnType;
		add(name, `/** A thread-bound Lean ${fn ? "closure" : "resource"}. retain creates an independent owner. */
public final class ${name} implements AutoCloseable, _OwnedValue {
    final _OwnedRuntime.Handle handle;
${node.ownerType ? "    private final _OwnedBindings bindings;\n" : ""}\
    private final java.util.function.Function<_OwnedRuntime.Handle, ${name}> retain;${anchors ? "\n    private final java.util.function.BiPredicate<_OwnedRuntime.Handle, _OwnedRuntime.Handle> equal;" : ""}
${fn ? `${fn.invocations.map(invocation => `    @FunctionalInterface interface Invocation${invocation.suffix} { ${returnType} invoke(${invocation.parameters.map((type, index) => `${type} arg${index}`).join(", ")}); }\n    private final Invocation${invocation.suffix} invocation${invocation.suffix};\n`).join("")}${wholeOwners && fn.anchor === undefined ? `    @FunctionalInterface interface RawInvocation { ${fn.returnType} invoke(${fn.invocations.at(-1).parameters.map((type, index) => `${type} arg${index}`).join(", ")}); }\n    private final RawInvocation rawInvocation;\n` : ""}\
` : ""}    ${name}(${node.ownerType ? "_OwnedBindings bindings, " : ""}_OwnedRuntime.Handle handle, java.util.function.Function<_OwnedRuntime.Handle, ${name}> retain${fn ? fn.invocations.map(invocation => `, Invocation${invocation.suffix} invocation${invocation.suffix}`).join("") : ""}${anchors ? ", java.util.function.BiPredicate<_OwnedRuntime.Handle, _OwnedRuntime.Handle> equal" : ""}${wholeOwners && fn && fn.anchor === undefined ? ", RawInvocation rawInvocation" : ""}) {
${node.ownerType ? "        this.bindings = java.util.Objects.requireNonNull(bindings);\n" : ""}\
        this.handle = java.util.Objects.requireNonNull(handle);
        this.retain = java.util.Objects.requireNonNull(retain);${fn ? fn.invocations.map(invocation => `\n        this.invocation${invocation.suffix} = java.util.Objects.requireNonNull(invocation${invocation.suffix});`).join("") : ""}${anchors ? "\n        this.equal = java.util.Objects.requireNonNull(equal);" : ""}${wholeOwners && fn && fn.anchor === undefined ? "\n        this.rawInvocation = java.util.Objects.requireNonNull(rawInvocation);" : ""}
    }
    public boolean isClosed() { return handle.isClosed(); }
    @Override public void close() { handle.close(); }
    public ${name} retain() {
        try { return retain.apply(handle); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
${anchors ? `    public boolean sameIdentity(${name} other) {
        java.util.Objects.requireNonNull(other);
        try { return equal.test(handle, other.handle); }
        finally { java.lang.ref.Reference.reachabilityFence(this); java.lang.ref.Reference.reachabilityFence(other); }
    }
    @Override public boolean equals(Object other) {
        try { handle.raw(handle.lease.state); return other instanceof ${name} value && sameIdentity(value); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }
    @Override public int hashCode() { throw new UnsupportedOperationException("Lean resources cannot be dictionary keys"); }
    @Override public String toString() { return "${name}[" + (isClosed() ? "closed" : "live") + "]"; }
` : ""}\
${fn ? `${fn.invocations.map(invocation => `    public ${returnType} invoke(${invocation.parameters.map((type, index) => `${type} arg${index}`).join(", ")}) {
        try { ${returnType === "void" ? "" : "return "}invocation${invocation.suffix}.invoke(${invocation.parameters.map((_, i) => `arg${i}`).join(", ")}); }
        finally { java.lang.ref.Reference.reachabilityFence(this); }
    }`).join("\n")}
${fn.anchor === undefined ? `\
    private ${fn.returnType} callFromHost(${fn.hostParameters.map((type, i) => `${type} arg${i}`).join(", ")}) {
        ${fn.returnType === "void" ? "" : "return "}${wholeOwners ? "rawInvocation.invoke" : "invoke"}(${fn.parameters.slice(1).map((_, i) => `arg${i}${c.hostArgument?.(fn, i + 1) && !fn.invocations.at(-1).fn.nativeCallbacks?.includes(i + 1) ? ".asCallback()" : ""}`).join(", ")});
    }
    public ${fn.delegateType} asCallback() { return this::callFromHost; }
` : `    public ${name} asCallback() { return this; }\n`}\
` : ""}${node.ownerType ? "    /* CHECKED RECEIVER MEMBERS */\n" : ""}}
`);
	}
	for(const fn of callbacks) add(fn.delegateType, `/** Synchronous host callback. Borrowed arguments expire when it returns. */
@FunctionalInterface
public interface ${fn.delegateType} {
    ${fn.hostReturnType} invoke(${fn.hostParameters.map((type, index) => `${type} arg${index}`).join(", ")});
}
`);
	const publicFiles = Object.keys(files);
	add("_OwnedValue", "interface _OwnedValue { }\n");
	let equality = jvmGraphEquality(records, namespace).replace("if (value == null || value instanceof Unit", "if (value instanceof _OwnedValue || value == null || value instanceof Unit");
	if(anchors) equality = equality.replace("else equal &= java.util.Objects.equals(x.value(), y.value());", "else if (x.value() instanceof _OwnedValue resource) equal &= resource.equals(y.value());\n            else equal &= java.util.Objects.equals(x.value(), y.value());");
	add("GraphValues", equality);
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 4 * 1024 * 1024) fail("generated Java declarations exceed 4 MiB");
	return { ...layout, types, functions, callbacks, aliases, records, files
		, wholeOwners
		, publicFiles
		, internalFiles: [`${prefix}/GraphValues.java`, `${prefix}/_OwnedValue.java`] };
};
