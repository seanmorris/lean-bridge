/** @file Private, typed handoff between a composed WIT facade and its native Lean embedding. */

/**
 * Keep resource handles inside their defining Component Model graph. Linking a second
 * resource definition with a native destructor would change who handles guest drops.
 * Each cell here contains an owned handle in this component's canonical resource table,
 * never a guest representation or native pointer. Only the generated facade and its
 * embedding can access the exchange. Multiple arguments of one type are taken LIFO.
 *
 * @param descriptor - Authenticated application member interface.
 * @param descriptor.contract - Nominal resources and the original member-error type.
 * @param descriptor.interfaceName - Fully qualified interface exported by the object owner.
 */
export const witApplicationExchange = ({contract,interfaceName}) => {
	const types=[...contract.resources.map(r=>r.name),contract.error];
	const name=interfaceName.replace("/objects@","/exchange@");
	// Core exports on a world use the unversioned "|" scope. This leaves
	// version mangling to wasm-tools, including prereleases and 0.x packages.
	const slots=types.map((type,i)=>({type,alias: "item"+i,put: "put-item"+i,take: "take-item"+i}));
	const fields=slots.flatMap(s=>["  "+s.put+": func(value: own<"+s.alias+">);","  "+s.take+": func() -> own<"+s.alias+">;"]);
	const uses="  use objects.{"+slots.map(s=>"%"+s.type+" as "+s.alias).join(", ")+"};";
	const wit=["interface exchange {",uses,...fields,"}","world exchange-storage {", "  import objects;",uses,...fields.map(f=>f.replace("  ","  export ")),"}"].join("\n");
	return {name,slots,wit,wat: exchangeCore(slots)};
};

// Same bounded storage for both exchanges. The wrappers below import the
// original resource types; a registration is never transferred as a u32.
const exchangeCore=slots=>{
	const capacity=64;
	const funcs=slots.map((s,i)=>{
		const n="$depth"+i,offset=i*capacity*4;
		const address="(i32.shl (global.get "+n+") (i32.const 2))";
		return `(global ${n} (mut i32) (i32.const 0))
  (func (export "cm32p2||${s.put}") (param $owned i32)
    (if (i32.ge_u (global.get ${n}) (i32.const ${capacity})) (then unreachable))
    (i32.store offset=${offset} ${address} (local.get $owned))
    (global.set ${n} (i32.add (global.get ${n}) (i32.const 1))))
  (func (export "cm32p2||${s.take}") (result i32)
    (if (i32.eqz (global.get ${n})) (then unreachable))
    (global.set ${n} (i32.sub (global.get ${n}) (i32.const 1)))
    (i32.load offset=${offset} ${address}))`;
	});
	const pages=Math.ceil(slots.length*capacity*4/65536);
	return "(module (memory "+pages+" "+pages+")\n"+funcs.join("\n")+"\n)";
};

/**
 * Private stack per original callback resource. A guest facade can retain a
 * registration into this instance, and the native factory can take it in the
 * same call. No synthetic resource definition or shared pointer is involved.
 *
 * @param iface - Fully qualified public callback provider interface.
 * @param sigs - Authenticated nominal callback signatures, in layout order.
 */
export const witCallbackExchange=(iface,sigs)=>{
	const slots=sigs.map(({label},i)=>({type: label,alias: "item"+i,put: "put-item"+i,take: "take-item"+i}));
	const name=iface.replace("/callbacks@","/callback-exchange@");
	const text=["(component",`(import "${iface}" (instance $cb`
		, ...slots.map(s=>`(export "${s.type}" (type (sub resource)))`),"))"
		, ...slots.map(s=>`(alias export $cb "${s.type}" (type $${s.alias}))`)
		, exchangeCore(slots).replace("(module","(core module $m")
		, "(core instance $mem (instantiate $m))"
		, ...slots.flatMap(s=>[
			`(func $${s.put} (param "value" (own $${s.alias})) (canon lift (core func $mem "cm32p2||${s.put}")))`
			, `(func $${s.take} (result (own $${s.alias})) (canon lift (core func $mem "cm32p2||${s.take}")))`])
		, "(instance $x"
		, ...slots.flatMap(s=>[`(export "${s.alias}" (type $${s.alias}))`,...[s.put,s.take].map(f=>`(export "${f}" (func $${f}))`)])
		, ")",`(export "${name}" (instance $x)))`];
	return {name,slots,wat: text.join("\n")};
};
