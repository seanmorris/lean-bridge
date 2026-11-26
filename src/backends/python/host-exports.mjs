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
import { pythonHostArguments, pythonWorkerMethods } from "./worker-methods.mjs";
import { streamCodec, streamEntryLean, streamStub } from "./stream-exports.mjs";
import { iteratorEntryLean } from "../native/pull-entry.mjs";
import { budgetHeader, callbackLean, callbackMethods, callbackPrototypes, ioOutcome, ioPython, retainedEntry } from "./task-callback.mjs";
import {pythonHostRecords} from "./host-records.mjs";

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
		, fromPython: arg => `lb_host_result(${i}, ${arg}, NULL)`
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
		, python: `def _lb_result_${n}(raw):\n    if _lb_builtins.type(raw) is not _lb_builtins.tuple or _lb_builtins.len(raw) != 2 or _lb_builtins.type(raw[0]) is not _lb_builtins.bool:\n        _native._invalid_result()\n    return Ok(${decode(ok, "raw[1]")}) if raw[0] else Err(${decode(err, "raw[1]")})\n`
		, c: `static PyObject *lb_result_${n}(lean_object *v) {
    /* Lean Except.error is constructor 0; Except.ok is constructor 1. Both own a boxed payload. */
    if (lean_is_scalar(v) || !lean_is_ctor(v) || lean_obj_tag(v) > 1 || lean_ctor_num_objs(v) != 1)
        return lb_invalid_result(NULL, NULL);
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
const resultTypes = `import builtins as _lb_builtins
from dataclasses import dataclass as _dataclass
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
const payload = (t, host = null) => t?.kind === "primitive" ? Object.hasOwn(scalars, t.name)
	: t?.kind === "named" ? host?.some(r => !r.hash && r.id === t.id) === true
		: t?.kind === "apply" && t.constructor === "result" && t.arguments?.length === 2 && t.arguments.every(v => payload(v, host));
