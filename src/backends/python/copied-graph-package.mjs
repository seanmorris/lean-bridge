/**
 * Prepared Python APIs over finite copied graphs and authenticated native assets.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateCopiedPythonGraphValues } from "./copied-graph-values.mjs";
import { generateCopiedPythonGraphConversions } from "./copied-graph-conversions.mjs";
import { copiedPythonAssets } from "./copied-assets.mjs";

/**
 * Check graph declarations and loader identities before compiling Lean.
 *
 * @param ir - Compiler-checked finite copied graph contract.
 */
export const compileCopiedPythonGraphPackageModel = ir => {
	const values = generateCopiedPythonGraphValues(ir), { layout } = values, prefix = layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Python graph component name collides with a dependency or exceeds its name limit");
	return { ...values, ir, prefix, layoutSha256: sha256(canonicalJson(layout)) };
};

const functions = model => {
	const nodes = new Map(model.types.map(node => [node.id, node]));
	const definitions = new Map(model.ir.types.map(type => [type.id, type]));
	const aliases = new Map(model.layout.aliases.map(alias => [alias.id, alias]));
	const type = (id, ref, input = false) => {
		const node = nodes.get(id);
		if(ref.kind !== "named") return node[input ? "inputType" : "publicType"];
		const name = definitions.get(ref.id).name;
		return input && aliases.has(ref.id) && node.inputType !== node.publicType ? `${name} | ${node.inputType}` : name;
	};
	return model.functions.map((fn, index) => {
		const root = model.layout.roots.find(root => root.bindingId === fn.bindingId);
		return { ...fn, index, root
			, signature: fn.parameters.map((name, i) => `${name}: ${type(root.parameters[i], fn.declaration.parameters[i].type, true)}`).join(", ")
			, output: type(root.result, fn.declaration.result.type) };
	});
};

const publicSource = (model, exports, calls, stub) => `${model[stub ? "stub" : "source"].replace(/^__all__ = .+$/m, `__all__ = (${exports.map(name => JSON.stringify(name)).join(", ")},)`)}
class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ${stub ? "..." : "super().__init__(message)\n        self.status = status"}

${calls.map(fn => `def ${fn.publicName}(${fn.signature}) -> ${fn.output}:
    ${stub ? "..." : `return _GraphNative._call${fn.index}(${fn.parameters.join(", ")})`}
`).join("\n")}
${stub ? "" : "from . import _native as _GraphNative\n"}`;

const nativeSource = (model, generated, calls) => {
	const raw = new Map(generated.rawTypes.map(node => [node.id, node.name]));
	const imports = [...new Set([
		"LeanBridgeError"
		, ...model.types.flatMap(node => node.kind === "record" ? [node.publicType]
			: node.kind === "variant" ? node.cases.map(branch => branch.publicName)
				: node.kind === "option" ? ["Some"] : node.kind === "result" ? ["Ok", "Err"] : [])])];
	return `from . import ${imports.join(", ")}
from . import _assets as _GraphAssets

${generated.source}
_graph_initialize = _GraphAssets._LIBRARY["${model.prefix}_graph_initialize"]
_graph_initialize.argtypes = []
_graph_initialize.restype = _c.c_uint32
_graph_ready = _GraphAssets._LIBRARY["${model.prefix}_graph_ready"]
_graph_ready.argtypes = []
_graph_ready.restype = _c.c_int
_graph_retire = _GraphAssets._LIBRARY["${model.prefix}_graph_retire"]
_graph_retire.argtypes = []
_graph_retire.restype = None
_graph_lifecycle = (_graph_initialize, _graph_ready, _graph_retire)

${calls.map(fn => `_fn${fn.index} = _GraphAssets._LIBRARY["${fn.name}_graph"]
_fn${fn.index}.argtypes = [${[...fn.root.parameters, fn.root.result].map(id => `_c.POINTER(${raw.get(id)})`).join(", ")}]
_fn${fn.index}.restype = _c.c_uint32

def _call${fn.index}(${fn.parameters.map((_, i) => `arg${i}`).join(", ")}):
    _GraphAssets._ensure_process()
    return _graph_call_${fn.publicName}(_fn${fn.index}${fn.parameters.map((_, i) => `, arg${i}`).join("")}, lifecycle=_graph_lifecycle)
`).join("\n")}`;
};

