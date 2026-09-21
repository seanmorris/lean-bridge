/**
 * Generate typed public Python APIs and private scoped native calls.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { compileCopiedPythonModel } from "./copied-model.mjs";
import { copiedPythonAssets } from "./copied-assets.mjs";
import { copiedPythonConversions, copiedPythonHelpers, copiedPythonTypes } from "./copied-conversions.mjs";
import { pythonValue, pythonClosurePublic, pythonArgumentType, pythonNativeCall, pythonCallableTypes, pythonCallableSupport } from "./callables.mjs";
import { pythonCompoundNames, pythonCompoundPublic } from "./compounds.mjs";

const names = model => ["LeanBridgeError", ...model.surface.callbacks.size ? ["LeanClosure"] : [], ...pythonCompoundNames(model), ...model.surface.copies.filter(copy => copy.record || copy.variant).flatMap(copy => [copy.publicName, ...copy.variant ? copy.cases.map(branch => branch.publicName) : []]), ...model.surface.aliases.map(alias => alias.definition.name), ...model.surface.functions.map(fn => fn.field)];
const publicType = (model, ref, input = false) => {
	const value = pythonValue(model, ref), alias = ref.kind === "named" && model.surface.aliases.find(item => item.definition.id === ref.id);
	if(!alias) return value[input ? "inputType" : "publicType"];
	return input && value.inputType !== value.publicType ? `${alias.definition.name} | ${value.inputType}` : alias.definition.name;
};
const publicAliases = model => !model.surface.aliases.length ? "" : `\nfrom typing import TypeAlias as _TypeAlias

${model.surface.aliases.map(alias => `${alias.definition.name}: _TypeAlias = ${alias.copy.publicType}`).join("\n")}`;
const publicSource = (model, stub = false) => `from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = (${names(model).map(name => JSON.stringify(name)).join(", ")},)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ${stub ? "..." : "super().__init__(message)\n        self.status = status"}

${pythonClosurePublic(model, stub)}
${pythonCompoundPublic(model)}
${model.surface.copies.some(copy => copy.variant) ? "from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias\n\n" : ""}${model.surface.copies.filter(copy => copy.record || copy.element || copy.variant).map(copy => copy.element ? `${copy.inputType} = ${copy.inputExpression}\n` : copy.variant ? `${copy.cases.map((branch, i) => `@_dataclass(frozen=True, slots=True)
class ${branch.publicName}:
    kind: _ClassVar[_Literal[${JSON.stringify(copy.variant.cases[i].name)}]] = ${JSON.stringify(copy.variant.cases[i].name)}
${branch.fields.map((field, j) => `    ${field.publicName}: ${publicType(model, copy.variant.cases[i].fields[j].type, true)}`).join("\n")}
`).join("\n")}
${copy.publicName}: _TypeAlias = ${copy.cases.map(branch => branch.publicName).join(" | ")}
` : `@_dataclass(frozen=True, slots=True)
class ${copy.publicName}:
${copy.fields.length ? copy.fields.map((field, index) => `    ${field.name}: ${publicType(model, copy.record.fields[index].type, true)}`).join("\n") : "    pass"}
`).join("\n")}${publicAliases(model)}
${model.surface.functions.map((fn, index) => `def ${fn.field}(${fn.parameters.map((parameter, i) => `${parameter.name}: ${publicType(model, fn.declaration.parameters[i].type, true)}`).join(", ")}) -> ${publicType(model, fn.declaration.result.type)}:
    ${stub ? "..." : `return _native._call${index}(${fn.parameters.map(parameter => parameter.name).join(", ")})`}
`).join("\n")}
${stub ? "" : "from . import _native\n"}`;

const nativeSource = (model, evidence) => `import ctypes as _c
from . import ${names(model).filter(name => ["LeanBridgeError", "LeanClosure", "Some", "Ok", "Err"].includes(name) || model.surface.copies.some(copy => copy.publicName === name || copy.variant && copy.cases.some(branch => branch.publicName === name))).join(", ")}

${copiedPythonAssets(evidence)}
${copiedPythonTypes(model)}
${copiedPythonHelpers}
${pythonCallableTypes(model)}
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `_clear${copy.index} = _LIBRARY["${copy.name}_clear"]
_clear${copy.index}.argtypes = [_c.POINTER(${copy.ctype})]
_clear${copy.index}.restype = None`).join("\n")}
${model.surface.functions.map((fn, index) => `_fn${index} = _LIBRARY["${fn.name}"]
_fn${index}.argtypes = [${fn.declaration.parameters.map(site => pythonArgumentType(model, site)).concat(fn.resultType === "void" ? [] : [`_c.POINTER(${model.surface.callbacks.has(fn.declaration.result.type.id) ? "_c.c_void_p" : model.surface.copy(fn.declaration.result.type).ctype})`]).concat("_c.POINTER(_Error)").join(", ")}]
_fn${index}.restype = _c.c_int`).join("\n")}

${copiedPythonConversions(model)}
${pythonCallableSupport(model)}
${model.surface.functions.map((fn, index) => pythonNativeCall(model, { ...fn.declaration, name: `_call${index}`, symbol: `_fn${index}` })).join("\n")}`;

/**
 * Render copied bindings; compiled wheel assembly supplies native evidence.
 *
 * @param model - Admitted Python projection.
 * @param evidence - Optional verified native library inventory.
 */