const delivered = (t, resources, scoped = false) => payload(t, scoped ? resources : null) || (t?.kind === "named" && resources.some(r => r.hash && r.id === t.id));
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
const emit = (resources, entry, i, codecs, synchronous, immediate, scoped, custom = {}) => {
	const args = custom.args ?? entry.parameters.map(p => carrier(resources, p.type));
	const effect = entry.effect ?? "IO", task = entry.delivery === "task", stream = ["iterator","async-iterator"].includes(entry.delivery);
	const bound = resources.some(r => !r.hash) && !task && !stream;
	if(!["pure", "IO", "EIO", ...(task || stream || immediate ? ["BaseIO"] : [])].includes(effect)) throw new TypeError("unsupported entry effect");
	if((task || stream) && entry.parameters.some(p => !delivered(p.type, resources,scoped))) throw new TypeError("Lean tasks require copied carriers or checked Lean resources" + (scoped ? " or a declared Python object" : ""));
	if(stream && (entry.protocol?.open !== entry.declaration || !qualified.test(entry.protocol.next) || !qualified.test(entry.protocol.close)
		|| (entry.stepError && !delivered(entry.stepError, resources,scoped)))) throw new TypeError("invalid async iterator protocol");
	if(!immediate && !task && !stream && effect === "pure" && entry.result?.constructor !== "result") throw new TypeError("expected a returned Except");
	const startError = effect === "EIO" ? returned(resources, entry.error, codecs) : null;
	const asyncOut = stream ? streamCodec(i, entry, returned(resources, entry.result, codecs), startError, entry.stepError ? returned(resources, entry.stepError, codecs) : null)
		: task ? taskCodec(i, returned(resources, entry.result, codecs), startError, entry.taskIO) : null;
	const out = custom.out ?? asyncOut ?? returned(resources, effect === "EIO" ? { kind: "apply", constructor: "result", arguments: [entry.result, entry.error] } : entry.result, codecs);
	const symbol = `lb_python_host_invoke_${i}`;
	const conversions = pythonHostArguments(args, "v", 0);
	const values = args.map((a, j) => a.unbox ? `${a.unbox}(v[${j}])` : `v[${j}]`).join(", ");
	const call = custom.call ?? `(_root_.${entry.declaration} ${args.map((_, j) => `v${j}`).join(" ")})`;
	const application = stream ? asyncOut.application(call) : call;
	const invoke = effect === "EIO" ? `_root_.EIO.toIO' ${application}` : effect === "pure" ? `pure ${application}` : effect === "BaseIO" ? `liftM ${application}` : application;
	const lean = `${stream ? asyncOut.helpers + "\n" : ""}@[export ${symbol}] def invoke${i} ${args.map((a, j) => `(v${j} : ${a.lean})`).join(" ")} : IO ${out.lean} := ${invoke}`;
	const declarations = [`extern lean_object *${symbol}(${args.map(a => a.c).join(", ") || "void"});`, asyncOut?.declarations].filter(Boolean).join("\n");
	const c = `${asyncOut?.c ?? ""}
static PyObject *lb_invoke_${i}(PyObject *module, PyObject *args) {
    (void)module;
    ${synchronous ? "if (!lb_sync_owner()) return NULL;" : bound ? `if (!lb_active()) {
        PyErr_SetString(PyExc_RuntimeError, "enter bind_hosts on this thread before calling this component"); return NULL;
    }
    if (!lean_bridge_native_component_ready(LB_COMPONENT)) {
        PyErr_SetString(PyExc_RuntimeError, "Lean runtime unavailable"); return NULL;
    }` : "if (!lb_prepare()) return NULL;"}
    if (PyTuple_GET_SIZE(args) != ${args.length}) { PyErr_SetString(PyExc_TypeError, "wrong number of arguments to ${entry.name}"); return NULL; }
    ${synchronous ? `${args.length ? `if (!lb_sync_started) {
        ${entry.parameters.map((p, j) => `if (!${args[j].validate?.(`PyTuple_GET_ITEM(args, ${j})`) ?? `lb_convert_${p.type.name}(PyTuple_GET_ITEM(args, ${j}), 0)`}) return NULL;`).join("\n        ")}
    }` : ""}
    if (!lb_prepare()) return NULL;
    lb_sync_started = 1;` : ""}
    ${bound ? (custom.collect?'if (lb_current->depth >= 64) { PyErr_SetString(PyExc_RecursionError,"Lean host call nesting limit"); return NULL; }\n    ':"")+"lb_current->depth++; lb_frame frame = {lb_call_frame, NULL}; lb_call_frame = &frame; "+(custom.collect?"lb_closures_collect(0); ":"")+"lb_sweep();" : ""}
    lean_object *v[${Math.max(1, args.length)}] = {0}, *io = NULL; PyObject *result = NULL;
    ${conversions.setup}
    ${bound ? 'if (!lean_bridge_native_component_ready(LB_COMPONENT)) { PyErr_SetString(PyExc_RuntimeError,"Lean runtime retired during argument conversion"); goto done; }' : ""}
    io = ${symbol}(${values});
    ${args.flatMap((a, j) => a.unbox ? [] : [`v[${j}] = NULL;`]).join(" ")}
    ${bound ? 'if (!lean_bridge_native_component_ready(LB_COMPONENT)) { PyErr_SetString(PyExc_RuntimeError,"Lean runtime retired during host dispatch"); goto done; }' : ""}
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
    ${args.length || bound ? "done: ;" : ""}
    /* Sweep before restoring the exception: arbitrary Python destructors may reenter. */
    PyObject *et = NULL, *ev = NULL, *tb = NULL;
    if (!result) PyErr_Fetch(&et, &ev, &tb);
    if (io) lean_dec(io);
    ${args.map((_, j) => `if (v[${j}]) lean_dec(v[${j}]);`).join(" ")}
    ${conversions.rollback}${bound ? "lb_frame_close(&frame); lb_sweep(); lb_current->depth--;" : ""}
    if (!result) PyErr_Restore(et, ev, tb);
    else if (!lean_bridge_native_component_ready(LB_COMPONENT)) {
        Py_DECREF(result); PyErr_SetString(PyExc_RuntimeError,"Lean runtime retired during result cleanup"); return NULL;
    }
    return result;
}`;
	const params = entry.parameters.map(p => p.name).join(", ");
	const raw = `_native.${entry.name}(${custom.pythonArgs ?? params})`, decoded = out.decode ? out.decode(raw) : raw;
	const python = asyncOut ? `${task ? "async " : ""}def ${entry.name}(${params}):\n${asyncOut.body(raw, entry.declaration)}`
		: `def ${entry.name}(${params}):\n    ${custom.factory?"_lb_closure_owner()\n    ":""}return ${effect === "EIO" ? `_lb_unwrap("${entry.declaration}", ${decoded})` : decoded}\n`;
	return { lean, c, python, declarations, method: `{"${entry.name}", lb_invoke_${i}, METH_VARARGS, NULL}` };
};

