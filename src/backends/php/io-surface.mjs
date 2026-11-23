/**
 * Source-authenticated synchronous PHP contract, shared by native transports.
 *
 * @file
 */
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
import { heapResourceIdentities } from "../../analyze/heap-resource-identity.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { generateSyncWire } from "../c/sync-wire.mjs";
import { validateOrdinaryPhpSettings } from "./copied-model.mjs";
import { phpClassName, phpFieldName, reservedPhpNames } from "./copied-names.mjs";

const bigInteger = "\\Brick\\Math\\BigInteger";
const scalarTypes = Object.freeze({ unit: "null", bool: "bool", char: "string"
	, string: "string", bytes: "Bytes", float32: "float", float64: "float"
	, uint8: "int", uint16: "int", uint32: "int", int8: "int", int16: "int"
	, int32: "int", int64: "int", isize: "int", uint64: bigInteger
	, usize: bigInteger, nat: bigInteger, int: bigInteger });
const wasmTypes = Object.freeze({ ...scalarTypes, uint32: bigInteger, int64: bigInteger });
const fail=message=>{throw new TypeError("PHP synchronous IO: "+message);};
const hex=x=>typeof x==="string"&&/^[0-9a-f]{64}$/u.test(x);
const checkType=(t,leases,types)=>{
	if(Array.isArray(t))
	{
		if(t.length!==2) fail("malformed returned Except");
		t.forEach(branch => checkType(branch,leases,types)); return "Ok|Err";
	}
	if(leases.has(t)) return leases.get(t).publicName;
	if(!Object.hasOwn(types,t)) fail("unsupported copied value: "+t);
	return types[t];
};
const pascal=s=>s.split(/[-_]+/u).filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join("");

/**
 * Regenerate the wire from the compiler's selection. Never let an archive
 * introduce a native symbol, grant, error payload or result mode via metadata.
 *
 * @param input - Captured compiler evidence, exact public IR and package coordinates.
 * @param input.name - Composer vendor/package.
 * @param input.version - Composer version.
 * @param input.api - Compiler-derived or source-reconciled reviewed Binding IR.
 * @param input.bindingIrSha256 - Native adapter's pinned public IR hash.
 * @param input.evidence - Compiler interface, source and selection evidence.
 * @param tasks - Require genuine asynchronous declarations in the selection.
 * @param phpWasm - Generate synchronous signatures for 32-bit Zend instead of native FFI.
 */
