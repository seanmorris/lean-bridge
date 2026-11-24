/**
 * Generate a CPython extension calling compiler-checked Lean IO entry points.
 *
 * @file
 */
import { readFileSync } from "node:fs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { sha256 } from "../../capsule/node.mjs";
import { taskResourceTypes } from "../c/task-resources.mjs";
import { generatePythonHostProvider } from "./host-provider.mjs";
import { streamCodec, streamEntryLean, streamStub } from "./stream-exports.mjs";
import { callbackLean, callbackMethods, callbackPrototypes, ioOutcome, ioPython, retainedEntry } from "./task-callback.mjs";

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
	const builtins = ["type", "int", "str", "bytes", "float", "bool", "property", "staticmethod", "isinstance", "super", "Exception", "bind_hosts", "Ok", "Err", "LeanEIOError", "LeanStreamError"];
	const seen = new Set([...builtins, ...classes]);
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
	const owned = resources[i];
	if(owned.hash) return {
		lean: "_root_." + owned.lean, c: "lean_object *"
		, fromPython: arg => `lb_resource_arg("${owned.hash}", ${arg}, 1)`
		, validate: arg => `lb_resource_arg("${owned.hash}", ${arg}, 0)`
		, toPython: arg => `lb_resource_value("${owned.hash}", ${arg})`
	};
	return {
		lean: `_root_.LeanBridge.Host.Python.${resources[i].name}`
		, c: "lean_object *", hostIndex: i
		, toPython: arg => `lb_host_arg(${i}, ${arg})`
	};
};
const returned = (resources, type, codecs) => {
	if(type?.kind !== "apply" || type.constructor !== "result") return carrier(resources, type);
	if(type.arguments?.length !== 2) throw new TypeError("Except requires success and error payloads");
	const key = JSON.stringify(type);
	if(codecs.has(key)) return codecs.get(key);
	const [ok, err] = type.arguments.map(t => returned(resources, t, codecs));
	const n = codecs.size, decode = (t, v) => t.decode ? t.decode(v) : v;
	const codec = {
		lean: `(_root_.Except ${err.lean} ${ok.lean})`
		, toPython: v => `lb_result_${n}(${v})`, decode: v => `_lb_result_${n}(${v})`
		, python: `def _lb_result_${n}(raw):\n    return Ok(${decode(ok, "raw[1]")}) if raw[0] else Err(${decode(err, "raw[1]")})\n`
		, c: `static PyObject *lb_result_${n}(lean_object *v) {
    /* Lean Except.error is constructor 0; Except.ok is constructor 1. Both own a boxed payload. */
    int ok = lean_obj_tag(v) == 1;
    lean_object *p = lean_ctor_get(v, 0);
    PyObject *payload = ok ? ${ok.toPython("p")} : ${err.toPython("p")};
    if (!payload) return NULL;
    PyObject *pair = PyTuple_Pack(2, ok ? Py_True : Py_False, payload);
    Py_DECREF(payload); return pair;
}`
	};
	codecs.set(key, codec);
	return codec;
};
const resultTypes = `from dataclasses import dataclass as _dataclass
from typing import Generic as _Generic, TypeVar as _TypeVar
_T = _TypeVar("_T")

@_dataclass(frozen=True)
class Ok(_Generic[_T]):
    value: _T

@_dataclass(frozen=True)
class Err(_Generic[_T]):
    error: _T
`;
const errorClass = `class LeanEIOError(Exception):
    def __init__(self, declaration: str, payload: object) -> None:
        self.declaration = declaration
        self.payload = payload
        super().__init__(f"{declaration} raised a Lean EIO error")
`;
const syncIOClass = `class LeanIOError(RuntimeError):
    def __init__(self, declaration: str, message: str) -> None:
        self.declaration = declaration
        self.message = message
        super().__init__(message)

_native._io_failure_type = LeanIOError
`;
const copied = t => t?.kind === "primitive" ? Object.hasOwn(scalars, t.name)
	: t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2 && t.arguments.every(copied);
