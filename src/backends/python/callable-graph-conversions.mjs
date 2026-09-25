/**
 * Scoped Python conversions and leases over the native recursive value interface.
 *
 * @file
 */
import { generateCopiedPythonGraphConversions } from "./copied-graph-conversions.mjs";
import { compileCallablePythonGraphPackageModel } from "./callable-graph-model.mjs";

const support = `import inspect as _inspect
import os as _os
import threading as _threading

class _GraphCallableFrame:
    def __init__(self):
        self.scope = _GraphScope()
        self.failure = None
        self.thread = _threading.current_thread()
        self.alive = True

    def close(self):
        self.alive = False
        self.scope.close()

def _graph_require_callback(value):
    if (not callable(value) or _inspect.iscoroutinefunction(value)
            or _inspect.isasyncgenfunction(value)
            or _inspect.iscoroutinefunction(getattr(value, "__call__", None))
            or _inspect.isasyncgenfunction(getattr(value, "__call__", None))):
        raise TypeError("Expected a synchronous callable")

def _graph_synchronous(value):
    if _inspect.isawaitable(value):
        if _inspect.iscoroutine(value):
            value.close()
        raise TypeError("Callbacks must return synchronously")
    return value

def _graph_callable_status(status, frame):
    if frame.failure is not None:
        raise frame.failure
    if status == 6:
        raise LeanBridgeError(6, "Host callback failed")
    _graph_status(status)

class _GraphLease:
    def __init__(self, invoke, dispose):
        self.pointer = _c.c_uint64()
        self.invoke = invoke
        self.dispose = dispose
        self.thread = _threading.current_thread()
        self.lock = _threading.RLock()
        self.active = 0
        self.closed = False

    def ensure_open(self):
        _GraphAssets._ensure_process()
        if self.closed:
            raise RuntimeError("Lean closure is closed")
        if _threading.current_thread() is not self.thread:
            raise RuntimeError("Lean closure must be called on its creating thread")

    def _release(self):
        token, self.pointer.value = self.pointer.value, 0
        if token:
            self.dispose(token)

    def __call__(self, *args, **kwargs):
        _GraphAssets._ensure_process()
        with self.lock:
            self.ensure_open()
            self.active += 1
            try:
                return self.invoke(self.pointer.value, *args, **kwargs)
            finally:
                self.active -= 1
                if self.closed and not self.active:
                    self._release()

    def close(self):
        _GraphAssets._ensure_process()
        with self.lock:
            self.closed = True
            if not self.active:
                self._release()

    def __del__(self):
        # A forked child must not enter an inherited native or Python lock.
        try:
            if _os.getpid() == _GraphAssets._PID:
                self.close()
        except BaseException:
            pass

def _graph_own(output, invoke, dispose):
    if not output.value:
        raise _GraphInvalidNative("Native result has a missing Lean closure")
    _graph_checkpoint()
    lease = _GraphLease(invoke, dispose)
    _graph_checkpoint()
    result = object.__new__(LeanClosure)
    result._lease = lease
    # Share one token box until the outer caller commits the transfer. Any
    # failure clears that same box, including the partially wrapped result.
    lease.pointer = output
    return result
`;

/**
 * Emit argument/result conversions, retained borrowed callbacks and owned leases.
 *
 * @param ir - Authenticated public copied and callable signatures.
 */
