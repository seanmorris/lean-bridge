/**
 * Generate a two-stage Lean task so callback-capable factories never run on the Python event loop.
 *
 * @file
 */

import { taskCallbackLean } from "../native/task-callback.mjs";
import { pythonHostArguments } from "./worker-methods.mjs";

const cb = p => p.type.kind === "io-callback";
export const callbackLean = taskCallbackLean("lb_py_cb");
/**
 * Emit the native admission path only for packages with checked one-shot binders.
 * Leave previous many-call packages byte-identical.
 *
 * @param template - Owner-side callback broker.
 * @param slots - Native slots for one-shot parameters.
 */
export const budgetHeader = (template, slots) => {
	const scoped = template.replace(/^\/\* BEGIN PYTHON CALLBACK BUDGET \*\/\n([\s\S]*?)^\/\* END PYTHON CALLBACK BUDGET \*\/\n/gmu, slots.size ? "$1" : "");
	return slots.size ? scoped + "\nstatic int lb_cb_once_slot(uint32_t slot) { switch (slot) { "
		+ [...slots].map(i => "case " + i + ":").join(" ") + " return 1; default: return 0; } }\n" : scoped;
};
export const callbackMethods = `{"_cb_open", lb_cb_open, METH_NOARGS, NULL}, {"_cb_fd", lb_cb_fd, METH_O, NULL},
    {"_cb_drain", lb_cb_drain, METH_VARARGS, NULL}, {"_cb_close", lb_cb_close, METH_O, NULL},`;
export const callbackPrototypes = `extern lean_object *lb_py_cb_request(lean_object *, uint32_t, lean_object *, lean_object *);
extern lean_object *lb_py_cb_track(lean_object *, lean_object *);`;
export const ioOutcome = `static PyObject *lb_async_outcome(lean_object *e, PyObject *(*convert)(lean_object *)) {
    lean_object *v = lean_ctor_get(e, 0);
    if (lean_obj_tag(e) == 1) {
        PyObject *p = convert(v); return p ? Py_BuildValue("(iNO)", 1, p, Py_None) : NULL;
    }
    lean_inc(v); lean_object *s = lb_python_host_error_text(v);
    PyObject *msg = lb_in_string(s); lean_dec(s); if (!msg) return NULL;
    PyObject *key = PyLong_FromVoidPtr(v); if (!key) { Py_DECREF(msg); return NULL; }
    return Py_BuildValue("(iNN)", 0, key, msg);
}`;
export const ioPython = `class LeanTaskError(RuntimeError):
    def __init__(self, declaration, message):
        self.declaration = declaration
        super().__init__(message)

def _lb_outcome(outcome, faults, declaration, terminal):
    ok, value, message = outcome
    if ok:
        return value
    if value in faults:
        raise faults[value][0]
    if terminal:
        raise LeanTaskError(declaration, message)
    raise RuntimeError(message)
`;

/**
 * Emit the checked Lean call, both completion converters and the user-facing coroutine.
 *
 * @param options - Concrete export, per-signature conversion functions and private callback slots.
 */