const asset = path => readFileSync(new URL(path, import.meta.url), "utf8");
const taskCodec = (i, value, error, checked) => {
	const task = `(_root_.Task ${checked ? `(_root_.Except _root_.IO.Error ${value.lean})` : value.lean})`;
	return {
		lean: error ? `(_root_.Except ${error.lean} ${task})` : task
		, c: `${checked ? `static PyObject *lb_value_${i}(lean_object *v) { return ${value.toPython("v")}; }\n` : ""}static PyObject *lb_finish_${i}(lean_object *v) { return ${checked ? `lb_async_outcome(v, lb_value_${i})` : value.toPython("v")}; }
static PyObject *lb_start_${i}(lean_object *v) {
    ${error ? `int ok = lean_obj_tag(v) == 1;
    lean_object *p = lean_ctor_get(v, 0);
    PyObject *payload = ok ? lb_ticket_new(p, lb_finish_${i}) : ${error.toPython("p")};
    if (!payload) return NULL;
    PyObject *pair = PyTuple_Pack(2, ok ? Py_True : Py_False, payload);
    Py_DECREF(payload); return pair;` : `return lb_ticket_new(v, lb_finish_${i});`}
}`
		, toPython: v => `lb_start_${i}(${v})`
		, body: (raw, name) => [
			`    _start = ${raw}`
			, ...(error ? [`    if not _start[0]:\n        raise _lb_error_type("${name}", ${error.decode ? error.decode("_start[1]") : "_start[1]"})`] : [])
			, `    _value = await _lb_await(${error ? "_start[1]" : "_start"})`
			, ...(checked ? [`    _value = _lb_outcome(_value, {}, "${name}", True)`] : [])
			, `    return ${value.decode ? value.decode("_value") : "_value"}\n`
		].join("\n")
	};
};
const emit = (resources, entry, i, codecs, synchronous, immediate) => {
	const args = entry.parameters.map(p => carrier(resources, p.type));
	const effect = entry.effect ?? "IO", task = entry.delivery === "task", stream = entry.delivery === "async-iterator";
	const bound = resources.some(r => !r.hash) && !task && !stream;
	const admitted = t => copied(t) || (t?.kind === "named" && resources.some(r => r.hash && r.id === t.id));
	if(!["pure", "IO", "EIO", ...(task || stream || immediate ? ["BaseIO"] : [])].includes(effect)) throw new TypeError("unsupported entry effect");
	if((task || stream) && (!admitted(entry.result) || entry.parameters.some(p => !admitted(p.type)))) throw new TypeError("Lean tasks require copied carriers or checked Lean resources");
	if(stream && (entry.protocol?.open !== entry.declaration || !qualified.test(entry.protocol.next) || !qualified.test(entry.protocol.close)
		|| (entry.stepError && !admitted(entry.stepError)))) throw new TypeError("invalid async iterator protocol");
	if((entry.result?.kind === "apply" && !copied(entry.result)) || (effect === "EIO" && !admitted(entry.error)))
		throw new TypeError("returned sums and EIO errors require copied payloads");
	if(!immediate && !task && !stream && effect === "pure" && entry.result?.constructor !== "result") throw new TypeError("expected a returned Except");
	const startError = effect === "EIO" ? returned(resources, entry.error, codecs) : null;
	const asyncOut = stream ? streamCodec(i, entry, returned(resources, entry.result, codecs), startError, entry.stepError ? returned(resources, entry.stepError, codecs) : null)
		: task ? taskCodec(i, returned(resources, entry.result, codecs), startError, entry.taskIO) : null;
	const out = asyncOut ?? returned(resources, effect === "EIO" ? { kind: "apply", constructor: "result", arguments: [entry.result, entry.error] } : entry.result, codecs);
	const symbol = `lb_python_host_invoke_${i}`;
	const hostArgs = args.flatMap((a, j) => a.hostIndex === undefined ? [] : [{ index: a.hostIndex, j }]);
	const conversions = args.map((a, j) => a.hostIndex === undefined
		? `if (!(v[${j}] = ${a.fromPython(`PyTuple_GET_ITEM(args, ${j})`)})) goto done;`
		: `if (!lb_check_host(${a.hostIndex}, PyTuple_GET_ITEM(args, ${j}))) goto done;`);
	if(hostArgs.length)
	{
		conversions.unshift("lb_value *pending_hosts = NULL;");
		for(const { index, j } of hostArgs)
			conversions.push(`if (!(v[${j}] = lb_stage_argument(${index}, PyTuple_GET_ITEM(args, ${j}), &pending_hosts))) goto done;`);
		conversions.push("lb_finish_hosts(&pending_hosts, 1);");
	}
	const values = args.map((a, j) => a.unbox ? `${a.unbox}(v[${j}])` : `v[${j}]`).join(", ");
	const call = `(_root_.${entry.declaration} ${args.map((_, j) => `v${j}`).join(" ")})`;
	const application = stream ? asyncOut.application(call) : call;
	const invoke = effect === "EIO" ? `_root_.EIO.toIO' ${application}` : effect === "pure" ? `pure ${application}` : effect === "BaseIO" ? `liftM ${application}` : application;
	const lean = `${stream ? asyncOut.helpers + "\n" : ""}@[export ${symbol}] def invoke${i} ${args.map((a, j) => `(v${j} : ${a.lean})`).join(" ")} : IO ${out.lean} := ${invoke}`;
	const declarations = [`extern lean_object *${symbol}(${args.map(a => a.c).join(", ") || "void"});`, asyncOut?.declarations].filter(Boolean).join("\n");
	const c = `${asyncOut?.c ?? ""}
static PyObject *lb_invoke_${i}(PyObject *module, PyObject *args) {
    (void)module;
    ${synchronous ? "if (!lb_sync_owner()) return NULL;" : bound ? `if (!lb_active() || !lean_bridge_native_component_ready(LB_COMPONENT)) {
        PyErr_SetString(PyExc_RuntimeError, "enter bind_hosts on this thread before calling this component"); return NULL;
    }` : "if (!lb_prepare()) return NULL;"}
    if (PyTuple_GET_SIZE(args) != ${args.length}) { PyErr_SetString(PyExc_TypeError, "wrong number of arguments to ${entry.name}"); return NULL; }
    ${synchronous ? `${args.length ? `if (!lb_sync_started) {
        ${entry.parameters.map((p, j) => `if (!${args[j].validate?.(`PyTuple_GET_ITEM(args, ${j})`) ?? `lb_convert_${p.type.name}(PyTuple_GET_ITEM(args, ${j}), 0)`}) return NULL;`).join("\n        ")}
    }` : ""}
    if (!lb_prepare()) return NULL;
    lb_sync_started = 1;` : ""}
    ${bound ? "lb_current->depth++; lb_frame frame = {lb_call_frame, NULL}; lb_call_frame = &frame; lb_sweep();" : ""}
    lean_object *v[${Math.max(1, args.length)}] = {0}, *io = NULL; PyObject *result = NULL;
    ${conversions.join("\n    ")}
    io = ${symbol}(${values});
    ${args.flatMap((a, j) => a.unbox ? [] : [`v[${j}] = NULL;`]).join(" ")}
    if (lean_io_result_is_ok(io)) {
        result = ${out.toPython("lean_io_result_get_value(io)")};
    } else {
        lean_object *e = lean_io_result_get_error(io);
        ${bound ? "if (!lb_restore_fault(e))" : ""} {
            lean_inc(e); lean_object *s = lb_python_host_error_text(e);
            PyObject *msg = lb_in_string(s); lean_dec(s);
            if (msg) {
                ${synchronous && effect === "IO" ? `PyObject *type = PyObject_GetAttrString(module, "_io_failure_type");
                if (type) {
                    PyObject *exc = PyObject_CallFunction(type, "sO", "${entry.declaration}", msg);
                    if (exc) { PyErr_SetObject(type, exc); Py_DECREF(exc); }
                    Py_DECREF(type);
                }` : "PyErr_SetObject(PyExc_RuntimeError, msg);"}
                Py_DECREF(msg);
            }
        }
    }
    ${args.length ? "done: ;" : ""}
    /* Sweep before restoring the exception: arbitrary Python destructors may reenter. */
    PyObject *et = NULL, *ev = NULL, *tb = NULL;
    if (!result) PyErr_Fetch(&et, &ev, &tb);
    if (io) lean_dec(io);
    ${args.map((_, j) => `if (v[${j}]) lean_dec(v[${j}]);`).join(" ")}
    ${hostArgs.length ? "lb_finish_hosts(&pending_hosts, 0);\n    " : ""}${bound ? "lb_frame_close(&frame); lb_sweep(); lb_current->depth--;" : ""}
    if (!result) PyErr_Restore(et, ev, tb);
    return result;
}`;
	const params = entry.parameters.map(p => p.name).join(", ");
	const raw = `_native.${entry.name}(${params})`, decoded = out.decode ? out.decode(raw) : raw;
	const python = asyncOut ? `${task ? "async " : ""}def ${entry.name}(${params}):\n${asyncOut.body(raw, entry.declaration)}`
		: `def ${entry.name}(${params}):\n    return ${effect === "EIO" ? `_lb_unwrap("${entry.declaration}", ${decoded})` : decoded}\n`;
	return { lean, c, python, declarations, method: `{"${entry.name}", lb_invoke_${i}, METH_VARARGS, NULL}` };
};