export const generateCallablePythonGraphConversions = ir => {
	const model = compileCallablePythonGraphPackageModel(ir);
	const generated = generateCopiedPythonGraphConversions(model.payloads.ir);
	const raw = new Map(generated.rawTypes.map(node => [node.id, node.name]));
	const callbacks = [...model.callbacks.values()];
	const imports = [...new Set(["LeanBridgeError", "LeanClosure"
		, ...model.types.flatMap(node => node.kind === "record" ? [node.publicType]
			: node.kind === "variant" ? node.cases.map(branch => branch.publicName)
				: node.kind === "option" ? ["Some"] : node.kind === "result" ? ["Ok", "Err"] : [])])];
	const source = [`from . import ${imports.join(", ")}`
		, "from . import _assets as _GraphAssets", ""
		, generated.source, support];
	for(const [name, result] of [["initialize", "_c.c_uint32"], ["ready", "_c.c_int"], ["retire", "None"]])
		source.push(`_graph_${name} = _GraphAssets._LIBRARY["${model.prefix}_graph_${name}"]`
			, `_graph_${name}.argtypes = []`, `_graph_${name}.restype = ${result}`, "");
	const pointer = node => `_c.POINTER(${raw.get(node.id)})`;
	for(const callback of callbacks)
	{
		const { index, parameters, result } = callback;
		const types = [...parameters, result].map(pointer);
		source.push(`${callback.function} = _c.CFUNCTYPE(_c.c_uint32, _c.c_void_p, ${types.join(", ")})`
			, `class ${callback.raw}(_c.Structure):`
			, `    _fields_ = [("call", ${callback.function}), ("context", _c.c_void_p)]`, ""
			, `_owned${index} = _GraphAssets._LIBRARY["${callback.call}"]`
			, `_owned${index}.argtypes = [_c.c_uint64, ${types.join(", ")}]`
			, `_owned${index}.restype = _c.c_uint32`
			, `_dispose${index} = _GraphAssets._LIBRARY["${callback.dispose}"]`
			, `_dispose${index}.argtypes = [_c.c_uint64]`, `_dispose${index}.restype = None`, ""
			, `def _callback${index}(value, frame):`
			, "    _graph_require_callback(value)"
			, `    def invoke(${["_context", ...parameters.map((_, i) => `arg${i}`), "output"].join(", ")}):`
			, "        try:"
			, "            if not frame.alive or frame.failure is not None or _threading.current_thread() is not frame.thread:"
			, "                return 6"
			, ...parameters.map((node, i) => `            value${i} = _graph_output${node.index}(arg${i}${node.aggregate ? ".contents" : "[0]"}, frame.scope)`)
			, `            result = _graph_synchronous(value(${parameters.map((_, i) => `value${i}`).join(", ")}))`
			, `            converted = _graph_input${result.index}(result, frame.scope)`
			, "            output[0] = converted", "            return 0"
			, "        except BaseException as failure:"
			, "            if isinstance(failure, _GraphInvalidNative): _graph_retire()"
			, "            if frame.failure is None: frame.failure = failure"
			, "            return 6"
			, `    function = ${callback.function}(invoke)`
			, "    frame.scope.owners.append(function)"
			, `    return ${callback.raw}(function, None)`, "");
	}
	const call = (name, symbol, parameters, result, leading = false) => {
		const outputType = result.callback ? "_c.c_uint64" : raw.get(result.node.id);
		const args = parameters.map((_, i) => `arg${i}`);
		const input = (parameter, i, checking) => parameter.callback
			? checking ? `_graph_require_callback(arg${i})` : `_callback${parameter.callback.index}(arg${i}, frame)`
			: `_graph_input${parameter.node.index}(arg${i}, ${checking ? "checked" : "frame.scope"})`;
		source.push(`def ${name}(${[...leading ? ["_self"] : [], ...args].join(", ")}):`
			, "    _GraphAssets._ensure_process()", "    checked = _GraphScope(True)", "    try:"
			, ...parameters.length ? parameters.map((parameter, i) => `        ${input(parameter, i, true)}`) : ["        pass"]
			, "    finally:", "        checked.close()", "    frame = _GraphCallableFrame()"
			, "    output = None", "    try:"
			, ...parameters.map((parameter, i) => `        input${i} = ${!parameter.callback && !parameter.node.aggregate ? `frame.scope.value(${raw.get(parameter.node.id)}, ${input(parameter, i, false)})` : input(parameter, i, false)}`)
			, `        output = frame.scope.value(${outputType})`
			, ...result.node?.kind === "variant" ? ["        output.kind = (1 << 32) - 1"] : []
			, "        _graph_status(_graph_initialize())"
			, `        status = ${symbol}(${[...leading ? ["_self"] : [], ...args.map((_, i) => `_c.byref(input${i})`), "_c.byref(output)"].join(", ")})`
			, "        _graph_callable_status(status, frame)"
			, '        if not _graph_ready(): raise LeanBridgeError(5, "Lean runtime is unavailable")'
			, ...result.callback ? [`        result = _graph_own(output, _invoke${result.callback.index}, _dispose${result.callback.index})`, "        output = None", "        return result"]
				: [`        return _graph_output${result.node.index}(${result.node.aggregate ? "output" : "output.value"}, frame.scope)`]
			, "    except _GraphInvalidNative:", "        _graph_retire()", "        raise"
			, "    finally:", "        try:"
			, ...result.callback ? ["            if output is not None and output.value:", "                token, output.value = output.value, 0", `                _dispose${result.callback.index}(token)`]
				: ["            _graph_clear(output)"]
			, "        finally:", "            frame.close()", "");
	};
	for(const callback of callbacks)
		call(`_invoke${callback.index}`, `_owned${callback.index}`, callback.parameters.map(node => ({ node })), { node: callback.result }, true);
	for(const fn of model.functions)
	{
		source.push(`_fn${fn.index} = _GraphAssets._LIBRARY["${fn.native}"]`
			, `_fn${fn.index}.argtypes = [${[...fn.parameters.map(parameter => parameter.callback ? `_c.POINTER(${parameter.callback.raw})` : pointer(parameter.node)), fn.result.callback ? "_c.POINTER(_c.c_uint64)" : pointer(fn.result.node)].join(", ")}]`
			, `_fn${fn.index}.restype = _c.c_uint32`, "");
		call(`_call${fn.index}`, `_fn${fn.index}`, fn.parameters, fn.result);
	}
	return { model, source: source.join("\n"), rawTypes: generated.rawTypes };
};
