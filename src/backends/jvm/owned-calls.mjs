/**
 * Typed Java and Kotlin ownership calls over authenticated native symbols.
 *
 * @file
 */
import { generateOwnedKotlinValues } from "./owned-kotlin.mjs";
import { ownedJvmCallables, ownedJvmCallFrame } from "./owned-callables.mjs";
import { ownedJvmTransfers } from "./owned-transfers.mjs";
import { ownedJvmAnchoredCall, ownedJvmOriginalTransfers } from "./owned-borrows.mjs";
import { ownedJvmOwnerName, ownedJvmReceiverOwner, ownedJvmReceiverMembers, ownedKotlinReceiverMembers } from "./owned-receivers.mjs";

const boxes = { boolean: "Boolean", byte: "Byte", short: "Short", int: "Integer", long: "Long", float: "Float", double: "Double" };
const quoted = name => name.split(".").map(part => `\`${part}\``).join(".");

/**
 * Loading is separate: the constructor receives verified symbols and a guard.
 * Both nominal families share one lifetime and native conversion implementation.
 *
 * @param ir - Compiler-authenticated ownership contract.
 * @param options - Explicit transport capabilities.
 */
export const generateOwnedJvmCalls = (ir, options = {}) => {
	const kotlin = generateOwnedKotlinValues(ir, options), model = { ...kotlin.model, kotlin }, { c } = model;
	const transfers = c.functions.some(fn => fn.transfers?.length);
	const anchored = c.functions.some(fn => fn.anchor !== undefined || fn.receiver === 0);
	const canonicalEquality = c.functions.some(fn => fn.anchor !== undefined);
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const cache = new Map();
	const type = (id, k) => {
		const key = id + ":" + k; if(cache.has(key)) return cache.get(key);
		const node = nodes.get(id), namespace = model.namespace + (k ? ".kotlin" : "");
		const value = node.identity && k ? `${model.namespace}._OwnedKotlin${node.publicType}`
			: node.name && node.kind !== "primitive" ? `${namespace}.${node.publicType}`
				: node.kind === "primitive" ? node.name === "unit" ? `${model.namespace}.Unit` : node.publicType
					: node.element ? `${type(node.element, k)}[]`
						: `${namespace}.${{ option: "Option", result: "Result", tuple: "Pair" }[node.kind]}<${node.fields.map(field => boxes[type(field.type, k)] ?? type(field.type, k)).join(", ")}>`;
		cache.set(key, value); return value;
	};
	const calls = [
		...model.functions.map((fn, index) => ({ ...fn, method: `call${index}`, operation: "export" }))
		, ...c.retains.map(fn => ({ ...fn, method: `retain${nodes.get(fn.id).index}`, operation: "retain", handle: true, ...anchored ? { rawResult: true } : {} }))
		, ...(c.copies ?? []).map(fn => ({ ...fn, method: `copy${nodes.get(fn.id).index}`, operation: "copy", ...anchored ? { rawResult: true } : {} }))
		, ...(c.callbacks ?? []).map(fn => ({ ...fn, method: `invoke${nodes.get(fn.id).index}`, operation: "invoke", handle: true }))
		, ...anchored ? [
			...(c.callbacks ?? []).map(fn => ({ ...fn, method: `invokeRaw${nodes.get(fn.id).index}`, operation: "invoke", handle: true, rawResult: true }))
			, ...[...c.retains, ...(c.copies ?? [])].filter(fn => nodes.get(fn.id).representation !== "copied")
				.map(fn => ({ ...fn, method: `copyWhole${nodes.get(fn.id).index}`, operation: "copy", wholeCopy: true }))
		] : []
	];
	const name = (fn, family) => fn.method.replace(/(\d+)$/u, family + "$1");
	const parameterType = (fn, i, k) => fn.handle && i === 0 ? "_OwnedRuntime.Handle"
		: c.hostArgument?.(fn, i) ? `${model.namespace}${k ? ".kotlin" : ""}.${nodes.get(fn.parameters[i]).delegateType}`
			: anchored && (fn.anchor === i || fn.transfers?.includes(i)) ? `${model.namespace}.Value<${type(fn.parameters[i], k)}>` : type(fn.parameters[i], k);
	const returnType = (fn, k) => anchored && !fn.rawResult && nodes.get(fn.result).representation !== "copied"
		? nodes.get(fn.result).ownerType ? `${model.namespace}.${ownedJvmOwnerName(nodes.get(fn.result), k)}`
			: `${model.namespace}.Value<${type(fn.result, k)}>` : type(fn.result, k);
	const callbacks = ownedJvmCallables(model, calls, type), methods = [];
	const signatures = calls.map(fn => {
		const arguments_ = fn.parameters.flatMap((id, i) => {
			const node = nodes.get(id);
			return [c.hostArgument?.(fn, i) || !node.leaf ? "ADDRESS" : node.valueLayout ?? `_OwnedLayouts.${node.layoutName}`
				, ...fn.transfers?.includes(i) ? ["ADDRESS"] : []
				, ...fn.anchor === i ? ["ADDRESS"] : []];
		});
		return ["ADDRESS", ...arguments_, "ADDRESS", "ADDRESS"];
	});
	for(const k of [false, true]) for(const [index, fn] of calls.entries())
	{
		if(anchored)
		{
			methods.push(ownedJvmAnchoredCall({ model, nodes, calls, type, parameterType, returnType, name }, fn, index, k));
			continue;
		}
		const family = k ? "Kotlin" : "Java", catalog = k ? "_KotlinOwnedTypes.CATALOG" : "_OwnedTypes.CATALOG";
		const factory = k ? "kotlinFactory" : "javaFactory";
		const parameters = fn.parameters.map(id => nodes.get(id)), result = nodes.get(fn.result);
		const moving = fn.transfers ?? [];
		const write = (node, i, scope, check) => fn.handle && i === 0
			? `MemorySegment.ofAddress(${scope}.root(arg${i}))`
			: c.hostArgument?.(fn, i) ? `host${family}${node.index}(arg${i}, ${scope}, ${check ? "null" : "frame"})`
				: `_OwnedConvert.write(${catalog}, ${node.index}, arg${i}, ${scope})`;
		const inputs = parameters.flatMap((node, i) => [
			...moving.length ? [`            inputs.moveGroup = ${moving.indexOf(i)};`] : []
			, `            var input${i} = ${write(node, i, "inputs", false)};`
		]).join("\n");
		const snapshots = moving.flatMap((i, group) => {
			const node = parameters[i], copy = [...c.retains, ...(c.copies ?? [])].find(item => item.id === node.id);
			if(!copy) throw new TypeError(`Missing owned JVM input snapshot for ${node.id}`);
			const symbol = calls.findIndex(call => call.cName === copy.cName);
			return [`            var moved${i} = inputs.allocate(${node.size}, ${node.alignment});`
				, `            var inputOwner${i} = moves.owners[${group}].output();`
				, `            _OwnedRuntime.check((int)symbols[${symbol}].invokeExact(MemorySegment.ofAddress(state.require()), ${node.aggregate ? `input${i}` : `input${i}.get(${node.valueLayout}, 0)`}, moved${i}, inputOwner${i}));`];
		}).join("\n");
		const arguments_ = [moving.length ? "session" : "MemorySegment.ofAddress(state.require())"
			, ...parameters.flatMap((node, i) => moving.includes(i)
				? [node.aggregate ? `moved${i}` : `moved${i}.get(${node.valueLayout}, 0)`, `inputOwner${i}`]
				: [fn.handle && i === 0 || c.hostArgument?.(fn, i) || node.aggregate ? `input${i}` : `input${i}.get(${node.valueLayout}, 0)`])
			, "output", moving.length ? "resultOwner" : "owner.output()"].join(", ");
		const invoke = moving.length ? `            var session = MemorySegment.ofAddress(state.require());
            var resultOwner = owner.output();
            moves.arm();
            int status;
            try { status = (int)symbols[${index}].invokeExact(${arguments_}); }
            finally { moves.finish(); }
            frame.finish(status);` : `            frame.finish((int)symbols[${index}].invokeExact(${arguments_}));`;
		methods.push(`    @SuppressWarnings("unchecked")
    ${type(result.id, k)} ${name(fn, family)}(${parameters.map((_, i) => `${parameterType(fn, i, k)} arg${i}`).join(", ")}) {
        var state = runtime.current(); ready();
        try (var check = new _OwnedConvert.Scope(state, true, null, null)) {
${parameters.map((node, i) => `            ${write(node, i, "check", true)};`).join("\n") || "            check.require();"}
        }
        try (var inputs = new _OwnedConvert.Scope(state, false, null, null);
             var frame = new _OwnedCallFrame(this, inputs);${moving.length ? `
             var moves = new _OwnedInputTransfers(state, ${moving.length}, inputs);` : ""}
             var owner = new _OwnedRuntime.Result(state);
             var outputs = new _OwnedConvert.Scope(state, false, ${factory}, owner::adopt, inputs.budget)) {
${moving.length ? "            inputs.moves = moves;\n" : ""}${inputs}
${moving.length ? `            inputs.moveGroup = -1;\n${snapshots}\n` : ""}\
            var output = outputs.allocate(${result.size}, ${result.alignment});
${invoke}
            ready();
            var result = (${type(result.id, k)})_OwnedConvert.read(${catalog}, ${result.index}, output, outputs);
            _OwnedRuntime.checkpoint(); ready(); outputs.complete(); owner.complete(); return result;
        } catch (_OwnedConvert.InvalidNative error) {
            retire();
            var failure = new LeanBridgeException(9, error.getMessage()); failure.initCause(error); throw failure;
        } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }`);
	}
	const identities = model.types.filter(node => node.identity);
	if(canonicalEquality) for(const [index, node] of identities.entries()) methods.push(`    boolean equal${node.index}(_OwnedRuntime.Handle left, _OwnedRuntime.Handle right) {
        var state = runtime.current(); ready();
        try (var inputs = new _OwnedConvert.Scope(state, false, null, null)) {
            var a = MemorySegment.ofAddress(inputs.root(left));
            var b = MemorySegment.ofAddress(inputs.root(right));
            var result = inputs.allocate(1, 1);
            _OwnedRuntime.check((int)equality[${index}].invokeExact(MemorySegment.ofAddress(state.require()), a, b, result));
            ready(); int value = Byte.toUnsignedInt(result.get(JAVA_BYTE, 0));
            if (value > 1) { retire(); throw new _OwnedConvert.InvalidNative("Invalid canonical equality result"); }
            return value != 0;
        } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }`);
	const factory = identities.map(node => {
		const fn = model.callbacks.find(fn => fn.id === node.id);
		return `            case ${node.index} -> new ${node.publicType}(${node.ownerType ? "this, " : ""}handle, this::retainJava${node.index}${fn ? `, (${fn.invokeParameters.map((_, i) => `arg${i}`).join(", ")}) -> invokeJava${node.index}(handle${fn.invokeParameters.map((_, i) => `, arg${i}`).join("")})` : ""}${canonicalEquality ? `, this::equal${node.index}` : ""}${anchored && fn ? `, (${fn.invokeParameters.map((_, i) => `arg${i}`).join(", ")}) -> invokeRawJava${node.index}(handle${fn.invokeParameters.map((_, i) => `, arg${i}`).join("")})` : ""});`;
	});
	const imports = `import java.lang.foreign.*;
import java.lang.invoke.MethodHandle;
import static java.lang.foreign.ValueLayout.*;
`;
	const source = `${imports}
final class _OwnedBindings {
    final _OwnedRuntime runtime;
    private final MethodHandle[] symbols;${canonicalEquality ? "\n    private final MethodHandle[] equality;" : ""}
    private final MethodHandle ready, retired;
    private final MemorySegment component = Arena.ofAuto().allocateFrom(${JSON.stringify(model.c.native.model.component.id)});
    private final _OwnedConvert.Factory javaFactory = this::factoryJava;
    private final _OwnedConvert.Factory kotlinFactory = new _KotlinOwnedFactories(this);
    _OwnedBindings(SymbolLookup symbols, Runnable before) {
        runtime = new _OwnedRuntime(symbols, before); runtime.ensureProcess();
        var linker = Linker.nativeLinker();
        this.symbols = new MethodHandle[] {
${calls.map((fn, index) => `            linker.downcallHandle(symbols.find(${JSON.stringify(fn.cName)}).orElseThrow(), FunctionDescriptor.of(JAVA_INT, ${signatures[index].join(", ")}))`).join(",\n")}
        };
${canonicalEquality ? `        equality = new MethodHandle[] {\n${identities.map(node => `            linker.downcallHandle(symbols.find(${JSON.stringify(node.cName + "_equal")}).orElseThrow(), FunctionDescriptor.of(JAVA_INT, ADDRESS, ADDRESS, ADDRESS, ADDRESS))`).join(",\n")}\n        };\n` : ""}\
        ready = linker.downcallHandle(symbols.find("lean_bridge_native_component_ready").orElseThrow(), FunctionDescriptor.of(JAVA_INT, ADDRESS));
        retired = linker.downcallHandle(symbols.find("lean_bridge_native_runtime_retire").orElseThrow(), FunctionDescriptor.ofVoid());
    }
    void ready() {
        runtime.ensureProcess();
        try { if ((int)ready.invokeExact(component) == 0) _OwnedRuntime.check(7); }
        catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private void retire() {
        runtime.ensureProcess();
        try { retired.invokeExact(); } catch (Throwable error) { throw _OwnedRuntime.rethrow(error); }
    }
    private Object factoryJava(int type, _OwnedRuntime.Handle handle) {
        return switch (type) {
${factory.join("\n")}
            default -> throw new _OwnedConvert.InvalidNative("Unknown native identity type");
        };
    }
${methods.join("\n")}
${callbacks.methods}
}
`;
	const kotlinFactory = `internal class _KotlinOwnedFactories(private val bindings: _OwnedBindings) : _OwnedConvert.Factory {
    @kotlin.jvm.JvmSynthetic override fun create(type: kotlin.Int, handle: _OwnedRuntime.Handle): kotlin.Any =
        when (type) {
${identities.map(node => {
	const fn = model.callbacks.find(fn => fn.id === node.id);
	return `            ${node.index} -> _OwnedKotlin${node.publicType}.create(${node.ownerType ? "bindings, " : ""}handle, { kept -> bindings.retainKotlin${node.index}(kept) }${fn
		? `, { ${fn.invokeParameters.map((_, i) => `arg${i}`).join(", ")}${fn.invokeParameters.length ? " -> " : ""}bindings.invokeKotlin${node.index}(handle${fn.invokeParameters.map((_, i) => `, arg${i}`).join("")});${fn.returnType === "void" ? " kotlin.Unit" : ""} }` : ""}${canonicalEquality ? `, { left, right -> bindings.equal${node.index}(left, right) }` : ""}${anchored && fn ? `, { ${fn.invokeParameters.map((_, i) => `arg${i}`).join(", ")}${fn.invokeParameters.length ? " -> " : ""}bindings.invokeRawKotlin${node.index}(handle${fn.invokeParameters.map((_, i) => `, arg${i}`).join("")});${fn.returnType === "void" ? " kotlin.Unit" : ""} }` : ""})`;
}).join("\n")}
            else -> throw _OwnedConvert.InvalidNative("Unknown native identity type")
        }
}
`;
	const files = { ...model.files, ...kotlin.files };
	const java = `src/main/java/${model.namespace.replaceAll(".", "/")}`, kt = `src/main/kotlin/${model.namespace.replaceAll(".", "/")}`;
	const publicFiles = [...model.publicFiles, ...kotlin.publicFiles], internalFiles = [...model.internalFiles, ...kotlin.internalFiles];
	const add = (path, source, public_ = false) => {
		if(Object.hasOwn(files, path)) throw new TypeError("Duplicate owned JVM source " + path);
		files[path] = source; (public_ ? publicFiles : internalFiles).push(path);
	};
	for(const node of model.types.filter(node => node.ownerType)) for(const k of [false, true])
	{
		const owner = ownedJvmOwnerName(node, k);
		add(`${java}/${owner}.java`, ownedJvmReceiverOwner({ ...model, type, parameterType, returnType }, node, k), true);
		if(k) add(`${kt}/kotlin/${node.ownerType}.kt`, `package ${quoted(kotlin.namespace)}\n\ntypealias ${node.ownerType} = ${quoted(model.namespace)}.${owner}\n`, true);
	}
	for(const node of identities.filter(node => node.ownerType)) for(const k of [false, true])
	{
		const path = k ? `${kt}/_OwnedKotlin${node.publicType}.kt` : `${java}/${node.publicType}.java`;
		const marker = "    /* CHECKED RECEIVER MEMBERS */\n";
		if(files[path].split(marker).length !== 2) throw new TypeError("Missing JVM raw receiver member insertion point");
		files[path] = files[path].replace(marker, () => k ? ownedKotlinReceiverMembers(model, node)
			: ownedJvmReceiverMembers({ ...model, type, parameterType, returnType }, node, false, true));
	}
	for(const [name, body] of Object.entries({ _OwnedBindings: source, _OwnedCallbacks: callbacks.wrappers, _OwnedCallFrame: ownedJvmCallFrame, OwnedCallbacks: callbacks.javaRecovery }))
		add(`${java}/${name}.java`, `package ${model.namespace};\n\n${body}`, name === "OwnedCallbacks");
	if(transfers) add(`${java}/_OwnedInputTransfers.java`, `package ${model.namespace};\n\n${anchored ? ownedJvmOriginalTransfers : ownedJvmTransfers}`);
	add(`${kt}/_KotlinOwnedFactories.kt`, `package ${quoted(model.namespace)}\n\n${kotlinFactory}`);
	add(`${kt}/_KotlinOwnedCallbackOps.kt`, `package ${quoted(model.namespace)}\n\n${callbacks.kotlinOps}`);
	add(`${kt}/kotlin/OwnedCallbacks.kt`, `package ${quoted(kotlin.namespace)}\n\n${callbacks.kotlinRecovery}`, true);
	for(const node of identities.filter(node => node.kind === "callback"))
	{
		const path = `${java}/${node.publicType}.java`, target = "return this::callFromHost;";
		if(files[path].split(target).length !== 2) throw new TypeError("Missing Java callback bridge");
		files[path] = files[path].replace(target, `return _OwnedCallbacks.nativeJava${node.index}(this${anchored ? ", this::callFromHost" : ""});`);
		const kotlinPath = `${kt}/_OwnedKotlin${node.publicType}.kt`;
		const expression = /(\n {4}fun asCallback\(\): [^\n]+ =\n)[\s\S]+?(?=\n {4}companion object)/u;
		if(!expression.test(files[kotlinPath])) throw new TypeError("Missing Kotlin callback bridge");
		files[kotlinPath] = files[kotlinPath].replace(expression, (body, signature) => signature + `        _OwnedCallbacks.nativeKotlin${node.index}(this${anchored ? ", " + body.slice(signature.length).trim() : ""})`);
	}
	if(Object.values(files).reduce((sum, source) => sum + source.length, 0) > 16 * 1024 * 1024)
		throw new TypeError("Owned JVM call sources exceed 16 MiB");
	const wholeCopies = [];
	if(anchored)
	{
		const claimed = new Set(model.functions.map(fn => fn.publicName));
		const add = (publicName, id, overload = false) => {
			if(!overload && claimed.has(publicName)) throw new TypeError(`JVM whole-value copy name collides: ${publicName}`);
			claimed.add(publicName);
			wholeCopies.push({ publicName, id, call: calls.find(fn => fn.wholeCopy && fn.id === id) });
		};
		for(const fn of model.functions)
		{
			const title = fn.publicName[0].toUpperCase() + fn.publicName.slice(1);
			if(nodes.get(fn.result).representation !== "copied") add(`copy${title}Result`, fn.result);
			for(const [i, id] of fn.parameters.entries())
				if(nodes.get(id).representation !== "copied" && !c.hostArgument?.(fn, i)) add(`copy${title}Arg${i}`, id);
		}
		const typed = calls.filter(fn => fn.wholeCopy);
		const erased = fn => type(fn.id, false).replace(/<.*>/u, "");
		if(claimed.has("copyValue")) throw new TypeError("JVM whole-value copy name collides: copyValue");
		for(const fn of typed) if(typed.filter(other => erased(other) === erased(fn)).length === 1) add("copyValue", fn.id, true);
	}
	return { ...model, files, publicFiles, internalFiles, calls, type, methodName: name, parameterType, returnType, wholeCopies };
};