// Use the same argument staging, host-error restoration and reentry frame as
// ordinary synchronous exports. Lean typechecks both the factory and invocation.
const closureEntry=(resources,e,i,codecs,immediate,scoped)=>{
	if(e.delivery || e.effect!=="IO") throw new TypeError("expected a synchronous IO closure factory");
	const arg=carrier(resources,e.result.argument),reply=carrier(resources,e.result.reply);
	if([arg,reply].some(t=>t.validate)) throw new TypeError("host closures do not admit Lean resource leases");
	const method="_apply_closure_"+i;
	const codec={
		lean: `(${arg.lean} → _root_.IO ${reply.lean})`
		, c: "lean_object *"
		, fromPython: v=>`lb_closure_borrow(${i},${v})`
		, toPython: v=>`lb_closure_new(${i},${v})`
		, decode: v=>`LeanClosure._from_lean(${v}, _native.${method})`
	};
	const factory=emit(resources,e,i,codecs,false,immediate,scoped,{out: codec,collect: true,factory: true});
	const invoke=emit(resources,{name: method,declaration: e.declaration,effect: "IO",parameters: [{name: "fn"},{name: "value"}],result: e.result.reply},
		"apply"+i,codecs,false,immediate,scoped,{args: [codec,arg],out: reply,call: "(v0 v1)",collect: true});
	return {...factory,...Object.fromEntries(["lean","c","declarations","method"].map(key=>[key,factory[key]+(key==="method"?",\n":"\n")+invoke[key]]))};
};
/**
 * Generate both language halves together. Each selected application declaration
 * is independently checked at its exact signature when Lean compiles entryLean.
 *
 * @param options - Reviewed import IR, source module, public entries and verified runtime/component digests.
 */
