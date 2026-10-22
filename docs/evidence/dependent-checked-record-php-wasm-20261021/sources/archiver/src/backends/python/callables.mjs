/**
 * Typed Python callables and owned Lean closures over the shared native C ABI.
 *
 * @file
 */

/**
 * Resolve either a copied value or an explicitly admitted callable.
 *
 * @param model - Admitted Python projection.
 * @param ref - Canonical type reference.
 */
export const pythonValue = (model, ref) => model.surface.copy(ref) ?? model.surface.callbacks.get(ref.id);
const callback = value => value.type?.kind === "callback";
const ctype = (value, result = false) => callback(value) && result ? "_c.c_void_p" : value.ctype;

/**
 * Public closure API, with no native pointers or untyped dispatcher.
 *
 * @param model - Admitted Python projection.
 * @param stub - Emit type declarations instead of method bodies.
 */
export const pythonClosurePublic = (model, stub) => !model.surface.callbacks.size ? "" : `from typing import Callable as _Callable, Generic as _Generic, ParamSpec as _ParamSpec, TypeVar as _TypeVar
from types import TracebackType as _TracebackType

_P = _ParamSpec("_P")
_R = _TypeVar("_R")

class LeanClosure(_Generic[_P, _R]):
    """A same-thread Lean callable. Use with or close() to release it."""
    __slots__ = ("_lease", "__weakref__")

    def __init__(self) -> None:
        ${stub ? "..." : 'raise TypeError("Lean closures are returned by generated functions")'}

    def __call__(self, *args: _P.args, **kwargs: _P.kwargs) -> _R:
        ${stub ? "..." : "return self._lease(*args, **kwargs)"}

    @property
    def closed(self) -> bool:
        ${stub ? "..." : "return self._lease.closed"}

    def close(self) -> None:
        ${stub ? "..." : "self._lease.close()"}

    def __enter__(self) -> LeanClosure[_P, _R]:
        ${stub ? "..." : "self._lease.ensure_open()\n        return self"}

    def __exit__(self, exc_type: type[BaseException] | None, exc: BaseException | None, traceback: _TracebackType | None) -> None:
        ${stub ? "..." : "self.close()"}

    def __copy__(self):
        ${stub ? "..." : 'raise TypeError("Lean closures cannot be copied")'}

    def __deepcopy__(self, memo):
        ${stub ? "..." : 'raise TypeError("Lean closures cannot be copied")'}

    def __reduce__(self):
        ${stub ? "..." : 'raise TypeError("Lean closures cannot be serialized")'}
`;

/**
 * The C argument type for a Python input site.
 *
 * @param model - Admitted Python projection.
 * @param site - Canonical input ownership site.
 */
export const pythonArgumentType = (model, site) => {
	const value = pythonValue(model, site.type);
	return value.aggregate || callback(value) ? `_c.POINTER(${value.ctype})` : value.ctype;
};

/**
 * Render a native call, keeping scratch, exceptions and output cleanup together.
 *
 * @param model - Admitted Python projection.
 * @param root0 - Generated private call signature.
 * @param root0.name - Python helper name.
 * @param root0.symbol - Configured ctypes entry point.
 * @param root0.parameters - Canonical parameter sites.
 * @param root0.result - Canonical result site.
 * @param root0.leading - Private leading arguments for closure invocation.
 */
export const pythonNativeCall = (model, { name, symbol, parameters, result, leading = [] }) => {
	const output = pythonValue(model, result.type), unit = output.scalarName === "unit";
	return `def ${name}(${[...leading, ...parameters.map((_, i) => `_arg${i}`)].join(", ")}):
    _ensure_process()
    scope = _Scope()
    ${unit ? "" : `output = ${ctype(output, true)}()`}
    error = _Error()
    try:
${parameters.map((site, i) => { const value = pythonValue(model, site.type); return `        input${i} = _${callback(value) ? "callback" : "to"}${value.index}(_arg${i}, scope)`; }).join("\n")}
        _check(${symbol}(${[...leading, ...parameters.map((site, i) => { const value = pythonValue(model, site.type); return value.aggregate || callback(value) ? `_c.byref(input${i})` : `input${i}`; }), ...unit ? [] : ["_c.byref(output)"], "_c.byref(error)"].join(", ")}), error, scope)
        ${callback(output) ? `owned = _own${output.index}(output)\n        output = _c.c_void_p()\n        return owned` : `return ${unit ? "None" : `_from${output.index}(output${output.aggregate ? "" : ".value"}, scope)`}`}
    finally:
        try:
            ${callback(output) ? `_dispose${output.index}(_c.byref(output))` : output.aggregate ? `_clear${output.index}(_c.byref(output))` : "pass"}
        finally:
            scope.close()
`;
};

