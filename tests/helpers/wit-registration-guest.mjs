/** @file Generate the public canonical-ABI bindings for the cancellation client. */
const roles=["keep","victim"];
const interfaces=p=>`(import "lean-bridge:${p}/callbacks@1.0.0" (instance $callbacks-${p}
    (export "call-box-to-box" (type $c (sub resource)))
    (export "[static]call-box-to-box.make" (func (param "mode" u32) (result (own $c))))
    (export "audit" (func (param "field" u32) (result u32)))))
  (alias export $callbacks-${p} "call-box-to-box" (type $c-${p}))
  (import "lean-bridge:${p}/object-tasks@1.0.0" (instance $jobs-${p}
    (export "box" (type $bi (eq $b))) (export "member-error" (type $ei (eq $e)))
    (export "call-box-to-box" (type $ci (eq $c-${p})))
    (type $v (variant (case "callback" (own $ei)) (case "io" string))) (export "callback-failure" (type $err (eq $v)))
    (type $t (future (result (own $bi) (error $err))))
    (export "relay" (func (param "box" (borrow $bi)) (param "f" (borrow $ci)) (result $t)))))
  (alias export $jobs-${p} "callback-failure" (type $err-${p}))
  (type $t-${p} (future (result (own $b) (error $err-${p}))))`;

/**
 * Each callback and future uses its defining package's nominal type.
 * With a single package the two registrations share a provider; with two,
 * each provider's inactive bank of counters must also stay at zero.
 *
 * @param src - Common guest control flow.
 * @param objects - Installed application object interface.
 * @param owners - Package names for the surviving and canceled calls.
 */
export const registrationGuest=(src,objects,owners)=>{
	const pkgs=[...new Set(owners)];
	if(owners.length!==2 || pkgs.some(n=>!["workshop","gauge"].includes(n)))throw new TypeError("Unknown cancellation owner");
	const lower=[],imports=[],exports=[],starts=[];
	for(const [i,role] of roles.entries())
	{
		const pkg=owners[i];
		const op=(name,signature,canonical)=>{
			const key=name+"-"+role;
			lower.push(`(core func $${key} (canon ${canonical}))`);
			imports.push(`(import "" "${key}" (func $${key} ${signature}))`);
			exports.push(`(export "${key}" (func $${key}))`);
		};
		op("register","(param i32) (result i32)",`lower (func $callbacks-${pkg} "[static]call-box-to-box.make")`);
		op("audit","(param i32) (result i32)",`lower (func $callbacks-${pkg} "audit")`);
		op("relay","(param i32 i32) (result i32)",`lower (func $jobs-${pkg} "relay")`);
		op("dc","(param i32)",`resource.drop $c-${pkg}`);
		op("read","(param i32 i32) (result i32)",`future.read $t-${pkg} async (memory $m "m") (realloc (func $m "alloc"))`);
		if(role==="victim")op("cancel","(param i32) (result i32)",`future.cancel-read $t-${pkg}`);
		op("drop","(param i32)",`future.drop-readable $t-${pkg}`);
		starts.push(`(func $start-${role} (param $box i32) (result i32) (local $cb i32) (local $r i32)
          (local.set $cb (call $register-${role} (i32.const ${i*2})))
          (local.set $r (call $relay-${role} (local.get $box) (local.get $cb)))
          (call $dc-${role} (local.get $cb)) (local.get $r))`);
	}
	const fields={
		OBJECTS: objects, INTERFACES: pkgs.map(interfaces), LOWER: lower
		, PORT_IMPORTS: imports, PORT_EXPORTS: exports, START_FUNCTIONS: starts
		, CHECK_UNUSED_COUNTERS: pkgs.length===1?"":`(call $eq (if (result i32) (i32.lt_u (local.get $field) (i32.const 4))
            (then (call $audit-victim (local.get $field))) (else (call $audit-keep (local.get $field)))) (i32.const 0))`};
	return src.replace(/@([A-Z_]+)@/gu,(token,key)=>Object.hasOwn(fields,key)?[fields[key]].flat().join("\n  "):token);
};
