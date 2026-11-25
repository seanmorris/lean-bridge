/** @file Store original Wasm resources while compiled Lean holds private leases. */

const capacity=64;
// A ticket identifies one lease, NOT the object. Identity is always the
// defining guest's same-* operation. Never compare lease numbers for identity.
const body=(k,i)=>{
	const base=32+i*capacity*8,find="(call $find (i32.const "+base+") (local.get $ticket))";
	const optional=(name,success)=>`(func (export "${name}-${i}") (param $ticket i64) (result i32) (local $p i32) (local $v i32)
      (local.set $p ${find})
      (if (local.get $p) (then (local.set $v ${success})))
      (i32.store8 (i32.const 0) (i32.ne (local.get $p) (i32.const 0)))
      (i32.store (i32.const 4) (local.get $v)) (i32.const 0))`;
	const out=[`(func $hold${i} (export "hold-${i}") (param $v i32) (result i64) (local $token i64)
      (local.set $token (call $save (i32.const ${base}) (local.get $v)))
      (if (i64.eqz (local.get $token)) (then (call $drop${i} (local.get $v)))) (local.get $token))`
	, optional("take","(call $remove (local.get $p))")
	, `(func $release${i} (export "release-${i}") (param $ticket i64) (result i32) (local $p i32)
      (local.set $p ${find})
      (if (local.get $p) (then (call $drop${i} (call $remove (local.get $p)))))
      (i32.ne (local.get $p) (i32.const 0)))`
	, `(func $drain${i} (local $p i32) (local.set $p (i32.const ${base}))
      (loop $scan (if (i32.load (local.get $p)) (then (call $drop${i} (call $remove (local.get $p)))))
        (local.set $p (i32.add (local.get $p) (i32.const 8)))
        (br_if $scan (i32.lt_u (local.get $p) (i32.const ${base+capacity*8})))))`];
	if(k.retain)out.push(`(func (export "lease-${i}") (param $borrow i32) (result i64) (local $owned i32)
      (if (i32.eqz (global.get $domain)) (then (call $drop${i} (local.get $borrow)) (return (i64.const 0))))
      (local.set $owned (call $retain${i} (local.get $borrow))) (call $drop${i} (local.get $borrow))
      (call $hold${i} (local.get $owned)))`,
	optional("copy",`(call $retain${i} (i32.load offset=4 (local.get $p)))`),
	`(func $sameTickets${i} (export "same-${i}") (param $ticket i64) (param $other i64) (result i32) (local $p i32) (local $q i32)
      (local.set $p ${find}) (local.set $q (call $find (i32.const ${base}) (local.get $other)))
      (if (result i32) (i32.and (i32.ne (local.get $p) (i32.const 0)) (i32.ne (local.get $q) (i32.const 0)))
        (then (call $same${i} (i32.load offset=4 (local.get $p)) (i32.load offset=4 (local.get $q)))) (else (i32.const 0))))`);
	return out.join("\n");
};

/**
 * Generate a private Component Model table from the checked object/registration
 * layout. Each nominal kind has its own bounded array. Reusing a row issues a
 * new serial; neither serial nor domain is silently wrapped. The error type
 * has no clone contract, so it can be moved and released but not copied.
 *
 * @param descriptor - Compiled guest-defined resource contract.
 * @param callbacks - Optional compiled callback contract.
 */
