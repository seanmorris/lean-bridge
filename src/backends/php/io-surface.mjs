/**
 * Source-authenticated synchronous PHP contract, shared by native transports.
 *
 * @file
 */
import { reconcileHostExports } from "../../analyze/host-export-model.mjs";
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
const fail=message=>{throw new TypeError("PHP synchronous IO: "+message);};
const hex=x=>typeof x==="string"&&/^[0-9a-f]{64}$/u.test(x);
const checkType=t=>{
	if(Array.isArray(t))
	{
		if(t.length!==2) fail("malformed returned Except");
		t.forEach(checkType); return "Ok|Err";
	}
	if(!Object.hasOwn(scalarTypes,t)) fail("unsupported copied value: "+t);
	return scalarTypes[t];
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
 */
export const compilePhpSyncSurface=({name,version,api,bindingIrSha256,evidence})=>{
	if(typeof name!=="string"||typeof version!=="string") fail("missing Composer coordinates");
	validateOrdinaryPhpSettings({name,version});
	const s=evidence?.selection;
	if(!s?.synchronousIO||s.taskExports?.length||s.asyncIterators?.length||s.leanResources?.length
		||evidence.hostImportsSourceSha256!==null||!evidence.interfaces?.length
		||![evidence.sourceTreeSha256,evidence.compilerSha256,evidence.extractorSha256,evidence.configurationSha256].every(hex))
		fail("expected standalone synchronous compiler evidence");
	if(!hex(bindingIrSha256)||hashBindingIr(api)!==bindingIrSha256) fail("Binding IR digest does not match the adapter");
	const {api: actual,entries}=reconcileHostExports({...evidence,ir: null,component: api.component,review: {source: canonicalJson(api)}});
	if(canonicalJson(actual)!==canonicalJson(api)) fail("review differs from the compiler surface");
	if(!/^[A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*$/u.test(api.component.name)) fail("invalid component namespace");
	const namespace="Lean"+pascal(api.component.name),prefix="lbc_php_"+sha256(name);
	const wire=generateSyncWire(prefix,entries);
	const publicNames=new Set(),errorClasses=new Set(["ioerror","declaredfailure","leanbridgeerror","bytes","ok","err"]);
	const methods=wire.methods.map((w,i)=>{
		const d=api.declarations[i],raw=phpClassName(w.name);
		if(d.resultMode!=="value"||d.failure.unexpected!=="poison-runtime"||d.name!==w.name||w.declaration!==d.source.declaration
			|| !/^[A-Za-z][A-Za-z0-9_]*$/u.test(raw)||reservedPhpNames.has(raw.toLowerCase())||publicNames.has(raw.toLowerCase()))
			fail("incompatible or colliding declaration "+w.declaration);
		publicNames.add(raw.toLowerCase());
		if(d.parameters.length!==w.args.length||new Set(d.parameters.map(p=>p.name)).size!==w.args.length) fail("parameter selection differs");
		const parameters=d.parameters.map((p,j)=>{
			if(Array.isArray(w.args[j])||p.ownership!=="copy"||p.optional||p.default!==null) fail("expected a direct copied argument");
			return {name: phpFieldName(p.name,fail),type: checkType(w.args[j])};
		});
		if(d.result.ownership!=="copy") fail("expected a copied result");
		const failure=w.effect==="EIO"?pascal(w.name)+"Error":w.effect==="IO"?"IOError":null;
		if(w.effect==="EIO")
		{
			if(errorClasses.has(failure.toLowerCase())) fail("typed error class collision");
			errorClasses.add(failure.toLowerCase());
		}
		return {...w,publicName: raw,parameters,returnType: checkType(w.result),failure,errorType: w.error===null?null:checkType(w.error)};
	});
	return {namespace,prefix,methods,wire};
};
