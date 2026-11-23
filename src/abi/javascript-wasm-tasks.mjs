/** @file Reconstruct copied pthread task methods and their two error channels from public Binding IR. */
import {canonicalizeJsonValue,hashBindingIr} from "../binding-ir/canonical.mjs";
import {componentScalarTypes} from "./component-scalars.mjs";

const shape = (t,level=0) => {
	if(t?.kind === "primitive" && componentScalarTypes.includes(t.name)) return t.name;
	if(level < 32 && t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2)
		return t.arguments.map(v => shape(v,level+1));
	throw new TypeError("Threaded Wasm requires copied primitives or returned Except values");
};
const depth = t => Array.isArray(t) ? 1 + Math.max(...t.map(depth)) : 0;
const same = (a,b) => canonicalizeJsonValue(a) === canonicalizeJsonValue(b);

/**
 * Derive the entire callable layout independently of the C generator.
 * In particular a Task that delivers an Except does not acquire a terminal error.
 *
 * @param ir - Validated, compiler-checked public binding contract.
 * @param componentIdentity - Digest of the compiled inputs and adapter.
 */
export const javaScriptTaskAbi = (ir,componentIdentity) => {
	const bindingIrSha256 = hashBindingIr(ir);
	if(!/^[0-9a-f]{64}$(?![\s\S])/u.test(componentIdentity) || ir.capabilities.length || ir.types.length)
		throw new TypeError("Expected a copied in-memory Wasm task component");
	const methods = ir.declarations.map(d => {
		const declaration = d.source?.declaration, ext = d.source?.extensions ?? {};
		const effect = ext["lean-lang.org/effect"], task = ext["lean-lang.org/delivery"], protocol = ext["lean-bridge.dev/pull-protocol"];
		const terminal = ext["lean-bridge.dev/task-failure"], delivery = task ? "task" : protocol ? "async-iterator" : null;
		const mode = task ? "promise" : protocol ? "async-iterator" : "value";
		if(!declaration || d.source.producer !== "lean" || !["IO","EIO","BaseIO","pure"].includes(effect) || d.kind !== "function" || d.owner !== null
			|| d.receiver !== null || d.typeParameters.length || d.parameters.some(p => p.optional || p.default !== null || p.mutability !== "immutable")
			|| d.capabilities.length || d.resultMode !== mode || d.failure.unexpected !== "poison-runtime"
			|| (task !== undefined && (task !== "Task" || protocol)) || (protocol !== undefined && (!protocol || protocol.open !== declaration
				|| ![protocol.next,protocol.close].every(n => typeof n === "string" && n.length)
				|| new Set([protocol.open,protocol.next,protocol.close]).size !== 3))
			|| (terminal !== undefined && (terminal !== "IO.Error" || !task)) || ext["lean-bridge.dev/host-members"]?.length
			|| ext["lean-bridge.dev/native-effects-v1"] || ext["lean-bridge.dev/host-imports-sha256"]
			|| [...d.parameters,d.result].some(x => x.ownership !== "copy" || x.lifetime !== null))
			throw new TypeError("Inconsistent copied Wasm task declaration: " + d.id);
		const startId = effect === "IO" ? "error:IO.Error" : effect === "EIO" ? "error:EIO."+declaration : null;
		const step = "error:AsyncStep."+declaration;
		const terminalId = terminal ? "error:TaskIO.Error" : protocol && d.failure.errors.includes(step) ? step : null;
		if(!same([...d.failure.errors].sort(),[startId,terminalId].filter(Boolean).sort()))
			throw new TypeError("Inconsistent Wasm task failure channels: " + d.id);
		const errorShape = id => {
			if(!id) return null;
			const error = ir.errors.find(x => x.id === id);
			if(!error) throw new TypeError("Missing declared error: "+id);
			if(["error:IO.Error","error:TaskIO.Error"].includes(id))
			{
				if(error.payload !== null) throw new TypeError("Unexpected typed payload for "+id);
				return "string";
			}
			return shape(error.payload);
		};
		const result = shape(d.result.type), args = d.parameters.map(p => shape(p.type));
		const error = errorShape(startId), terminalShape = errorShape(terminalId);
		if(args.some(Array.isArray)) throw new TypeError("Wasm task arguments must be copied scalars");
		return {id: d.id
			, name: d.name
			, declaration
			, args
			, result
			, effect
			, delivery
			, error
			, startId
			, terminal: terminalShape
			, terminalId
			, tagBytes: Math.max(1,depth(result),depth(error),depth(terminalShape))
			, stepDeclaration: protocol?.next ?? null};
	});
	if(!methods.some(m => m.delivery)) throw new TypeError("Expected a Task or async iterator");
	return {profile: "javascript-wasm-threaded-task-v1",componentIdentity,bindingIrSha256,controlSymbol: "lb_js_task_"+componentIdentity,methods};
};