export const witTurnOwners=(descriptor,callbacks)=>{
	const objectKinds=[...descriptor.contract.resources,{name: descriptor.contract.error}];
	const registered=callbacks?.exchange.slots.map(({type: name})=>({name,retain: "retain-"+name,same: "same-"+name}))??[];
	const kinds=[...objectKinds,...registered];
	const groups=[[descriptor.interfaceName,objectKinds,0],...registered.length?[[callbacks.interfaceName,registered,objectKinds.length]]:[]];
	const imports=[],intrinsics=[],lower=[],links=[],lift=[];
	for(const [g,[iface,group,first]] of groups.entries())
	{
		const fields=[],aliases=[];
		for(const [j,k] of group.entries())
		{
			const i=first+j,r="$r"+i;
			fields.push(`(export "${k.name}" (type ${r} (sub resource)))`);
			aliases.push(`(alias export $iface${g} "${k.name}" (type ${r}))`);
			intrinsics.push(`(core func $drop${i} (canon resource.drop ${r}))`);
			const funcs=[["drop","(param i32)"]];
			if(k.retain)
			{
				fields.push(`(export "${k.retain}" (func (param "value" (borrow ${r})) (result (own ${r}))))`,
					`(export "${k.same}" (func (param "left" (borrow ${r})) (param "right" (borrow ${r})) (result bool)))`);
				for(const [n,f] of [["retain",k.retain],["same",k.same]])intrinsics.push(`(core func $${n}${i} (canon lower (func $iface${g} "${f}")))`);
				funcs.push(["retain","(param i32) (result i32)"],["same","(param i32 i32) (result i32)"]);
			}
			for(const [n,t] of funcs)
			{
				lower.push(`(import "" "${n}${i}" (func $${n}${i} ${t}))`);links.push(`(export "${n}${i}" (func $${n}${i}))`);
			}
			const token='(param "ticket" u64)',owned=`(own ${r})`;
			const exports=[["hold",`(param "value" ${owned}) (result u64)`],["take",`${token} (result (option ${owned}))`],["release",token+" (result bool)"]];
			if(k.retain)exports.push(["lease",`(param "value" (borrow ${r})) (result u64)`],["copy",`${token} (result (option ${owned}))`],["same",token+' (param "other" u64) (result bool)']);
			for(const [n,t] of exports)lift.push(`(func (export "${n}-k${i}") ${t} (canon lift (core func $i "${n}-${i}") (memory $i "m")))`);
		}
		imports.push(`(import "${iface}" (instance $iface${g} ${fields.join(" ")}))`,...aliases);
	}
	return `(component
    ${imports.join("\n")} ${intrinsics.join("\n")}
    (core module $m ${lower.join(" ")}
      (memory (export "m") ${Math.ceil((32+kinds.length*capacity*8)/65536)})
      (global $domain (mut i32) (i32.const 0)) (global $last (mut i32) (i32.const 0)) (global $closed (mut i32) (i32.const 0))
      (global $live (mut i32) (i32.const 0))
      (func (export "bind") (param $d i32) (result i32)
        (if (i32.or (i32.or (global.get $closed) (global.get $domain)) (i32.eqz (local.get $d))) (then (return (i32.const 0))))
        (global.set $domain (local.get $d)) (i32.const 1))
      (func $save (param $base i32) (param $v i32) (result i64) (local $p i32)
        (if (i32.or (i32.eqz (global.get $domain)) (i32.eq (global.get $last) (i32.const -1))) (then (return (i64.const 0))))
        (local.set $p (local.get $base))
        (loop $scan (if (i32.eqz (i32.load (local.get $p))) (then
          (global.set $last (i32.add (global.get $last) (i32.const 1))) (global.set $live (i32.add (global.get $live) (i32.const 1)))
          (i32.store (local.get $p) (global.get $last)) (i32.store offset=4 (local.get $p) (local.get $v))
          (return (i64.or (i64.shl (i64.extend_i32_u (global.get $domain)) (i64.const 32)) (i64.extend_i32_u (global.get $last))))))
          (local.set $p (i32.add (local.get $p) (i32.const 8)))
          (br_if $scan (i32.lt_u (local.get $p) (i32.add (local.get $base) (i32.const ${capacity*8})))))
        (i64.const 0))
      (func $find (param $base i32) (param $k i64) (result i32) (local $p i32)
        (if (i32.or (i32.eqz (i32.wrap_i64 (local.get $k))) (i32.or (i32.eqz (global.get $domain))
          (i32.ne (global.get $domain) (i32.wrap_i64 (i64.shr_u (local.get $k) (i64.const 32)))))) (then (return (i32.const 0))))
        (local.set $p (local.get $base))
        (loop $scan (if (i32.eq (i32.load (local.get $p)) (i32.wrap_i64 (local.get $k))) (then (return (local.get $p))))
          (local.set $p (i32.add (local.get $p) (i32.const 8)))
          (br_if $scan (i32.lt_u (local.get $p) (i32.add (local.get $base) (i32.const ${capacity*8})))))
        (i32.const 0))
      (func $remove (param $p i32) (result i32) (local $v i32)
        (local.set $v (i32.load offset=4 (local.get $p))) (i64.store (local.get $p) (i64.const 0))
        (global.set $live (i32.sub (global.get $live) (i32.const 1))) (local.get $v))
      ${kinds.map(body).join("\n")}
      (func (export "release-lease") (param $kind i32) (param $ticket i64) (result i32)
        ${kinds.map((_,i)=>`(if (i32.eq (local.get $kind) (i32.const ${i})) (then (return (call $release${i} (local.get $ticket)))))`).join(" ")} (i32.const 0))
      (func (export "same-lease") (param $kind i32) (param $left i64) (param $right i64) (result i32)
        ${kinds.flatMap((k,i)=>k.retain?[`(if (i32.eq (local.get $kind) (i32.const ${i})) (then (return (call $sameTickets${i} (local.get $left) (local.get $right)))))`]:[]).join(" ")} (i32.const 0))
      (func (export "count") (result i32) (global.get $live))
      (func (export "close") (global.set $closed (i32.const 1)) (global.set $domain (i32.const 0)) ${kinds.map((_,i)=>`(call $drain${i})`).join(" ")}))
    (core instance $i (instantiate $m (with "" (instance ${links.join(" ")}))))
    (func (export "bind") (param "domain" u32) (result bool) (canon lift (core func $i "bind")))
    (func (export "release-lease") (param "kind" u32) (param "ticket" u64) (result bool) (canon lift (core func $i "release-lease")))
    (func (export "same-lease") (param "kind" u32) (param "left" u64) (param "right" u64) (result bool) (canon lift (core func $i "same-lease")))
    (func (export "count") (result u32) (canon lift (core func $i "count")))
    (func (export "close") (canon lift (core func $i "close"))) ${lift.join("\n")})`;
};