export const generatePythonHostExtension = options => {
	const { ir, module, entries, runtimeIdentity, componentIdentity, modules = [module] } = options;
	const scoped = options.pythonTaskObjects === true;
	if(scoped && (!ir || !entries.some(e=>e.delivery))) throw new TypeError("Expected checked Python object worker entries");
	const synchronous = options.synchronousIO === true, syncIO = synchronous && entries.some(e => e.effect === "IO");
	const cursors=entries.some(e=>e.delivery==="iterator");
	if(cursors && !synchronous) throw new TypeError("Immediate cursors require a synchronous owner");
	if(synchronous && (ir || entries.some(e => (e.delivery && e.delivery!=="iterator") || e.taskIO) || !(cursors || entries.some(e => ["IO", "BaseIO", "EIO"].includes(e.effect)))))
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
	const render = t => {
		if(t.kind === "host-record") return t.declaration.split(".").at(-1);
		if(t.kind === "io-closure") return `LeanClosure[${render(t.argument)}, ${render(t.reply)}]`;
		if(t.kind === "io-callback") return `_Callable[[${render(t.argument)}], ${render(t.reply)}]`;
		if(t.kind === "named") return resources.find(r => r.id === t.id).name;
		if(t.kind === "apply" && t.constructor === "result") return `Ok[${render(t.arguments[0])}] | Err[${render(t.arguments[1])}]`;
		return { bool: "bool", char: "str", string: "str", bytes: "bytes", unit: "None", float32: "float", float64: "float" }[t.name] ?? "int";
	};
	const records = pythonHostRecords(entries, t => carrier(resources, t), render, keywords);
	if(records.names.length)
	{
		const names = [...provider.resources, ...leaseNames, ...records.names];
		if(!ir || synchronous || scoped || entries.some(e => e.delivery) || new Set(names).size !== names.length
			|| records.names.some(n => ["LeanClosure", "LeanIOError", "RuntimeError", "TypeError", "object", "tuple"].includes(n)))
			throw new TypeError("Expected unambiguous synchronous Python host record classes");
		checkNames(entries, names);
	}
	const closures=entries.some(e=>e.result?.kind==="io-closure");
	if(closures && (!imported.length || [...provider.resources,...leaseNames,...entries.map(e=>e.name)].includes("LeanClosure")))
		throw new TypeError("returned host closures require Python host classes and the reserved LeanClosure type");
	for(const e of entries)
	{
		// Async object conversion requires the authenticated binding. Workers never dispatch Python.
		// Check both async generator paths, including retained callback factories.
		if(e.delivery)
		{
			if(!delivered(e.result, resources, scoped) || (e.effect === "EIO" && !delivered(e.error, resources, scoped)))
				throw new TypeError("Lean tasks require copied carriers or checked Lean resources" + (scoped ? " or a declared Python object" : ""));
		}
		else if((e.result?.kind === "apply" && !payload(e.result, imported))
			|| (e.effect === "EIO" && !payload(e.error, imported) && !delivered(e.error, owned)))
			throw new TypeError("returned sums and EIO errors require copied payloads or declared synchronous host objects");
	}
	const codecs = new Map(), slots = new Map(), onceSlots = new Set();
	const contract = options.callbackContract;
	for(const e of entries) for(const [index,p] of e.parameters.entries()) if(p.type.kind === "io-callback")
	{
		if(e.delivery !== "task" || ![p.type.argument, p.type.reply].every(t => t?.kind === "primitive" && Object.hasOwn(scalars, t.name) || scoped && t?.kind==="named" && imported.some(r=>r.id===t.id)))
			throw new TypeError("expected a retained task callback with copied scalar values" + (scoped ? " or declared Python objects" : ""));
		if(contract)
		{
			const d = contract.declarations.find(d => d.source.declaration === e.declaration);
			const site = d?.parameters[index], type = contract.types.find(t => t.id === site?.type.id);
			if(type?.kind !== "callback" || !["once","many"].includes(type.callable.invocation))
				throw new TypeError("Expected the checked callback contract for " + e.declaration);
			if(type.callable.invocation === "once") onceSlots.add(slots.size);
		}
		slots.set(p, slots.size);
	}
	const callbacks = slots.size > 0, outcomes = callbacks || entries.some(e => e.taskIO);
	const publicNames = [...provider.resources, ...leaseNames, ...entries.map(e => e.name)];
	if(onceSlots.size && publicNames.includes("CallbackAlreadyInvoked")) throw new TypeError("reserved Python callback budget error name");
	const budgetClass = onceSlots.size ? 'from builtins import set as _lb_budget_set\nclass CallbackAlreadyInvoked(RuntimeError):\n    """This task registration has already admitted its one callback."""\n\n' : "";
	const streamIO = entries.some(e => e.stepIO);
	if(streamIO && publicNames.includes("LeanStreamIOError")) throw new TypeError("reserved Python stream error name");
	if((outcomes && publicNames.includes("LeanTaskError")) || (callbacks && publicNames.includes("RetainedCallback")))
		throw new TypeError("reserved Python task name");
	const immediate = synchronous || ((!ir || scoped) && entries.some(row => row.delivery));
	const functions = entries.map((e, i) => e.parameters.some(p => slots.has(p))
		? retainedEntry({ entry: e, i, scalar: t => carrier(resources, t), returned: t => returned(resources, t, codecs), slots, onceSlots, owned: scoped?resources:owned, scoped })
		: e.result?.kind==="io-closure"?closureEntry(resources,e,i,codecs,immediate,scoped)
			: emit(resources, e, i, codecs, synchronous, immediate, scoped,{collect: closures, ...records.lower(e)}));
	const callbackCodecs = callbacks ? [...slots].map(([p, id]) => {
		const a = carrier(resources, p.type.argument);
		const b=carrier(resources,p.type.reply);
		return `static PyObject *lb_cb_in_${id}(lean_object *v) { return ${a.toPython("v")}; }
${b.hostIndex===undefined?"":`static lean_object *lb_cb_out_${id}(PyObject *v) {return ${b.fromPython("v")};}\n`}static const lb_codec lb_cb_slot_${id} = {lb_cb_in_${id}, ${b.hostIndex===undefined?"lb_out_"+p.type.reply.name:"lb_cb_out_"+id}};`;
	}).join("\n") + "\nstatic const lb_codec *lb_cb_codec(uint32_t slot) { switch(slot) { "
		+ [...slots.values()].map(id => `case ${id}: return &lb_cb_slot_${id};`).join(" ") + " default: return NULL; } }" : "";
	const tasks = entries.some(e => e.delivery && e.delivery!=="iterator"), streams = entries.some(e => e.delivery === "async-iterator");
	const worker = scoped ? pythonWorkerMethods(entries, streams, callbacks) : null;
	const errorTypes = codecs.size || entries.some(e => e.effect === "EIO");
	const entryLean = [
		...modules.map(m => `import ${m}`)
		, ...(callbacks ? ["import Init.System.Promise"] : [])
		, ...(ir ? ["import LeanBridge.Host.Python"] : [])
		, "set_option autoImplicit false", "namespace LeanBridgeHostEntry"
		, "@[export lb_python_host_error_text] def errorText (e : IO.Error) : String := toString e"
		, ...(streams ? [streamEntryLean] : [])
		, ...(cursors ? [iteratorEntryLean] : [])
		, ...(callbacks ? [callbackLean] : [])
		, ...functions.map(f => f.lean), "end LeanBridgeHostEntry", ""].join("\n");
	const entryDeclarations = ["extern lean_object *lb_python_host_error_text(lean_object *);"
		, "extern lean_object *initialize_BridgeHostExports(uint8_t);"
		, ...(callbacks ? [callbackPrototypes] : [])
		, ...functions.map(f => f.declarations)].join("\n");
	const source = `#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include "lean_bridge_native_runtime.h"
#define LB_COMPONENT "pyhost:${componentIdentity}"
${provider.source}${closures?"\n"+asset("host-closures.h"):""}
${codecs.size ? `static PyObject *lb_invalid_result(PyObject *mod, PyObject *unused) {
    (void)mod; (void)unused; lean_bridge_native_runtime_retire();
    PyErr_SetString(PyExc_RuntimeError, "invalid native Lean result; runtime retired"); return NULL;
}` : ""}
${scoped?asset("worker-binding.h"):""}
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
    ${scoped?'if (lb_worker_cookie) {PyErr_SetString(PyExc_RuntimeError,"component already has a host binding");return NULL;} PyObject *cookie=PyObject_CallNoArgs((PyObject *)&PyBaseObject_Type);if (!cookie) return NULL;':""}
    if (lb_bind(lb_specs, sizeof(lb_specs)/sizeof(lb_specs[0]), args, "${runtimeIdentity}")) {${scoped?"Py_DECREF(cookie);":""} return NULL;}
    ${scoped?"lb_worker_cookie=cookie;":""}
    Py_RETURN_NONE;
}
static PyObject *lb_pyunbind(PyObject *mod, PyObject *args) {
    (void)mod; (void)args; ${closures?`if (!lb_active() || lb_current->depth) {
        PyErr_SetString(PyExc_RuntimeError,"cannot close an inactive, foreign or executing host binding"); return NULL;
    }
    lb_closures_closing=1; lb_current->depth++; lb_closures_collect(1); lb_sweep(); lb_current->depth--; lb_closures_closing=0;
    `:""}if (lb_unbind()) return NULL; ${scoped?"Py_CLEAR(lb_worker_cookie);":""} Py_RETURN_NONE;
}` : ""}
${scoped?`static PyObject *lb_may_unbind(PyObject *mod, PyObject *unused) {
    (void)mod;(void)unused;if (!lb_worker_active()) return NULL;
    if (lb_current->depth) {PyErr_SetString(PyExc_RuntimeError,"cannot close a binding in its own callback or member");return NULL;}
    Py_RETURN_NONE;
}
static PyObject *lb_worker_sweep(PyObject *mod, PyObject *unused) {
    (void)mod;(void)unused;if (!lb_worker_active()) return NULL;
    lb_current->depth++;lb_sweep();lb_current->depth--;Py_RETURN_NONE;
}`:""}
static PyObject *lb_matches_runtime(PyObject *mod, PyObject *args) {
    (void)mod;
    unsigned long long lean, broker;
    if (!PyArg_ParseTuple(args, "KK", &lean, &broker)) return NULL;
    return PyBool_FromLong(lean == (uintptr_t)&lean_register_external_class
        && broker == (uintptr_t)&lean_bridge_native_component_initialize);
}
${scoped?"#define LB_SCOPED_CALLBACKS 1\n#define PyCapsule_New lb_worker_cap":""}
${tasks ? asset("../native/task-notification.h") + "\n" + asset("task-delivery.h") : ""}
${cursors ? "#define LB_IMMEDIATE_CURSOR 1\n" : ""}${streams || cursors ? asset("stream-delivery.h") : ""}
${outcomes ? ioOutcome + "\n" : ""}${callbacks ? '#define LB_PORT_NAME LB_COMPONENT ".callback-port-v1"\n#define LB_PORT_KIND "lean-bridge/python-callback-port-v1"\n#define LB_CB_REQUEST lb_py_cb_request\n#define LB_CB_TRACK lb_py_cb_track\n' + asset("../native/task-callback-queue.h") + "\n" + budgetHeader(asset("task-callback.h"), onceSlots) + "\n" + callbackCodecs + "\n" : ""}${[...codecs.values()].map(f => f.c).join("\n")}
${records.c ? records.c + "\n" : ""}${functions.map(f => f.c).join("\n")}
${worker?"#undef PyCapsule_New\n"+worker:""}
static PyMethodDef lb_methods[] = {${closures?'\n    {"_close_closure", lb_closure_close, METH_O, NULL}, {"_closure_closed", lb_closure_closed, METH_O, NULL},':""}
    ${codecs.size ? '{"_invalid_result", lb_invalid_result, METH_NOARGS, NULL},' : ""}
    ${scoped?'{"_may_unbind", lb_may_unbind, METH_NOARGS, NULL}, {"_worker_sweep", lb_worker_sweep, METH_NOARGS, NULL},':""}
    ${ir ? '{"_bind", lb_pybind, METH_VARARGS, NULL}, {"_unbind", lb_pyunbind, METH_NOARGS, NULL},' : ""}
    ${tasks ? '{"_task_ready", lb_task_ready, METH_O, NULL}, {"_task_fd", lb_task_descriptor, METH_O, NULL}, {"_task_take", lb_task_take, METH_O, NULL}, {"_task_close", lb_task_close, METH_O, NULL},' : ""}
    ${streams || cursors ? '{"_cursor_next", lb_cursor_next, METH_O, NULL}, {"_cursor_close", lb_cursor_close, METH_O, NULL},' : ""}
    ${cursors ? '{"_cursor_owner", lb_cursor_owner, METH_NOARGS, NULL},' : ""}
    ${callbacks ? callbackMethods + "\n    " : ""}${leased ? '{"_matches_ledger", lb_matches_ledger, METH_O, NULL}, ' : ""}{"_matches_runtime", lb_matches_runtime, METH_VARARGS, NULL},
    ${functions.map(f => f.method).join(",\n    ")}, {NULL, NULL, 0, NULL}
};
static PyModuleDef lb_module = { PyModuleDef_HEAD_INIT, "_native", NULL, 0, lb_methods };
PyMODINIT_FUNC PyInit__native(void) { ${leased ? `PyObject *m = PyModule_Create(&lb_module); if (!m) return NULL;
    if (${owned.map(r => `lb_resource_register(m, "${r.hash}", "${r.name}", "LeanBridge.Resources.${r.lean}") < 0`).join(" || ")}
    ) { Py_DECREF(m); return NULL; } return m;` : "return PyModule_Create(&lb_module);"} }
