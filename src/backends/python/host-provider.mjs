/**
 * Compile explicit host imports to pinned Lean FFI functions backed by real Python classes.
 *
 * @file
 */
import { readFileSync } from "node:fs";
import { generateLeanHostObjectAdapters, hostMemberSymbol } from "../lean/host-object.mjs";

const header = name => readFileSync(new URL(name, import.meta.url), "utf8");
const snake = name => name.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
const scalar = {
	unit: "lean_object *", bool: "uint8_t", char: "uint32_t"
	, string: "lean_object *", bytes: "lean_object *"
	, nat: "lean_object *", int: "lean_object *", usize: "size_t", isize: "size_t"
	, float32: "float", float64: "double"
	, uint8: "uint8_t", uint16: "uint16_t", uint32: "uint32_t", uint64: "uint64_t"
	, int8: "uint8_t", int16: "uint16_t", int32: "uint32_t", int64: "uint64_t"
};
const reject = (id, reason) => { throw new TypeError(`Unsupported Python host import ${id}: ${reason}`); };
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/u;
const refModel = (resources, site, id) => {
	const { type, ownership, lifetime } = site;
	if(type.kind === "primitive" && Object.hasOwn(scalar, type.name) && ownership === "copy" && lifetime === null)
		return { c: scalar[type.name], name: type.name };
	const index = resources.findIndex(r => r.id === type.id);
	if(type.kind === "named" && index >= 0 && ownership !== "copy")
		return { c: "lean_object *", index };
	return reject(id, "expected a copied scalar or a declared nominal Python resource");
};
const input = (arg, cName) => arg.index === undefined ? `lb_in_${arg.name}(${cName})` : `lb_host_arg(${arg.index}, ${cName})`;
const emitMember = (resources, owner, decl) => {
	const { id, receiver, parameters, result, kind } = decl;
	if(decl.resultMode !== "value" || decl.typeParameters.length || !identifier.test(decl.name)
		|| parameters.some(p => p.optional || p.default !== null))
		reject(id, "expected a concrete synchronous member with required arguments");
	const hasSelf = receiver !== null;
	if(!["constructor", "method", "static-method", "property"].includes(kind)
		|| hasSelf !== ["method", "property"].includes(kind)
		|| (kind === "property" && (parameters.length > 1 || (parameters.length && result.type.name !== "unit")))
		|| (kind === "constructor" && result.type.id !== owner.id)) reject(id, "invalid member shape");
	const sites = hasSelf ? [receiver, ...parameters] : parameters;
	const args = sites.map(s => refModel(resources, s, id)), out = refModel(resources, result, id);
	for(const [i, s] of sites.entries())
	{
		if(args[i].index === undefined) continue;
		const phases = s.ownership === "borrow" ? ["call"] : ["call", "explicit"];
		if(!phases.includes(s.lifetime?.scope) || s.lifetime.anchor !== null) reject(id, "unimplemented resource argument lifetime");
	}
	if(out.index !== undefined && result.ownership !== "borrow" && (result.lifetime?.scope !== "explicit" || result.lifetime.anchor !== null))
		reject(id, "unimplemented owning result lifetime");
	let anchor = "NULL";
	if(result.ownership === "borrow")
	{
		const { scope, anchor: name } = result.lifetime ?? {};
		const i = scope === "receiver" && name === "receiver" && hasSelf ? 0
			: scope === "parameter" && parameters.some(p => p.name === name) ? Number(hasSelf) + parameters.findIndex(p => p.name === name) : -1;
		if(i < 0 || args[i].index === undefined) reject(id, "borrowed result needs a nominal receiver or argument anchor");
		anchor = `p[${i}]`;
	}
	const n = Number(hasSelf), ownerIndex = resources.indexOf(owner);
	const obj = hasSelf ? "p[0]" : `lb_current->kinds[${ownerIndex}]->type`;
	const attr = JSON.stringify(snake(decl.name));
	const call = kind === "property"
		? parameters.length
			? `if (PyObject_SetAttrString(${obj}, ${attr}, p[1]) == 0) answer = Py_NewRef(Py_None);`
			: `answer = PyObject_GetAttrString(${obj}, ${attr});`
		: `callable = ${kind === "constructor" ? `Py_NewRef(${obj})` : `PyObject_GetAttrString(${obj}, ${attr})`};
    if (callable && lean_bridge_native_component_ready(LB_COMPONENT)) answer = PyObject_Vectorcall(callable, ${parameters.length ? `p + ${n}` : "NULL"}, ${parameters.length}, NULL);`;
	const drop = args.flatMap((a, i) => a.c === "lean_object *" && sites[i].ownership !== "borrow" ? [`lean_dec(a${i});`] : []).join(" ");
	const convert = out.index === undefined ? `lb_out_${out.name}(answer)` : `lb_host_result(${out.index}, answer, ${anchor})`;
	return `lean_object *${hostMemberSymbol("python", owner, decl)}(${args.map((a, i) => `${a.c} a${i}`).join(", ") || "void"}) {
    if (!lb_active() || !lean_bridge_native_component_ready(LB_COMPONENT)) { ${drop} return lb_fail("no active Python host binding on this thread"); }
    lb_current->depth++; lb_sweep();
    PyObject *p[${Math.max(args.length, 1)}] = {0}, *callable = NULL, *answer = NULL;
    lean_object *value = NULL, *error = NULL;
    ${args.map((a, i) => `if (!(p[${i}] = ${input(a, `a${i}`)})) goto done;`).join("\n    ")}
    if (lean_bridge_native_component_ready(LB_COMPONENT)) { ${call} }
    if (answer && lean_bridge_native_component_ready(LB_COMPONENT)) value = ${convert};
    ${args.length ? "done:" : ""}
    if (!value) error = lean_bridge_native_component_ready(LB_COMPONENT) ? lb_python_error() : lb_fail("Lean runtime retired during host member");
    Py_XDECREF(answer); Py_XDECREF(callable);
    ${args.map((_, i) => `Py_XDECREF(p[${i}]);`).join(" ")}
    ${drop} lb_current->depth--;
    if (!lean_bridge_native_component_ready(LB_COMPONENT)) {
        if (value) lean_dec(value);
        if (error) lean_dec(error);
        PyErr_Clear(); return lb_fail("Lean runtime retired during host member");
    }
    return value ? lean_io_result_mk_ok(value) : error;
}`;
};

