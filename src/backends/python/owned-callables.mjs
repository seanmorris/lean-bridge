/**
 * Call-scoped Python callbacks over the owned C descriptor and reply boundary.
 *
 * @file
 */
import { ownedCallbackRecovery } from "../../build/owned-callback-carriers.mjs";

const support = `import inspect as _inspect

class _OwnedCall:
    def __init__(self, state, scope):
        self.state = state
        self.scope = scope
        self.failure = None
        self.alive = True

    def finish(self, status):
        failure, self.failure = self.failure, None
        if failure is not None:
            raise failure
        _R._owned_checked(status)

    def close(self):
        self.alive = False
        self.failure = None

def _owned_require_callback(value):
    if (not callable(value) or _inspect.iscoroutinefunction(value)
            or _inspect.isasyncgenfunction(value)
            or _inspect.iscoroutinefunction(getattr(value, "__call__", None))
            or _inspect.isasyncgenfunction(getattr(value, "__call__", None))):
        raise TypeError("Expected a synchronous callable")

def _owned_synchronous(value):
    if _inspect.isawaitable(value) or _inspect.isasyncgen(value):
        if _inspect.iscoroutine(value):
            value.close()
        raise TypeError("Callbacks must return synchronously")
    return value
`;

/**
 * Emit typed callbacks after the value layouts and conversion functions.
 *
 * @param c - Checked public C ownership model.
 * @param nodes - Generated Python value layouts.
 * @param models - Bound native calls, including copy and retain helpers.
 */
export const ownedPythonCallbacks = (c, nodes, models) => {
	const lines = [support], layouts = [];
	for(const callback of c.callbacks)
	{
		const node = nodes.get(callback.id), result = nodes.get(callback.result), i = node.index;
		const parameters = callback.parameters.slice(1).map(id => nodes.get(id));
		const automatic = ownedCallbackRecovery(c.native.model, node, id => id) !== null;
		const copy = models.find(fn => (fn.retain || fn.copy) && fn.id === result.id);
		const raw = `_OwnedHost${i}`, pointer = node => node.leaf ? node.raw : `_c.POINTER(${node.raw})`;
		const arguments_ = ["_c.c_void_p", "_c.c_void_p", ...parameters.map(pointer)
			, `_c.POINTER(${result.raw})`, "_c.POINTER(_c.c_void_p)"];
		layouts.push({ name: `${node.cName}_host`, raw, fields: ["call", "context", "closure", "recovery"] });
		lines.push(`_OwnedFunction${i} = _c.CFUNCTYPE(_c.c_uint32, ${arguments_.join(", ")})`
			, `class ${raw}(_c.Structure):`
			, `    _fields_ = [("call", _OwnedFunction${i}), ("context", _c.c_void_p), ("closure", _c.c_void_p), ("recovery", _c.POINTER(${result.raw}))]`, ""
			, `def _owned_host${i}(value, scope, frame=None):`
			, `    scope.enter(None, 0, ${raw})`
			, `    if type(value) is _V.${node.publicType}:`
			, `        handle = _owned_input${i}(value, scope)`
			, "        if scope.check_only: return None"
			, `        descriptor = scope.value(${raw})`, "        descriptor.closure = handle", "        return descriptor"
			, "    recovery = None", "    wrapped = type(value) is _V.WithRecovery"
			, "    if wrapped:", "        function, recovery = value.function, value.recovery"
			, "    else:", "        function = value", "    _owned_require_callback(function)"
			, ...automatic ? [] : ['    if not wrapped: raise TypeError("This callback requires with_recovery(function, value)")']
			, "    if wrapped:", `        recovery = _owned_input${result.index}(recovery, scope)`
			, "    if scope.check_only: return None", `    descriptor = scope.value(${raw})`
			, "    if wrapped:", ...result.leaf ? [`        recovery = scope.value(${result.raw}, recovery)`] : []
			, "        descriptor.recovery = _c.pointer(recovery)"
			, `    def invoke(${["_context", "session", ...parameters.map((_, j) => `arg${j}`), "output", "owner"].join(", ")}):`
			, "        incoming = reply_scope = None"
			, "        try:", "            if not frame.alive or frame.failure is not None: return 10"
			, "            state = frame.state"
			, "            if state.require().value != session or not output or not owner or owner[0]:"
			, '                raise _OwnedInvalidNative("Invalid native callback frame")'
			, "            with _R._OwnedBorrowFrame(state) as borrowed:"
			, "                incoming = _OwnedScope(state, budget=scope.budget)"
			, "                borrowed_output = _OwnedOutput(None, borrowed.lease)"
			, ...parameters.map((parameter, j) => `                value${j} = _owned_output${parameter.index}(${parameter.leaf ? `arg${j}` : `_owned_read(_c.cast(arg${j}, _c.c_void_p).value, ${parameter.raw})`}, incoming, borrowed_output)`)
			, `                reply = _owned_synchronous(function(${parameters.map((_, j) => `value${j}`).join(", ")}))`
			, "                reply_scope = _OwnedScope(state, budget=scope.budget)"
			, `                converted = _owned_input${result.index}(reply, reply_scope)`
			, "                # C owns this reply slot even when Python raises after publication."
			, "                # Snapshot local storage while callback argument borrows are live."
			, `                _R._owned_checked(${copy.native}(state.require(), ${result.leaf ? "converted" : "_c.byref(converted)"}, output, owner))`
			, "                _R._owned_checkpoint()", "                return 0"
			, "        except BaseException as failure:"
			, "            if frame.failure is None: frame.failure = failure", "            return 10"
			, "        finally:", "            if reply_scope is not None: reply_scope.close()"
			, "            if incoming is not None: incoming.close()"
			, "    _R._owned_checkpoint()", `    native = _OwnedFunction${i}(invoke)`
			, "    scope.pin(native)", "    descriptor.call = native", "    return descriptor", "");
	}
	return { source: lines.join("\n"), layouts };
};
