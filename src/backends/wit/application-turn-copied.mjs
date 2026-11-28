/** @file Private typed ports for copied workers on a guest-object package's native owner. */
import {canonicalCopiedWorker} from "./canonical-app.mjs";
import {richCanonicalFuture} from "./canonical-future.mjs";
import {canonicalStream} from "./canonical-stream.mjs";

const key='(param "key" u32)';
const copiedChannelFields=m=>[
	["begin",m.params+" (result "+m.begin+")"]
	, ["peek",key+" (result "+m.payload+")"]
	, ...m.shape==="stream"?[["act",key+' (param "op" u32) (result u32)']]:[["poll",key+" (result bool)"],["close",key]]
];
/**
 * Build the private instance type shared by the host port and the Wasm writer.
 *
 * @param m - Checked copied channel.
 */
export const copiedChannelType=m=>"(instance "+copiedChannelFields(m).map(([n,t])=>`(export "${n}" (func ${t}))`).join(" ")+")";
/**
 * Declare a named private instance type so all graphs use identical imports.
 *
 * @param m - Checked copied channel.
 * @param id - Private WAT instance identifier.
 */
export const copiedChannelImport=(m,id)=>{
	return `(type ${id}-type ${copiedChannelType(m)}) (import "copied-${m.name}" (instance ${id} (type ${id}-type)))`;
};

/**
 * Build a canonical Wasm writer for a worker with no guest resources.
 *
 * @param o - Reconciled compiler metadata.
 * @param o.d - Public declaration.
 * @param o.e - Compiled native entry.
 * @param o.errors - Error definitions in the public interface.
 * @param o.label - Public WIT function name.
 */
export const copiedWorkerProjection=({d,e,errors,label})=>{
	const m=canonicalCopiedWorker(d,e,errors);
	if(m.name!==label)throw new TypeError("Copied task name differs: "+e.declaration);
	// Also emit writer retirement: copied values need cancellation and scratch
	// reclamation even though their payloads have no guest resource handles.
	m.ownership={slots: [],borrows: [],abandon: ""};
	const row={
		name: label,declaration: e.declaration,copied: true
		, shape: m.stream?"stream":"copied"
		, params: m.params,begin: m.begin,payload: m.payload.wat
		, witParams: m.args.map(a=>"%"+a.name+": "+a.t.wit).join(", ")
		, witResult: m.wit};
	return {row,writer: m.stream?canonicalStream(m,64):richCanonicalFuture(m,64)};
};

/**
 * Normal shutdown can release the last guest reference after closing the native binding.
 * Handle those requests even if the first worker has no nominal values. Future
 * controls also need local Wasm bodies: Wasmtime cannot expose host reexports.
 *
 * @param stream - Whether this worker uses the cursor control signature.
 */
export const copiedDrain=stream=>{
	const args=stream?"":'(param "right" u64)',sig=stream?"":"i64",extra=stream?"":"(i64.const 0)";
	return `(component
  (import "turn" (func $turn (param "op" u32) (param "key" u32) (param "${stream?"value":"left"}" u64) ${args} (result (tuple u32 u32 u64 u64))))
  (import "release" (func $release (param "kind" u32) (param "ticket" u64) (result bool)))
  ${stream?"":'(import "poll" (func $poll (param "key" u32) (result bool))) (import "close" (func $close (param "key" u32)))'}
  (core module $mem (memory (export "m") 1)) (core instance $m (instantiate $mem))
  (core func $t (canon lower (func $turn) (memory $m "m"))) (core func $r (canon lower (func $release)))
  ${stream?"":'(core func $poll (canon lower (func $poll))) (core func $close (canon lower (func $close)))'}
  (core module $body (import "" "m" (memory 1)) (import "" "turn" (func $t (param i32 i32 i64 ${sig} i32)))
    (import "" "release" (func $r (param i32 i64) (result i32)))
    ${stream?"":'(import "" "poll" (func $poll (param i32) (result i32))) (import "" "close" (func $close (param i32))) (func (export "poll") (param i32) (result i32) (call $poll (local.get 0))) (func (export "close") (param i32) (call $close (local.get 0)))'}
    (func (export "drain") (local $op i32) (local $reply i32) (local.set $op (i32.const ${stream?7:5}))
      (loop $again (call $t (local.get $op) (local.get $reply) (i64.const 0) ${extra} (i32.const 0))
        (if (i32.eqz (i32.load (i32.const 0))) (then return))
        (if (i32.ne (i32.load (i32.const 0)) (i32.const 1)) (then unreachable))
        (local.set $reply (call $r (i32.load offset=4 (i32.const 0)) (i64.load offset=8 (i32.const 0))))
        (if (i32.eqz (local.get $reply)) (then unreachable)) (local.set $op (i32.const 6)) (br $again))))
  (core instance $i (instantiate $body (with "" (instance (export "m" (memory $m "m")) (export "turn" (func $t)) (export "release" (func $r))
    ${stream?"":'(export "poll" (func $poll)) (export "close" (func $close))'}))))
  ${stream?"":'(func (export "poll") (param "key" u32) (result bool) (canon lift (core func $i "poll"))) (func (export "close") (param "key" u32) (canon lift (core func $i "close")))'}
  (func (export "drain") (canon lift (core func $i "drain"))))`;
};