export const retainedEntry = options => {
	const { entry, i, scalar, returned, slots } = options;
	const { parameters, name, declaration, effect } = entry, typed = effect === "EIO";
	if(parameters.some(p => !cb(p) && p.type.kind !== "primitive" && !options.owned?.some(r => p.type.kind === "named" && r.id === p.type.id)))
		throw new TypeError("retained tasks require copied scalar inputs or checked Lean resources");
	const value = returned(entry.result), err = typed && returned(entry.error);
	const params = parameters.map((p, j) => ({ p, j, c: cb(p) ? null : scalar(p.type) }));
	const ordinary = params.filter(x => x.c), callbacks = params.filter(x => !x.c);
	const conversions = pythonHostArguments(ordinary.map(x => x.c), "vals", 1);
	const slot = x => slots.get(x.p);
	const args = params.map(x => x.c ? "v" + x.j : `(cbInvoke port ${slot(x)})`).join(" ");
	const call = `(_root_.${declaration} ${args})`;
	const factory = typed ? `_root_.EIO.toIO' ${call}` : effect === "pure" ? `pure ${call}` : effect === "BaseIO" ? `liftM ${call}` : call;
	const result = entry.taskIO ? `(_root_.Except _root_.IO.Error ${value.lean})` : value.lean;
	const inner = `(_root_.Task ${result})`, start = typed ? `(_root_.Except ${err.lean} ${inner})` : inner;
	const symbol = `lb_python_host_invoke_${i}`;
	const lean = `@[export ${symbol}] def invoke${i} (port : CallbackPort) ${ordinary.map(x => `(v${x.j} : ${x.c.lean})`).join(" ")} : IO (_root_.Task (_root_.Except _root_.IO.Error ${start})) := do
  _root_.IO.asTask (do
    let t : ${start} ← ${factory}
    ${typed ? "if let .ok task := t then cbTrack port task" : "cbTrack port t"}
    return t)`;
	const declarations = `extern lean_object *${symbol}(lean_object *${ordinary.map(x => ", " + x.c.c).join("")});`;
	const c = `static PyObject *cb_value_${i}(lean_object *v) { return ${value.toPython("v")}; }
static PyObject *cb_terminal_${i}(lean_object *v) { return ${entry.taskIO ? `lb_async_outcome(v, cb_value_${i})` : `cb_value_${i}(v)`}; }
static PyObject *cb_started_${i}(lean_object *v) {
    ${typed ? `int ok = lean_obj_tag(v) == 1; lean_object *x = lean_ctor_get(v, 0);
    PyObject *p = ok ? lb_ticket_new(x, cb_terminal_${i}) : ${err.toPython("x")};
    return p ? Py_BuildValue("(iN)", ok, p) : NULL;` : `return lb_ticket_new(v, cb_terminal_${i});`}
}
static PyObject *cb_factory_${i}(lean_object *v) { return lb_async_outcome(v, cb_started_${i}); }
static PyObject *lb_invoke_${i}(PyObject *mod, PyObject *args) {
    (void)mod;
    if (PyTuple_GET_SIZE(args) != ${1 + ordinary.length}) { PyErr_SetString(PyExc_TypeError, "wrong number of task arguments"); return NULL; }
    lean_object *port = lb_cb_start_token(PyTuple_GET_ITEM(args, 0)); if (!port) return NULL;
    lean_object *vals[${Math.max(1, ordinary.length)}] = {0}, *io = NULL; PyObject *ret = NULL;
    ${conversions.setup}
    lean_inc(port); io = ${symbol}(port${ordinary.map((x, k) => ", " + (x.c.unbox ? x.c.unbox + "(vals[" + k + "])" : "vals[" + k + "]")).join("")});
    ${ordinary.flatMap((x, k) => x.c.unbox ? [] : [`vals[${k}] = NULL;`]).join(" ")}
    if (lean_io_result_is_ok(io)) ret = lb_ticket_new(lean_io_result_get_value(io), cb_factory_${i});
    else PyErr_SetString(PyExc_RuntimeError, "could not schedule Lean callback factory");
    ${ordinary.length ? "done:" : ""} if (io) lean_dec(io);
    ${ordinary.map((x, k) => `if (vals[${k}]) lean_dec(vals[${k}]);`).join(" ")}
    ${conversions.rollback}return ret;
}`;
	const python = `async def ${name}(${parameters.map(p => p.name).join(", ")}):
    with _LBCallbacks({${callbacks.map(x => slot(x) + ": " + x.p.name).join(", ")}}${options.scoped?", _lb_binding()":""}) as _scope:
${callbacks.some(x => options.onceSlots?.has(slot(x))) ? "        _scope.callbacks[None] = (_lb_budget_set(), CallbackAlreadyInvoked)\n" : ""}        _outer = _native.${name}(_scope.port${ordinary.map(x => ", " + x.p.name).join("")})
        _t = _lb_outcome(await _lb_await(_outer), _scope.faults, "${declaration}", False)
${typed ? `        if not _t[0]:
            raise _lb_error_type("${declaration}", ${err.decode ? err.decode("_t[1]") : "_t[1]"})
        _t = _t[1]
` : ""}        _raw = await _lb_await(_t)
${entry.taskIO ? `        _raw = _lb_outcome(_raw, _scope.faults, "${declaration}", True)
` : ""}        return ${value.decode ? value.decode("_raw") : "_raw"}
`;
	return { lean, c, declarations, python, method: `{"${name}", lb_invoke_${i}, METH_VARARGS, NULL}` };
};