/**
 * Generate both language halves together. Each selected application declaration
 * is independently checked at its exact signature when Lean compiles entryLean.
 *
 * @param options - Reviewed import IR, source module, public entries and verified runtime/component digests.
 */
export const generatePythonHostExtension = options => {
	const { ir, module, entries, runtimeIdentity, componentIdentity, modules = [module] } = options;
	const synchronous = options.synchronousIO === true, syncIO = synchronous && entries.some(e => e.effect === "IO");
	if(synchronous && (ir || entries.some(e => e.delivery || e.taskIO) || !entries.some(e => ["IO", "BaseIO", "EIO"].includes(e.effect))))
		throw new TypeError("Invalid standalone Python IO delivery contract");
	if(!modules.includes(module) || modules.some(m => !qualified.test(m)) || !entries.length || ![runtimeIdentity, componentIdentity].every(d => /^[a-f0-9]{64}$/u.test(d)))
		throw new TypeError("expected a source module, entries, and exact runtime/component identities");
	const provider = ir ? generatePythonHostProvider(ir) : {
		resources: [], lean: "", binder: "from . import _native\n"
		, source: `#define PY_SSIZE_T_CLEAN\n#include <Python.h>\n#include <lean/lean.h>\n${asset("host-scalars.h")}` };
	const owned = taskResourceTypes(options.leanResources), leased = owned.length > 0;
	if(leased && !/^[a-f0-9]{64}$/u.test(options.ledgerId)) throw new TypeError("expected the native resource ledger identity");
	const leaseHeader = leased ? asset("resource-lease.h") : "";
	const leaseNames = owned.map(r => r.name);
	if(leaseNames.some(n => provider.resources.includes(n))) throw new TypeError("colliding host and Lean resource names");
	checkNames(entries, [...provider.resources, ...leaseNames]);
	if(syncIO && [...leaseNames, ...entries.map(e => e.name)].includes("LeanIOError")) throw new TypeError("reserved Python IO error name");
	const imported = ir?.types.filter(r => r.kind === "resource" && r.host?.targets.includes("python")) ?? [];
	const resources = [...imported, ...owned];
	const codecs = new Map(), slots = new Map();
	for(const e of entries) for(const p of e.parameters) if(p.type.kind === "io-callback")
	{
		if(e.delivery !== "task" || ![p.type.argument, p.type.reply].every(t => t?.kind === "primitive" && Object.hasOwn(scalars, t.name)))
			throw new TypeError("expected a retained task callback with copied scalar values");
		slots.set(p, slots.size);
	}
	const callbacks = slots.size > 0, outcomes = callbacks || entries.some(e => e.taskIO);
	const publicNames = [...provider.resources, ...leaseNames, ...entries.map(e => e.name)];
	if((outcomes && publicNames.includes("LeanTaskError")) || (callbacks && publicNames.includes("RetainedCallback")))
		throw new TypeError("reserved Python task name");
	const immediate = synchronous || (!ir && entries.some(row => row.delivery));
	const functions = entries.map((e, i) => e.parameters.some(p => slots.has(p))
		? retainedEntry({ entry: e, i, scalar: t => carrier(resources, t), returned: t => returned(resources, t, codecs), slots, owned })
		: emit(resources, e, i, codecs, synchronous, immediate));
	const callbackCodecs = callbacks ? [...slots].map(([p, id]) => {
		const a = carrier(resources, p.type.argument);
		return `static PyObject *lb_cb_in_${id}(lean_object *v) { return ${a.toPython("v")}; }
static const lb_codec lb_cb_slot_${id} = {lb_cb_in_${id}, lb_out_${p.type.reply.name}};`;
	}).join("\n") + "\nstatic const lb_codec *lb_cb_codec(uint32_t slot) { switch(slot) { "
		+ [...slots.values()].map(id => `case ${id}: return &lb_cb_slot_${id};`).join(" ") + " default: return NULL; } }" : "";
	const tasks = entries.some(e => e.delivery), streams = entries.some(e => e.delivery === "async-iterator");
	const errorTypes = codecs.size || entries.some(e => e.effect === "EIO");
	const entryLean = [
		...modules.map(m => `import ${m}`)
		, ...(callbacks ? ["import Init.System.Promise"] : [])
		, ...(ir ? ["import LeanBridge.Host.Python"] : [])
		, "set_option autoImplicit false", "namespace LeanBridgeHostEntry"
		, "@[export lb_python_host_error_text] def errorText (e : IO.Error) : String := toString e"
		, ...(streams ? [streamEntryLean] : [])
		, ...(callbacks ? [callbackLean] : [])
		, ...functions.map(f => f.lean), "end LeanBridgeHostEntry", ""].join("\n");
	const entryDeclarations = ["extern lean_object *lb_python_host_error_text(lean_object *);"
		, "extern lean_object *initialize_BridgeHostExports(uint8_t);"
		, ...(callbacks ? [callbackPrototypes] : [])
		, ...functions.map(f => f.declarations)].join("\n");
	const source = `${provider.source}
#include "lean_bridge_native_runtime.h"
#define LB_COMPONENT "pyhost:${componentIdentity}"
${entryDeclarations}${leased ? `\n#define LB_PY_LEASE_ABI "lean-bridge/python-resource/${sha256([runtimeIdentity, options.ledgerId, leaseHeader].join("\n"))}"\n${leaseHeader}` : ""}
${synchronous ? `#include <sys/syscall.h>
#include <unistd.h>
static int lb_sync_started;
static int lb_sync_owner(void) {
    if (getpid() == (pid_t)syscall(SYS_gettid) && lean_bridge_native_process_valid()
        && PyThreadState_GetInterpreter(PyThreadState_Get()) == PyInterpreterState_Main()) return 1;
    PyErr_SetString(PyExc_RuntimeError, "synchronous Lean IO requires the original process main thread and interpreter"); return 0;
}` : ""}
static void *lb_init_component(uint8_t b) { return initialize_BridgeHostExports(b); }
static int lb_prepare(void) {${leased ? "\n    if (!lb_resource_context()) return 0;" : ""}
    if (PyThreadState_GetInterpreter(PyThreadState_Get()) != PyInterpreterState_Main()) {
        PyErr_SetString(PyExc_RuntimeError, "this runtime requires the main Python interpreter"); return 0;
    }
    if (!lean_bridge_native_component_initialize(LB_COMPONENT, lb_init_component)) {
        PyErr_SetString(PyExc_RuntimeError, "cannot initialize the Lean component in this process"); return 0;
    }
    return 1;
}
${ir ? `static PyObject *lb_pybind(PyObject *mod, PyObject *args) {
    (void)mod; if (!lb_prepare()) return NULL;
    if (lb_bind(lb_specs, sizeof(lb_specs)/sizeof(lb_specs[0]), args, "${runtimeIdentity}")) return NULL;
    Py_RETURN_NONE;
}
static PyObject *lb_pyunbind(PyObject *mod, PyObject *args) {
    (void)mod; (void)args; if (lb_unbind()) return NULL; Py_RETURN_NONE;
}` : ""}
static PyObject *lb_matches_runtime(PyObject *mod, PyObject *args) {
    (void)mod;
    unsigned long long lean, broker;
    if (!PyArg_ParseTuple(args, "KK", &lean, &broker)) return NULL;
    return PyBool_FromLong(lean == (uintptr_t)&lean_register_external_class
        && broker == (uintptr_t)&lean_bridge_native_component_initialize);
}
${tasks ? asset("../native/task-notification.h") + "\n" + asset("task-delivery.h") : ""}
${streams ? asset("stream-delivery.h") : ""}
${outcomes ? ioOutcome + "\n" : ""}${callbacks ? '#define LB_PORT_NAME LB_COMPONENT ".callback-port-v1"\n#define LB_PORT_KIND "lean-bridge/python-callback-port-v1"\n#define LB_CB_REQUEST lb_py_cb_request\n#define LB_CB_TRACK lb_py_cb_track\n' + asset("../native/task-callback-queue.h") + "\n" + asset("task-callback.h") + "\n" + callbackCodecs + "\n" : ""}${[...codecs.values()].map(f => f.c).join("\n")}
${functions.map(f => f.c).join("\n")}
static PyMethodDef lb_methods[] = {
    ${ir ? '{"_bind", lb_pybind, METH_VARARGS, NULL}, {"_unbind", lb_pyunbind, METH_NOARGS, NULL},' : ""}
    ${tasks ? '{"_task_ready", lb_task_ready, METH_O, NULL}, {"_task_fd", lb_task_descriptor, METH_O, NULL}, {"_task_take", lb_task_take, METH_O, NULL}, {"_task_close", lb_task_close, METH_O, NULL},' : ""}
    ${streams ? '{"_cursor_next", lb_cursor_next, METH_O, NULL}, {"_cursor_close", lb_cursor_close, METH_O, NULL},' : ""}
    ${callbacks ? callbackMethods + "\n    " : ""}${leased ? '{"_matches_ledger", lb_matches_ledger, METH_O, NULL}, ' : ""}{"_matches_runtime", lb_matches_runtime, METH_VARARGS, NULL},
    ${functions.map(f => f.method).join(",\n    ")}, {NULL, NULL, 0, NULL}
};
static PyModuleDef lb_module = { PyModuleDef_HEAD_INIT, "_native", NULL, 0, lb_methods };
PyMODINIT_FUNC PyInit__native(void) { ${leased ? `PyObject *m = PyModule_Create(&lb_module); if (!m) return NULL;
    if (${owned.map(r => `lb_resource_register(m, "${r.hash}", "${r.name}", "LeanBridge.Resources.${r.lean}") < 0`).join(" || ")}
    ) { Py_DECREF(m); return NULL; } return m;` : "return PyModule_Create(&lb_module);"} }
`;
	const render = t => {
		if(t.kind === "io-callback") return `_Callable[[${render(t.argument)}], ${render(t.reply)}]`;
		if(t.kind === "named") return resources.find(r => r.id === t.id).name;
		if(t.kind === "apply" && t.constructor === "result") return `Ok[${render(t.arguments[0])}] | Err[${render(t.arguments[1])}]`;
		return { bool: "bool", char: "str", string: "str", bytes: "bytes", unit: "None", float32: "float", float64: "float" }[t.name] ?? "int";
	};
	const hostNames = provider.resources.join(", ");
	const payload = types => [...new Set(types.filter(Boolean).map(render))].sort().join(" | ") || "object";
	const startPayload = payload(entries.filter(e => e.effect === "EIO").map(e => e.error));
	const stepPayload = payload(entries.filter(e => e.delivery === "async-iterator").map(e => e.stepError));
	const stub = [
		"from typing import ContextManager as _ContextManager"
		, ...(leased ? ["from typing import Literal as _Literal, Protocol as _Protocol, Self as _Self, runtime_checkable as _runtime_checkable"
			, ...owned.map(r => `@_runtime_checkable
class ${r.name}(_Protocol):
    @property
    def _lean_resource_kind(self) -> _Literal["${r.hash}"]: ...
    @property
    def closed(self) -> bool: ...
    def retain(self) -> _Self: ...
    def same_resource(self, other: _Self) -> bool: ...
    def close(self) -> None: ...
    def __enter__(self) -> _Self: ...
    def __exit__(self, *exc: object) -> None: ...
`)] : [])
		, ...(syncIO ? ["class LeanIOError(RuntimeError):\n    declaration: str\n    message: str\n    def __init__(self, declaration: str, message: str) -> None: ...\n"] : [])
		, ...(outcomes ? ["class LeanTaskError(RuntimeError):\n    declaration: str\n"] : [])
		, ...(callbacks ? ["from typing import Callable as _Callable, Generic as _CBGeneric, TypeVar as _CBVar\n_CBArg = _CBVar('_CBArg')\n_CBReply = _CBVar('_CBReply')\nclass RetainedCallback(_CBGeneric[_CBArg, _CBReply]):\n    def __init__(self, callback: _Callable[[_CBArg], _CBReply]) -> None: ...\n    def close(self) -> None: ...\n    def __call__(self, value: _CBArg) -> _CBReply: ...\n"] : [])
		, ...(streams ? [streamStub.replace("payload: object", "payload: " + stepPayload)] : [])
		, ...(errorTypes ? [resultTypes, `class LeanEIOError(Exception):\n    declaration: str\n    payload: ${startPayload}\n    def __init__(self, declaration: str, payload: ${startPayload}) -> None: ...\n`] : [])
		, ...(ir ? [`from .host_types import ${provider.resources.map(n => `${n} as ${n}`).join(", ")}`, `def bind_hosts(*, ${provider.resources.map(n => `${n}: type[${n}]`).join(", ")}) -> _ContextManager[None]: ...`] : [])
		, ...entries.map(e => `${e.delivery === "task" ? "async " : ""}def ${e.name}(${e.parameters.map(p => `${p.name}: ${render(p.type)}`).join(", ")}) -> ${e.delivery === "async-iterator" ? `_LBStream[${render(e.result)}]` : render(e.result)}: ...`)
		, ""
	].join("\n");
	const types = ["from __future__ import annotations", "from typing import Protocol as _Protocol", ""];
	for(const r of imported)
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
	const support = errorTypes ? [
		resultTypes, errorClass, "_lb_error_type = LeanEIOError"
		, "def _lb_unwrap(declaration, value):\n    if isinstance(value, Err):\n        raise LeanEIOError(declaration, value.error)\n    return value.value\n"
		, ...[...codecs.values()].map(f => f.python)].join("\n") : "";
	return {
		hostLean: provider.lean, entryLean, entryDeclarations, source, stub
		, types: types.join("\n")
		, bindingIrSha256: ir ? hashBindingIr(ir) : null
		, python: `${provider.binder}\n${ir ? `from .host_types import ${hostNames}` : ""}${leased ? "\nfrom ._native import " + leaseNames.join(", ") : ""}\n\n${syncIO ? syncIOClass : ""}${support}\n${tasks ? asset("task-await.py") : ""}\n${streams ? asset("stream-await.py") : ""}\n${outcomes ? ioPython + "\n" : ""}${callbacks ? asset("task-callback.py") + "\n" : ""}${functions.map(f => f.python).join("\n")}`
	};
};
