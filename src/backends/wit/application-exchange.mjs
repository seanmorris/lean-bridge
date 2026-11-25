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
	const pages=Math.ceil(types.length*capacity*4/65536);
	const wat="(module (memory "+pages+" "+pages+")\n"+funcs.join("\n")+"\n)";
	return {name,slots,wit,wat};
};