/**
 * Generate a typed wheel source tree with private scoped conversions and loading.
 *
 * @param ir - Compiler-checked finite copied graph contract.
 * @param evidence - Closed native artifact identities, or null for inspection.
 */
export const generateCopiedPythonGraphPackage = (ir, evidence = null) => {
	const model = compileCopiedPythonGraphPackageModel(ir), generated = generateCopiedPythonGraphConversions(ir);
	const calls = functions(model), exports = ["LeanBridgeError", ...model.exports, ...calls.map(fn => fn.publicName)];
	const { packageDir } = model, publicModule = `${packageDir}/__init__.py`, typeStub = `${packageDir}/__init__.pyi`;
	const files = {
		[publicModule]: publicSource(model, exports, calls, false)
		, [typeStub]: publicSource(model, exports, calls, true)
		, [`${packageDir}/_native.py`]: nativeSource(model, generated, calls)
		, [`${packageDir}/_assets.py`]: `import ctypes as _c\n\n${copiedPythonAssets(evidence)}`
		, [`${packageDir}/py.typed`]: ""
		, "README.md": `# ${packageDir}

Install the prepared platform wheel and import ${packageDir}. It contains the native Lean libraries and loads a compatible shared runtime automatically. Consumers need no Lean compiler or C build tools. Requires GIL-enabled Python 3.11+ on Linux x86-64 with glibc matching the wheel tag. Free-threading, post-fork calls and incompatible runtime identities are rejected. Subinterpreters and other Python implementations have not been accepted.

Records and variant constructors are frozen dataclasses. Construct and match named cases without raw pointers or numeric constructor tags. Arrays and Lists accept lists or tuples and return independently copied tuples. Concrete aliases retain their names. Option[T] is None or Some(value); Some(None) preserves a present Unit or absent inner Option. Result[T,E] is Ok(value) or Err(value), including equal payload types. Domain errors return Err. Binary products keep their nested two-element tuples.

Unit is None. Bool requires bool. Fixed-width integers reject out-of-range values and Boolean/numeric coercion; Nat and Int use exact Python integers. Native words are 64-bit. Float32 rounds a Python float to binary32 and preserves NaN classification, infinities and signed zero. String requires Unicode scalar text and preserves NUL; ByteArray is bytes. Constructors must use the exact generated classes.

Finite copied values may be at most 128 levels deep and visit 262,144 nodes. Arguments and the result share a 16 MiB native-copy budget and a separate 16 MiB accounted conversion-storage budget. These limits do not bound Lean working memory or every Python allocator overhead. Cycles and uninhabited copied values are rejected. Inputs validate before native allocation or runtime initialization; do not mutate them during conversion. Temporary buffers and native results clear in finally, including conversion exceptions. Malformed native output retires the runtime. Input, limit and recoverable allocation failures preserve usability. Independent calls can use separate threads; each call owns its scratch storage.

Deep runtime annotations use TypeAliasType boundaries to keep shared types finite; __value__ exposes their exact targets. Public stubs retain precise recursive types. When container aliases require it, pip automatically installs typing_extensions (>=4.6,<5) on Python 3.11; Python 3.12+ uses the standard library. Callback, closure, resource and asynchronous payloads remain outside this recursive profile.

${calls.map(fn => `- ${packageDir}.${fn.publicName}: ${fn.bindingId}`).join("\n")}
` };
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, generator: { id: "lean-wasm/python-copied-graph", version: 1 }
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, publicModule, typeStub, internalModule: `${packageDir}/_native.py`
		, exports, files: [...Object.keys(files), "binding-manifest.json"]
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive Python packages support finite copied values; callables, resources and asynchronous operations remain outside this profile." }
			, { feature: "additional-platforms", reason: "The accepted native profile is GIL-enabled Python 3.11+ on Linux x86-64." }] }, null, 2)}\n`;
	return Object.freeze(files);
};