export const renderCopiedPythonPackage = (model, evidence = null) => {
	const { packageDir } = model, publicModule = `${packageDir}/__init__.py`, typeStub = `${packageDir}/__init__.pyi`;
	const files = { [publicModule]: publicSource(model)
		, [typeStub]: publicSource(model, true)
		, [`${packageDir}/_native.py`]: nativeSource(model, evidence)
		, [`${packageDir}/py.typed`]: ""
		, "README.md": `# ${packageDir}\n\nInstall the prepared platform wheel and import ${packageDir}. Native Lean libraries and runtime loading are included. No Lean compiler or extension build is needed by consumers. Python 3.11+, Linux x86-64 with glibc matching the wheel tag.\n\nUnit is None in every position. Fixed-width integers are range checked; Nat and Int use exact Python integers. Boolean and numeric coercions are rejected. Float32 rounds a Python float to binary32, preserving NaN classification, infinities and signed zero. String is strict Unicode str, including NUL; ByteArray is bytes. Arrays accept tuples or lists and return tuples. Records are frozen dataclasses; nested copied values remain independent.\n\nTypes must be pure, acyclic and at most 32 levels deep. Python conversions and native input/output copies each have a 16 MiB budget. Python array conversions count at least eight bytes per element, and strings account for encoding/decoding. These limits do not bound the Lean algorithm's working memory. Native outputs are cleared in finally even if conversion raises. Calls can run on separate threads with independent scratch; do not mutate an input during its conversion. Compatible packages share a synchronized loader and native runtime. Free-threading and post-fork calls are rejected; subinterpreters and other Python implementations have not been accepted.\n\n${model.surface.functions.map(fn => `- ${packageDir}.${fn.field}: ${fn.declaration.id}`).join("\n")}\n` };
	files["README.md"] += "\nOption[T] is None or Some(value). Some(None) preserves a present Unit or absent inner Option; nested options retain every layer. Result[T, E] is Ok(value) or Err(value), including when both payload types match. These generated wrappers are frozen dataclasses with a value field. Domain errors return Err, not exceptions. Binary products use exact two-element tuples and retain their nesting. Copies can contain these types, arrays and records; resources and callbacks cannot be hidden in them.\n\nSynchronous primitive host callbacks accept typed Python callables. Returned Lean closures are callable LeanClosure values: use a with block or close(), and invoke them on their creating thread. close() is idempotent and defers disposal during active reentry. Garbage collection is a fallback. Callback exceptions return as the original Python exception after native cleanup; later invocations in that call are suppressed. Callback values use the same checked primitive conversions and share the call's copy budgets. Host callbacks are borrowed only for the exporting call. Async or retained host callbacks, callable containers, resources and other effects are not enabled by this adapter.\n";
	if(model.surface.copies.some(copy => copy.ref.kind === "apply" && copy.ref.constructor === "list"))
		files["README.md"] += "\nLean List values accept exact Python lists or tuples and return independent tuples, including nested copied values. Order, duplicates and empty Lists are preserved. List and Array retain distinct contract identities. List callback payloads remain unsupported.\n";
	if(model.surface.copies.some(copy => copy.variant))
		files["README.md"] += "\nCopied Lean variants export one frozen, slotted dataclass per constructor, with the variant name as a type union. Construct named cases and use isinstance or structural pattern matching to inspect them. The class-level kind string retains the Lean constructor name; conversion selects the constructor by its exact generated class, never by a supplied numeric tag or arbitrary kind attribute. Payload fields use snake_case, with reserved names gaining a trailing underscore. Only the active case is converted. Empty constructors and Unit payloads stay distinct. Results own independent copied storage. Variant payloads may contain supported copied records and containers; recursive, callable and identity-bearing payloads remain unsupported.\n";
	if(model.surface.aliases.length)
		files["README.md"] += "\nConcrete copied Lean aliases export named Python TypeAlias declarations in both the module and its type stub. Aliases reuse their target values and validation without NewType wrappers. Aliased arrays and Lists retain tuple-or-list inputs and return independent tuples. Aliased records remain the same frozen dataclass. An alias of Nat still rejects negative input. Recursive and identity-bearing alias targets, and compound callable payloads remain unsupported.\n";
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: { id: "lean-wasm/python-copied", version: 1 }, component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), publicModule, typeStub, internalModule: `${packageDir}/_native.py`, exports: names(model), files: [...Object.keys(files), "binding-manifest.json"], capabilityGaps: [{ feature: "additional-identity-and-effects", reason: "Ordinary PyPI packages admit copied values and synchronous primitive callables; other identity and effect shapes remain unsupported." }, { feature: "additional-platforms", reason: "The accepted native profile is GIL-enabled Python 3.11+ on Linux x86-64." }] }, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generate one closed ordinary Python API from compiler-derived semantics.
 *
 * @param ir - Authoritative Binding IR.
 * @param evidence - Optional compiled artifact inventory.
 */
export const generateCopiedPythonPackage = (ir, evidence = null) => renderCopiedPythonPackage(compileCopiedPythonModel(ir), evidence);