const compileSurface=({name,version,api,bindingIrSha256,evidence},tasks,phpWasm=false)=>{
	if(typeof name!=="string"||typeof version!=="string") fail("missing Composer coordinates");
	validateOrdinaryPhpSettings({name,version});
	const s=evidence?.selection;
	if(phpWasm && (tasks || !Array.isArray(s?.nativeEffects) || s.nativeEffects.length || s.leanResources?.length))
		fail("expected an in-memory PHP-Wasm selection without leases or scheduled operations");
	const async = Boolean(s?.taskExports?.length || s?.asyncIterators?.length);
	if(!s || async!==tasks || (s.synchronousIO===true)===tasks
		||evidence.hostImportsSourceSha256!==null||!evidence.interfaces?.length
		||![evidence.sourceTreeSha256,evidence.compilerSha256,evidence.extractorSha256,evidence.configurationSha256].every(hex))
		fail(tasks ? "expected standalone task compiler evidence" : "expected standalone synchronous compiler evidence");
	if(!hex(bindingIrSha256)||hashBindingIr(api)!==bindingIrSha256) fail("Binding IR digest does not match the adapter");
	const owned = s.leanResources?.length ? heapResourceIdentities({ ...evidence, resources: evidence.metadata.leanResources }) : [];
	const {api: actual,entries}=reconcileHostExports({...evidence,ir: null,component: api.component,review: {source: canonicalJson(api)},owned});
	if(canonicalJson(actual)!==canonicalJson(api)) fail("review differs from the compiler surface");
	if(!/^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/u.test(api.component.name)) fail("invalid component namespace");
	const namespace="Lean"+pascal(api.component.name),prefix=phpWasm ? "lbc_php_wasm_"+sha256(api.component.id) : "lbc_php_"+sha256(name);
	const resources = api.types.filter(type => type.kind === "resource");
	const wire=generateSyncWire(prefix,entries,{ tasks, resources, phpWasm });
	const publicNames=new Set(),errorClasses=new Set(["ioerror","declaredfailure","leanbridgeerror","bytes","ok","err"]);
	const leases = new Map();
	const typeOf = t => checkType(t, leases, phpWasm ? wasmTypes : scalarTypes);
	if(tasks) for(const n of ["taskioerror","pullstream"]) errorClasses.add(n);
	if(wire.methods.some(m=>m.callbacks)) for(const n of ["retainedcallback","callbackclosed"]) errorClasses.add(n);
	for(const r of wire.leases ?? [])
	{
		const publicName = phpClassName(r.name), lower = publicName.toLowerCase();
		const owner = owned.find(o => o.identity === r.hash);
		if(errorClasses.has(lower) || reservedPhpNames.has(lower) || owner?.declaration.split(".").at(-1) !== r.name)
			fail("invalid nominal resource class "+r.name);
		errorClasses.add(lower); leases.set(r.type,{ ...r, publicName });
	}
	const methods=wire.methods.map((w,i)=>{
		const d=api.declarations[i],raw=phpClassName(w.name);
		const mode = w.delivery==="task" ? "promise" : w.delivery ?? "value";
		if(d.resultMode!==mode||d.failure.unexpected!=="poison-runtime"||d.name!==w.name||w.declaration!==d.source.declaration
			|| !/^[A-Za-z][A-Za-z0-9_]*$/u.test(raw)||publicNames.has(raw.toLowerCase()))
			fail("incompatible or colliding declaration "+w.declaration);
		publicNames.add(raw.toLowerCase());
		if(d.parameters.length!==w.args.length||new Set(d.parameters.map(p=>p.name)).size!==w.args.length) fail("parameter selection differs");
		const parameters=d.parameters.map((p,j)=>{
			if(w.args[j]==="callback")
			{
				const t=api.types.find(x=>x.id===p.type.id), c=t?.callable, slot=w.callbacks?.find(x=>x[0]===j);
				if(s.phpTaskCallbacks!==true || w.delivery!=="task" || !slot || p.optional || p.default!==null || p.ownership!=="lease" || p.lifetime?.scope!=="explicit" || p.lifetime.anchor!==null
					|| t.kind!=="callback" || t.source.extensions["lean-bridge.dev/callback-scheduler"]!=="owner-event-loop" || c?.invocation!=="many"
					|| c.reentry!=="same-agent" || c.selfDisposal!=="defer" || c.resultMode!=="value" || c.parameters.length!==1
					|| c.parameters[0].ownership!=="copy" || c.result.ownership!=="copy" || c.parameters[0].type.name!==slot[1] || c.result.type.name!==slot[2]
					|| c.failure.unexpected!=="poison-runtime" || c.failure.errors.join()!=="error:PhpCallbackException") fail("unverified retained callback");
				return {name: phpFieldName(p.name,fail),type: "callable("+typeOf(slot[1])+"): "+typeOf(slot[2])};
			}
			const borrowed = leases.has(w.args[j]);
			if(Array.isArray(w.args[j])||p.ownership!==(borrowed ? "borrow" : "copy")||p.optional||p.default!==null
				|| (borrowed && (p.lifetime?.scope!=="call" || p.lifetime.anchor!==null))) fail("expected a copied argument or call-scoped resource");
			return {name: phpFieldName(p.name,fail),type: typeOf(w.args[j])};
		});
		const leased = leases.has(w.result);
		if(d.result.ownership!==(leased ? "lease" : "copy") || (leased && (d.result.lifetime?.scope!=="explicit" || d.result.lifetime.anchor!==null)))
			fail("expected a copied result or independent resource lease");
		const failure=w.effect==="EIO"?pascal(w.name)+"Error":w.effect==="IO"?"IOError":null;
		if(w.effect==="EIO")
		{
			if(errorClasses.has(failure.toLowerCase())) fail("typed error class collision");
			errorClasses.add(failure.toLowerCase());
		}
		const terminal = w.callbacks && entries[i].taskIO ? "string" : w.terminal;
		const error = w.callbacks && w.effect==="IO" ? "string" : w.error;
		const terminalFailure = terminal ? w.delivery==="task" ? "TaskIOError" : pascal(w.name)+"StepError" : null;
		if(terminalFailure && w.delivery==="async-iterator")
		{
			if(errorClasses.has(terminalFailure.toLowerCase())) fail("typed step error class collision");
			errorClasses.add(terminalFailure.toLowerCase());
		}
		const returnType=typeOf(w.result), errorType=error===null?null:typeOf(error);
		const terminalType=terminal ? typeOf(terminal) : null;
		const step=w.delivery ? {terminalFailure,terminalType} : {};
		const phases=w.callbacks ? {error,terminal} : {};
		return {...w,...phases,publicName: raw,parameters,returnType,failure,errorType,...step};
	});
	return {namespace,prefix,methods,wire,leases,...phpWasm ? { phpWasm: true } : {}};
};

/**
 * Reconcile a synchronous-only native PHP component.
 *
 * @param input - Public coordinates, Binding IR and compiler evidence.
 */
export const compilePhpSyncSurface=input=>compileSurface(input,false);

/**
 * Reconstruct the wasm32 signatures and symbols from independently checked Lean evidence.
 *
 * @param input - Composer coordinates, public IR and compiler evidence.
 */
export const compilePhpWasmSyncSurface=input=>compileSurface(input,false,true);

/**
 * Reconcile a compiler-selected native PHP task or pull component.
 *
 * @param input - Public coordinates, Binding IR and compiler evidence.
 */
export const compilePhpTaskSurface=input=>compileSurface(input,true);
