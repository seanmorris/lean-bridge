/**
 * Bridge opaque application-owned Lean objects into C task and stream calls.
 *
 * @file
 */

/**
 * Project verified nominal Lean resources into independently disposable C leases.
 *
 * @param definitions - Resource type definitions from the compiled public binding.
 * @param hostKinds - Authenticated owner kinds sharing the native lease ledger.
 * @param owner - Host namespace that supplies those kinds.
 */
export const taskResourceTypes = (definitions = [],hostKinds=[],owner="javascript") => {
	const names={javascript: ["js","Javascript"],php: ["php","Php"],ruby: ["ruby","Ruby"],dotnet: ["clr","Dotnet"],jvm: ["jvm","Jvm"],perl: ["perl","Perl"]};
	if(!Object.hasOwn(names,owner)) throw new TypeError("Unknown task object owner");
	const [prefix,module]=names[owner];
	const seen = new Set();
	const resources=definitions.map(t => {
		const hash = t.source?.extensions?.["lean-bridge.dev/resource-identity"], lean = t.source?.declaration;
		if(t.kind !== "resource" || t.host !== null || !/^[a-f0-9]{64}$/u.test(hash) || t.resource?.kindId !== "resource:" + lean + "/" + hash
			|| !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(lean) || t.id !== "lean:" + lean)
			throw new TypeError("Expected a checked Lean heap resource");
		const name = lean.split(".").at(-1), slug = name.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
		if(seen.has(slug)) throw new TypeError("Colliding resource class names");
		seen.add(slug);
		return { id: t.id, name, slug, hash, lean, raw: "lb_lease_" + hash };
	});
	for(const [i,k] of hostKinds.entries())
	{
		const {name,id,hash}=k,slug=prefix+"_host_"+i;
		if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name) || !/^[a-f0-9]{64}$(?![\s\S])/u.test(hash) || typeof id!=="string" || !id || seen.has(slug)
			|| resources.some(r=>r.hash===hash || r.id===id)) throw new TypeError("Invalid "+({php: "PHP",javascript: "JavaScript",ruby: "Ruby",dotnet: "CLR",jvm: "JVM",perl: "Perl"}[owner])+" host lease layout");
		resources.push({id,name,hash,slug,lean: "LeanBridge.Host."+module+"."+name,raw: "lb_lease_"+hash,host: true});
		seen.add(slug);
	}
	return resources;
};

/**
 * Emit a common wire type per source identity, plus type-checked public operations per component.
 *
 * @param p - Component symbol prefix.
 * @param resources - Validated, normalized nominal types.
 * @param fn - Register a typed component entry point.
 */
export const cResourceApi = (p, resources, fn) => resources.map(r => {
	const base = `${p}_resource_${r.slug}`, h = base + "_t", key = JSON.stringify(r.hash);
	if(r.host) fn(base+"_prepare",[],"return lb_prepare();");
	fn(base + "_release", [`${h} *v`], `if (!lb_context()) return LB(WRONG_CONTEXT);
    return v ? lb_lease_status(LB_LEASE(release)(${key}, v->_private)) : LB(INVALID);`);
	fn(base + "_retain", [`${h} v`, `${h} *out`], `if (!out || out->_private[0] || out->_private[1]) return LB(INVALID);
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;
    lean_object *value = LB_LEASE(borrow)(${key}, v._private);
    return value ? lb_lease_status(LB_LEASE(create)(${key}, value, out->_private)) : LB(CLOSED);`);
	fn(base + "_same", [`${h} a`, `${h} b`, "bool *out"], `if (!out) return LB(INVALID);
    LB(status) s = lb_prepare(); if (s != LB(OK)) return s;
    lean_object *av = LB_LEASE(borrow)(${key}, a._private), *bv = LB_LEASE(borrow)(${key}, b._private);
    if (!av || !bv) return LB(CLOSED);
    *out = av == bv; return LB(OK);`);
	return `#ifndef LB_LEASE_TYPE_${r.hash}
#define LB_LEASE_TYPE_${r.hash}
typedef struct ${r.raw} { uint64_t _private[2]; } ${r.raw};
#endif
typedef ${r.raw} ${h};`;
}).join("\n");

export const cResourceSupport = `#include "task-resource-ledger.h"
static LB(status) lb_lease_status(int n) {
    return n == LB_LEASE_OK ? LB(OK) : n == LB_LEASE_MEMORY ? LB(NO_MEMORY)
        : n == LB_LEASE_UNAVAILABLE ? LB(UNAVAILABLE) : LB(CLOSED);
}
static lean_object *lb_lease_arg(lean_object *v) { lean_inc(v); return v; }`;