`;
	const hostNames = provider.resources.join(", ");
	const payloadUnion = types => [...new Set(types.filter(Boolean).map(render))].sort().join(" | ") || "object";
	const startPayload = payloadUnion(entries.filter(e => e.effect === "EIO").map(e => e.error));
	const stepPayload = payloadUnion(entries.filter(e => e.protocol).map(e => e.stepError));
	const stub = [
		scoped ? "class _LBHostBinding:\n    def __enter__(self) -> None: ...\n    def __exit__(self, *exc: object) -> None: ...\n    async def __aenter__(self) -> None: ...\n    async def __aexit__(self, *exc: object) -> None: ...\n" : "from typing import ContextManager as _ContextManager"
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
		, ...(closures ? ["from typing import Generic as _FnGeneric, TypeVar as _FnVar, Self as _FnSelf, Never as _FnNever\n_FnA = _FnVar('_FnA')\n_FnR = _FnVar('_FnR')\nclass LeanClosure(_FnGeneric[_FnA, _FnR]):\n    def __new__(cls, _: _FnNever, /) -> _FnSelf: ...\n    def __call__(self, value: _FnA, /) -> _FnR: ...\n    @property\n    def closed(self) -> bool: ...\n    def close(self) -> None: ...\n    def __enter__(self) -> _FnSelf: ...\n    def __exit__(self, *exc: object) -> None: ...\n"] : [])
		, ...(syncIO ? ["class LeanIOError(RuntimeError):\n    declaration: str\n    message: str\n    def __init__(self, declaration: str, message: str) -> None: ...\n"] : [])
		, ...(outcomes ? ["class LeanTaskError(RuntimeError):\n    declaration: str\n"] : [])
		, ...(onceSlots.size ? ["class CallbackAlreadyInvoked(RuntimeError): ...\n"] : [])
		, ...(callbacks ? ["from typing import Callable as _Callable, Generic as _CBGeneric, TypeVar as _CBVar\n_CBArg = _CBVar('_CBArg')\n_CBReply = _CBVar('_CBReply')\nclass RetainedCallback(_CBGeneric[_CBArg, _CBReply]):\n    def __init__(self, callback: _Callable[[_CBArg], _CBReply]) -> None: ...\n    def close(self) -> None: ...\n    def __call__(self, value: _CBArg) -> _CBReply: ...\n"] : [])
		, ...(streams ? [streamStub.replace("payload: object", "payload: " + stepPayload)] : [])
		, ...(cursors ? [asset("sync-iterator.pyi").replace("payload: object","payload: "+stepPayload)] : [])
		, ...(streamIO ? ["class LeanStreamIOError(RuntimeError):\n    declaration: str\n    def __init__(self, declaration: str, message: str) -> None: ...\n"] : [])
		, ...(errorTypes ? [resultTypes, `class LeanEIOError(Exception):\n    declaration: str\n    payload: ${startPayload}\n    def __init__(self, declaration: str, payload: ${startPayload}) -> None: ...\n`] : [])
		, ...(ir ? [`from .host_types import ${provider.resources.map(n => `${n} as ${n}`).join(", ")}`, `def bind_hosts(*, ${provider.resources.map(n => `${n}: type[${n}]`).join(", ")}) -> ${scoped ? "_LBHostBinding" : "_ContextManager[None]"}: ...`] : [])
		, ...records.stubs
		, ...entries.map(e => `${e.delivery === "task" ? "async " : ""}def ${e.name}(${e.parameters.map(p => `${p.name}: ${render(p.type)}`).join(", ")}) -> ${e.delivery === "iterator" ? `_LBIterator[${render(e.result)}]` : e.delivery === "async-iterator" ? `_LBStream[${render(e.result)}]` : render(e.result)}: ...`)
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
	const callableClass = closures ? `