/**
 * Generate compiled imports, private provider source and a public keyword-only binder.
 * Unsupported operations fail generation; this never falls back to dynamic dispatch by ID.
 *
 * @param ir - Language-neutral binding IR defining the host imports.
 */
export const generatePythonHostProvider = ir => {
	const lean = generateLeanHostObjectAdapters(ir)["LeanBridge/Host/Python.lean"];
	if(!lean) reject(ir.component.id, "no Python host objects selected");
	const resources = ir.types.filter(r => r.kind === "resource" && r.host?.targets.includes("python"));
	const kinds = new Set(), names = new Set();
	const members = [];
	for(const r of resources)
	{
		if(r.host.dynamic || !identifier.test(r.name) || kinds.has(r.resource.kindId)) reject(r.id, "expected a distinct, statically declared resource kind");
		kinds.add(r.resource.kindId); names.add(r.name);
		const declarations = ir.declarations.filter(d => d.owner === r.id);
		if(declarations.filter(d => d.kind === "constructor").length > 1) reject(r.id, "overloaded Python constructors need a discriminator");
		for(const d of declarations) members.push(emitMember(resources, r, d));
	}
	const classes = [...names].join(", ");
	return {
		lean, resources: [...names]
		, source: [header("host-identity.h"), header("host-scalars.h")
			, `static const lb_spec lb_specs[] = {${resources.map(r => `{${JSON.stringify(r.resource.kindId)}, ${Number(r.host.identity === "strong-canonical")}}`).join(", ")}};`
			, ...members].join("\n")
		, binder: `from contextlib import contextmanager as _contextmanager
from . import _native

@_contextmanager
def bind_hosts(*, ${classes}):
    """Bind this component's declared Python classes for the duration of the block."""
    _native._bind(${classes})
    try:
        yield
    finally:
        _native._unbind()
`
	};
};