/**
 * Callback layouts and closure entry points from the public C header.
 *
 * @param model - Admitted Python projection.
 */
export const pythonCallableTypes = model => [...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, output = pythonValue(model, result.type);
	const args = parameters.map(site => pythonArgumentType(model, site)).concat(output.scalarName === "unit" ? [] : [`_c.POINTER(${output.ctype})`], "_c.POINTER(_Error)");
	return `_F${value.index} = _c.CFUNCTYPE(_c.c_int, _c.c_void_p, ${args.join(", ")})
class ${value.ctype}(_c.Structure):
    _fields_ = [("call", _F${value.index}), ("context", _c.c_void_p)]

_owned${value.index} = _LIBRARY["${model.surface.prefix}_owned_${value.field}_call"]
_owned${value.index}.argtypes = [_c.c_void_p, ${args.join(", ")}]
_owned${value.index}.restype = _c.c_int
_dispose${value.index} = _LIBRARY["${model.surface.prefix}_owned_${value.field}_dispose"]
_dispose${value.index}.argtypes = [_c.POINTER(_c.c_void_p)]
_dispose${value.index}.restype = None
`;
}).join("\n");

const leaseSupport = `import inspect as _inspect

class _Lease:
    def __init__(self, invoke, dispose):
        self.pointer = _c.c_void_p()
        self.invoke = invoke
        self.dispose = dispose
        self.thread = _threading.current_thread()
        self.lock = _threading.RLock()
        self.active = 0
        self.closed = False

    def ensure_open(self):
        _ensure_process()
        if self.closed:
            raise RuntimeError("Lean closure is closed")
        if _threading.current_thread() is not self.thread:
            raise RuntimeError("Lean closure must be called on its creating thread")

    def __call__(self, *args, **kwargs):
        _ensure_process()
        with self.lock:
            self.ensure_open()
            self.active += 1
            try:
                return self.invoke(self.pointer, *args, **kwargs)
            finally:
                self.active -= 1
                if self.closed and not self.active:
                    self.dispose(_c.byref(self.pointer))

    def close(self):
        _ensure_process()
        with self.lock:
            self.closed = True
            if not self.active:
                self.dispose(_c.byref(self.pointer))

    def __del__(self):
        # Never enter a possibly inherited native lock in a forked child.
        try:
            if _os.getpid() == _PID:
                self.close()
        except BaseException:
            pass

def _require_callback(value):
    if (not callable(value) or _inspect.iscoroutinefunction(value)
            or _inspect.isasyncgenfunction(value)
            or _inspect.iscoroutinefunction(getattr(value, "__call__", None))
            or _inspect.isasyncgenfunction(getattr(value, "__call__", None))):
        raise TypeError("Expected a synchronous callable")

def _synchronous(value):
    if _inspect.isawaitable(value):
        if _inspect.iscoroutine(value):
            value.close()
        raise TypeError("Callbacks must return synchronously")
    return value
`;

/**
 * Keep ctypes callbacks alive and transfer returned closure ownership once.
 *
 * @param model - Admitted Python projection.
 */
export const pythonCallableSupport = model => !model.surface.callbacks.size ? "" : `${leaseSupport}
${[...model.surface.callbacks.values()].map(value => {
	const { parameters, result } = value.type.callable, output = pythonValue(model, result.type), unit = output.scalarName === "unit";
	return `def _callback${value.index}(value, scope):
    _require_callback(value)
    def invoke(${["_context", ...parameters.map((_, i) => `arg${i}`), ...unit ? [] : ["out"], "_error"].join(", ")}):
        try:
            if scope.failure is not None:
                return 4
            result = _synchronous(value(${parameters.map((site, i) => { const input = pythonValue(model, site.type); return `_from${input.index}(arg${i}${input.aggregate ? ".contents" : ""}, scope)`; }).join(", ")}))
            ${unit ? "" : "out[0] = "}_to${output.index}(result, scope)
            return 0
        except BaseException as failure:
            if scope.failure is None:
                scope.failure = failure
            return 4
    function = _F${value.index}(invoke)
    scope.owners.append(function)
    return ${value.ctype}(function, None)

def _own${value.index}(output):
    if not output.value:
        raise LeanBridgeError(5, "Native result has a missing Lean closure")
    result = object.__new__(LeanClosure)
    result._lease = _Lease(_invoke${value.index}, _dispose${value.index})
    # Share the pointer box until the caller commits the transfer. If wrapping
    # raises, either cleanup path clears the same box, never a duplicate pointer.
    result._lease.pointer = output
    return result

${pythonNativeCall(model, { name: `_invoke${value.index}`, symbol: `_owned${value.index}`, parameters, result, leading: ["_self"] })}`;
}).join("\n")}`;