from typing import Generic as _FnGeneric, TypeVar as _FnVar
_FnA, _FnR = _FnVar("_FnA"), _FnVar("_FnR")
${scoped?"_lb_closure_owner = _lb_binding":`
from contextvars import ContextVar as _ClosureContext
_lb_scope_var = _ClosureContext(__name__ + ".closure_binding", default=None)
class _LBClosureScope:
    __slots__ = ("classes", "open", "token")

    def __init__(self, classes):
        self.classes, self.open, self.token = classes, False, None

    def __enter__(self):
        if self.classes is None:
            raise RuntimeError("binding has already been used")
        _native._bind(*self.classes)
        try:
            self.token = _lb_scope_var.set(self)
        except BaseException:
            _native._unbind()
            raise
        self.classes, self.open = None, True

    def __exit__(self, *exc):
        if _lb_closure_owner() is not self:
            raise RuntimeError("cannot close another host binding")
        # Reset first: a copied context cannot consume the creator's token.
        _lb_scope_var.reset(self.token)
        self.open = False
        try:
            _native._unbind()
        except BaseException:
            self.token = _lb_scope_var.set(self)
            self.open = True
            raise
        self.token = None

def _lb_closure_owner():
    scope = _lb_scope_var.get()
    if scope is None or not scope.open:
        raise RuntimeError("Lean closure requires its active host binding context")
    return scope

def bind_hosts(*, ${hostNames}):
    return _LBClosureScope((${hostNames},))
`}

