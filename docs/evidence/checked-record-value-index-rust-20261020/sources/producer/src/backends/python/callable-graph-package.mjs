/**
 * Prepared Python APIs for typed recursive callbacks and owned closures.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { copiedPythonAssets } from "./copied-assets.mjs";
import { pythonClosurePublic } from "./callables.mjs";
import { generateCallablePythonGraphConversions } from "./callable-graph-conversions.mjs";

const closureSource = (model, stub) => `from typing import Never as _Never\n${pythonClosurePublic({ surface: { callbacks: model.callbacks } }, stub)}`
	.replace("def __copy__(self):", "def __copy__(self) -> _Never:")
	.replace("def __deepcopy__(self, memo):", "def __deepcopy__(self, memo: dict[int, object]) -> _Never:")
	.replace("def __reduce__(self):", "def __reduce__(self) -> _Never:");

const publicSource = (model, stub) => `${model[stub ? "stub" : "source"].replace(/^__all__ = .+$/m, `__all__ = (${model.exports.map(name => JSON.stringify(name)).join(", ")},)`)}
class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ${stub ? "..." : "super().__init__(message)\n        self.status = status"}

${closureSource(model, stub)}
${[...model.callbacks.values()].map(callback => `${callback.publicName}: _TypeAlias = ${callback.callableType}`).join("\n")}

${model.functions.map(fn => `def ${fn.publicName}(${fn.signature}) -> ${fn.result.annotation}:
    ${stub ? "..." : `return _GraphNative._call${fn.index}(${fn.parameters.map(parameter => parameter.name).join(", ")})`}
`).join("\n")}
${stub ? "" : "from . import _native as _GraphNative\n"}`;

/**
 * Generate a source tree backed by the authenticated native callback carrier.
 *
 * @param ir - Checked copied and callable Binding IR.
 * @param evidence - Verified original native artifacts, or null for inspection.
 */
export const generateCallablePythonGraphPackage = (ir, evidence = null) => {
	const { model, source } = generateCallablePythonGraphConversions(ir);
	const { packageDir } = model, publicModule = `${packageDir}/__init__.py`, typeStub = `${packageDir}/__init__.pyi`;
	const files = {
		[publicModule]: publicSource(model, false)
		, [typeStub]: publicSource(model, true)
		, [`${packageDir}/_native.py`]: source
		, [`${packageDir}/_assets.py`]: `import ctypes as _c\n\n${copiedPythonAssets(evidence)}`
		, [`${packageDir}/py.typed`]: ""
		, "README.md": `# ${packageDir}

Install the prepared platform wheel and import ${packageDir}. The wheel loads its compatible shared Lean runtime automatically. Consumers need no Lean compiler or C build tools. The native profile requires GIL-enabled Python 3.11+ on Linux x86-64 with glibc matching the wheel tag. Free-threading, post-fork calls and incompatible runtime identities are rejected.

Records and variant constructors are frozen dataclasses. Arrays and Lists accept lists or tuples and return independent tuples. Option[T] is None or Some(value), preserving Some(None). Result[T,E] is Ok(value) or Err(value). Binary products keep their nested tuples. Recursive constructors and concrete aliases retain their names. Private native pointers and constructor numbers are not part of the public API.

Pass a synchronous Python callable to a callback parameter. Each invocation receives independently copied values. Exceptions and invalid callback results unwind the active Lean call and reach the original Python caller. Async functions and awaitable results are rejected. Borrowed callbacks expire when the exporting call returns; a Lean closure cannot extend that borrow.

Returned LeanClosure values own their captured Lean values. Use them in a with block or call close(). Repeated close is safe. Invocation belongs to the creating thread's lifetime, not a reusable OS thread ID. Closing during a reentrant invocation releases the capture after the active call finishes. Copying and serialization are rejected. Finalization provides fallback cleanup.

Finite copied values may be at most 128 levels deep and visit 262,144 nodes. Each native call shares a 16 MiB copy budget across its inputs, callbacks and result. Python conversion storage has its own 16 MiB accounted budget. Cycles and uninhabited copied values are rejected. Temporary values clear on failure. Malformed native output retires the runtime; input validation, callback exceptions and recoverable allocation failures preserve usability. Same-thread nested calls are bounded to 64 active native invocations. Owned closures share the native runtime's 4,096-identity capacity. These bounds do not limit Lean working memory or every Python allocator overhead.

Python int preserves exact Nat and Int values. Fixed-width integers reject out-of-range values and Boolean coercion. Native words are 64-bit. Strings require Unicode scalar text and preserve NUL; ByteArray is bytes. Float32 rounds to binary32. Unit is None. Recursive runtime type aliases use TypeAliasType boundaries. Pip installs typing_extensions (>=4.6,<5) on Python 3.11 when needed; Python 3.12+ uses the standard library. Identity-bearing copied fields, asynchronous operations, subinterpreters and other platforms are outside this profile.

${model.functions.map(fn => `- ${packageDir}.${fn.publicName}: ${fn.declaration.id}`).join("\n")}
` };
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, generator: { id: "lean-wasm/python-callable-graph", version: 1 }
		, component: ir.component.id, bindingIrSha256: hashBindingIr(ir)
		, publicModule, typeStub, internalModule: `${packageDir}/_native.py`
		, exports: model.exports
		, files: [...Object.keys(files), "binding-manifest.json"]
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive copied fields cannot contain resource or callable identities; asynchronous operations remain outside this profile." }
			, { feature: "additional-platforms", reason: "The accepted native profile is GIL-enabled Python 3.11+ on Linux x86-64." }] }, null, 2)}\n`;
	return Object.freeze(files);
};
