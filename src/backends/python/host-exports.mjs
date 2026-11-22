/**
 * Generate a CPython extension calling compiler-checked Lean IO entry points.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generatePythonHostProvider } from "./host-provider.mjs";

const scalars = {
	unit: ["Unit"], bool: ["Bool", "uint8_t", "lean_unbox"]
	, char: ["Char", "uint32_t", "lean_unbox_uint32"]
	, nat: ["Nat"], int: ["Int"], string: ["String"], bytes: ["ByteArray"]
	, float32: ["Float32", "float", "lean_unbox_float32"]
	, float64: ["Float", "double", "lean_unbox_float"]
};
for(const sign of ["u", "i"])
{
	for(const bits of [8, 16, 32, 64])
		scalars[`${sign === "u" ? "uint" : "int"}${bits}`] = [`${sign === "u" ? "U" : ""}Int${bits}`, `uint${bits}_t`, bits <= 16 ? "lean_unbox" : `lean_unbox_uint${bits}`];
	scalars[`${sign}size`] = [`${sign.toUpperCase()}Size`, "size_t", "lean_unbox_usize"];
}
const simpleName = /^[A-Za-z][A-Za-z0-9_]*$/u;
const qualified = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/u;
const keywords = new Set("False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield".split(" "));
const checkNames = (entries, classes) => {
	const seen = new Set(["bind_hosts", ...classes]);
	const builtins = ["type", "int", "str", "bytes", "float", "bool", "property", "staticmethod", "bind_hosts"];
	for(const name of classes) if(keywords.has(name) || builtins.includes(name)) throw new TypeError("reserved Python host class name");
	for(const entry of entries)
	{
		if(!qualified.test(entry.declaration) || !simpleName.test(entry.name) || keywords.has(entry.name) || seen.has(entry.name))
			throw new TypeError("invalid or duplicate host-component entry name");
		const parameters = new Set();
		for(const p of entry.parameters)
		{
			if(typeof p?.name !== "string" || !simpleName.test(p.name) || keywords.has(p.name) || parameters.has(p.name))
				throw new TypeError("invalid or duplicate host-component argument name");
			parameters.add(p.name);
		}
		seen.add(entry.name);
	}
};
const carrier = (resources, type) => {
	if(type?.kind === "primitive" && Object.hasOwn(scalars, type.name))
	{
		const [lean, c = "lean_object *", unbox] = scalars[type.name];
		return {
			lean: `_root_.${lean}`, c, unbox
			, fromPython: arg => `lb_out_${type.name}(${arg})`
			, toPython: arg => `lb_in_${type.name}(${unbox ? `${unbox}(${arg})` : arg})`
		};
	}
	const i = resources.findIndex(r => r.id === type?.id);
	if(type?.kind !== "named" || i < 0) throw new TypeError("host-component entry requires copied scalars or a declared host object");
	return {
		lean: `_root_.LeanBridge.Host.Python.${resources[i].name}`
		, c: "lean_object *", fromPython: arg => `lb_host_result(${i}, ${arg}, NULL)`
		, toPython: arg => `lb_host_arg(${i}, ${arg})`
	};
};
const emit = (resources, entry, i) => {
	const args = entry.parameters.map(p => carrier(resources, p.type)), out = carrier(resources, entry.result);
	const symbol = `lb_python_host_invoke_${i}`;
	const values = args.map((a, j) => a.unbox ? `${a.unbox}(v[${j}])` : `v[${j}]`).join(", ");
	const lean = `@[export ${symbol}] def invoke${i} ${args.map((a, j) => `(v${j} : ${a.lean})`).join(" ")} : IO ${out.lean} := _root_.${entry.declaration} ${args.map((_, j) => `v${j}`).join(" ")}`;
	const c = `extern lean_object *${symbol}(${args.map(a => a.c).join(", ") || "void"});
static PyObject *lb_invoke_${i}(PyObject *module, PyObject *args) {
    (void)module;
    if (!lb_active() || !lean_bridge_native_component_ready(LB_COMPONENT)) {
        PyErr_SetString(PyExc_RuntimeError, "enter bind_hosts on this thread before calling this component"); return NULL;
    }
    if (PyTuple_GET_SIZE(args) != ${args.length}) { PyErr_SetString(PyExc_TypeError, "wrong number of arguments to ${entry.name}"); return NULL; }
    lb_current->depth++; lb_frame frame = {lb_call_frame, NULL}; lb_call_frame = &frame; lb_sweep();
    lean_object *v[${Math.max(1, args.length)}] = {0}, *io = NULL; PyObject *result = NULL;
    ${args.map((a, j) => `if (!(v[${j}] = ${a.fromPython(`PyTuple_GET_ITEM(args, ${j})`)})) goto done;`).join("\n    ")}
    io = ${symbol}(${values});
    ${args.flatMap((a, j) => a.unbox ? [] : [`v[${j}] = NULL;`]).join(" ")}
    if (lean_io_result_is_ok(io)) {
        result = ${out.toPython("lean_io_result_get_value(io)")};
    } else {
        lean_object *e = lean_io_result_get_error(io);
        if (!lb_restore_fault(e)) {
            lean_inc(e); lean_object *s = lb_python_host_error_text(e);
            PyObject *msg = lb_in_string(s); lean_dec(s);
            if (msg) { PyErr_SetObject(PyExc_RuntimeError, msg); Py_DECREF(msg); }
        }
    }
    ${args.length ? "done: ;" : ""}
    /* Sweep before restoring the exception: arbitrary Python destructors may reenter. */
    PyObject *et = NULL, *ev = NULL, *tb = NULL;
    if (!result) PyErr_Fetch(&et, &ev, &tb);
    if (io) lean_dec(io);
    ${args.map((_, j) => `if (v[${j}]) lean_dec(v[${j}]);`).join(" ")}
    lb_frame_close(&frame); lb_sweep(); lb_current->depth--;
    if (!result) PyErr_Restore(et, ev, tb);
    return result;
}`;
	const params = entry.parameters.map(p => p.name).join(", ");
	const python = `def ${entry.name}(${params}):\n    return _native.${entry.name}(${params})\n`;
	return { lean, c, python, method: `{"${entry.name}", lb_invoke_${i}, METH_VARARGS, NULL}` };
};

/**
 * Generate both language halves together. Each selected application declaration
 * is independently checked at its exact signature when Lean compiles entryLean.
 *
 * @param options - Reviewed import IR, source module, public entries and verified runtime/component digests.
 */
export const generatePythonHostExtension = options => {
	const { ir, module, entries, runtimeIdentity, componentIdentity } = options;
	if(!qualified.test(module) || !entries.length || ![runtimeIdentity, componentIdentity].every(d => /^[a-f0-9]{64}$/u.test(d)))
		throw new TypeError("expected a source module, entries, and exact runtime/component identities");
	const provider = generatePythonHostProvider(ir);
	checkNames(entries, provider.resources);
	const resources = ir.types.filter(r => r.kind === "resource" && r.host?.targets.includes("python"));
	const functions = entries.map((e, i) => emit(resources, e, i));
	const entryLean = [
		`import ${module}`, "import LeanBridge.Host.Python"
		, "set_option autoImplicit false", "namespace LeanBridgeHostEntry"
		, "@[export lb_python_host_error_text] def errorText (e : IO.Error) : String := toString e"
		, ...functions.map(f => f.lean), "end LeanBridgeHostEntry", ""].join("\n");
	const source = `${provider.source}