class LeanClosure(_FnGeneric[_FnA, _FnR]):
    """A returned Lean function, valid until closed or the surrounding binding exits."""
    __slots__ = ("__ticket", "__apply")

    def __new__(cls, *args, **kwargs):
        raise TypeError("LeanClosure values are returned by Lean functions")

    @classmethod
    def _from_lean(cls, ticket, apply):
        self = object.__new__(cls)
        self.__ticket, self.__apply = ticket, apply
        return self

    def __call__(self, value, /):
        _lb_closure_owner()
        return self.__apply(self.__ticket, value)

    def close(self):
        if not self.closed:
            _lb_closure_owner()
        _native._close_closure(self.__ticket)

    @property
    def closed(self):
        return _native._closure_closed(self.__ticket)

    def __reduce_ex__(self, protocol):
        raise TypeError("cannot copy or pickle a bound Lean closure")

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
` : "";
	const support = records.python + callableClass + (errorTypes ? [
		resultTypes, errorClass, "_lb_error_type = LeanEIOError"
		, "def _lb_unwrap(declaration, value):\n    if isinstance(value, Err):\n        raise LeanEIOError(declaration, value.error)\n    return value.value\n"
		, ...[...codecs.values()].map(f => f.python)].join("\n") : "");
	return {
		hostLean: provider.lean, entryLean, entryDeclarations, source, stub
		, types: types.join("\n")
		, bindingIrSha256: ir ? hashBindingIr(ir) : null
		, python: `${scoped?"from . import _native\n"+asset("worker-binding.py")+"\ndef bind_hosts(*, "+hostNames+"):\n    return _LBHostBinding(("+hostNames+",))\n":provider.binder}\n${ir ? `from .host_types import ${hostNames}` : ""}${leased ? "\nfrom ._native import " + leaseNames.join(", ") : ""}\n\n${syncIO ? syncIOClass : ""}${support}\n${tasks ? asset("task-await.py") : ""}${scoped ? "\n_LBWait._binding = staticmethod(_lb_binding)\n" : ""}\n${streams ? asset("stream-await.py") : cursors ? asset("sync-iterator.py") : ""}${streamIO ? "\nclass LeanStreamIOError(RuntimeError):\n    def __init__(self, declaration, message):\n        self.declaration = declaration\n        super().__init__(message)\n" : ""}\n${outcomes ? ioPython + "\n" : ""}${callbacks ? budgetClass + asset("task-callback.py") + "\n" : ""}${functions.map((f,i) => (scoped ? ({task: "@_lb_bound_task\n", "async-iterator": "@_lb_bound_stream\n"}[entries[i].delivery] ?? "@_lb_bound_call\n") : "")+f.python).join("\n")}`
	};
};
