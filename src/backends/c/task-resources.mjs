/**
 * Bridge opaque application-owned Lean objects into C task and stream calls.
 *
 * @file
 */

/**
 * Project verified nominal Lean resources into independently disposable C leases.
 *
 * @param definitions - Resource type definitions from the compiled public binding.
 */
export const taskResourceTypes = (definitions = []) => {
	const seen = new Set();
	return definitions.map(t => {
		const hash = t.source?.extensions?.["lean-bridge.dev/resource-identity"], lean = t.source?.declaration;
		if(t.kind !== "resource" || t.host !== null || !/^[a-f0-9]{64}$/u.test(hash) || t.resource?.kindId !== "resource:" + lean + "/" + hash
			|| !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u.test(lean) || t.id !== "lean:" + lean)
			throw new TypeError("Expected a checked Lean heap resource");
		const name = lean.split(".").at(-1), slug = name.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
		if(seen.has(slug)) throw new TypeError("Colliding resource class names");
		seen.add(slug);
		return { id: t.id, name, slug, hash, lean, raw: "lb_lease_" + hash };
	});
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