#include "lean_bridge_native_runtime.h"
#define LB_COMPONENT "pyhost:${componentIdentity}"
extern lean_object *lb_python_host_error_text(lean_object *);
extern lean_object *initialize_BridgeHostExports(uint8_t);
static void *lb_init_component(uint8_t b) { return initialize_BridgeHostExports(b); }
static PyObject *lb_pybind(PyObject *mod, PyObject *args) {
    (void)mod;
    if (PyThreadState_GetInterpreter(PyThreadState_Get()) != PyInterpreterState_Main()) {
        PyErr_SetString(PyExc_RuntimeError, "this runtime requires the main Python interpreter"); return NULL;
    }
    if (!lean_bridge_native_component_initialize(LB_COMPONENT, lb_init_component)) {
        PyErr_SetString(PyExc_RuntimeError, "cannot initialize the Lean component in this process"); return NULL;
    }
    if (lb_bind(lb_specs, sizeof(lb_specs)/sizeof(lb_specs[0]), args, "${runtimeIdentity}")) return NULL;
    Py_RETURN_NONE;
}
static PyObject *lb_pyunbind(PyObject *mod, PyObject *args) {
    (void)mod; (void)args; if (lb_unbind()) return NULL; Py_RETURN_NONE;
}
static PyObject *lb_matches_runtime(PyObject *mod, PyObject *args) {
    (void)mod;
    unsigned long long lean, broker;
    if (!PyArg_ParseTuple(args, "KK", &lean, &broker)) return NULL;
    return PyBool_FromLong(lean == (uintptr_t)&lean_register_external_class
        && broker == (uintptr_t)&lean_bridge_native_component_initialize);
}
${functions.map(f => f.c).join("\n")}
static PyMethodDef lb_methods[] = {
    {"_bind", lb_pybind, METH_VARARGS, NULL}, {"_unbind", lb_pyunbind, METH_NOARGS, NULL},
    {"_matches_runtime", lb_matches_runtime, METH_VARARGS, NULL},
    ${functions.map(f => f.method).join(",\n    ")}, {NULL, NULL, 0, NULL}
};
static PyModuleDef lb_module = { PyModuleDef_HEAD_INIT, "_native", NULL, 0, lb_methods };
PyMODINIT_FUNC PyInit__native(void) { return PyModule_Create(&lb_module); }
`;
	const render = t => {
		if(t.kind === "named") return resources.find(r => r.id === t.id).name;
		return { bool: "bool", char: "str", string: "str", bytes: "bytes", unit: "None", float32: "float", float64: "float" }[t.name] ?? "int";
	};
	const hostNames = provider.resources.join(", ");
	const stub = [
		"from typing import ContextManager as _ContextManager"
		, `from .host_types import ${provider.resources.map(n => `${n} as ${n}`).join(", ")}`
		, `def bind_hosts(*, ${provider.resources.map(n => `${n}: type[${n}]`).join(", ")}) -> _ContextManager[None]: ...`
		, ...entries.map(e => `def ${e.name}(${e.parameters.map(p => `${p.name}: ${render(p.type)}`).join(", ")}) -> ${render(e.result)}: ...`)
		, ""
	].join("\n");
	const types = ["from __future__ import annotations", "from typing import Protocol as _Protocol", ""];
	for(const r of resources)
	{
		types.push(`class ${r.name}(_Protocol):`);
		// A setter requires its getter to have been defined, irrespective of IR order.
		const members = ir.declarations.filter(d => d.owner === r.id).sort((a, b) => Number(a.kind === "property" && a.parameters.length > 0) - Number(b.kind === "property" && b.parameters.length > 0));
		for(const d of members)
		{
			const name = d.name.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
			const isStatic = d.kind === "static-method", constructor = d.kind === "constructor";
			if(d.parameters.some(p => !simpleName.test(p.name) || p.name === "self" || keywords.has(p.name)) || keywords.has(name))
				throw new TypeError("invalid host protocol member or argument name");
			if(d.kind === "property" && d.parameters.length && !members.some(m => m.kind === "property" && m.name === d.name && !m.parameters.length))
				throw new TypeError("write-only properties require an explicit Python getter contract");
			if(d.kind === "property") types.push(d.parameters.length ? `    @${name}.setter` : "    @property");
			if(isStatic) types.push("    @staticmethod");
			const params = [...isStatic ? [] : ["self"], ...d.parameters.map(p => `${p.name}: ${render(p.type)}`)];
			types.push(`    def ${constructor ? "__init__" : name}(${params.join(", ")}) -> ${constructor ? "None" : render(d.result.type)}: ...`);
		}
		types.push("");
	}
	return {
		hostLean: provider.lean, entryLean, source, stub, types: types.join("\n")
		, bindingIrSha256: hashBindingIr(ir)
		, python: `${provider.binder}\nfrom .host_types import ${hostNames}\n\n${functions.map(f => f.python).join("\n")}`
	};
};
