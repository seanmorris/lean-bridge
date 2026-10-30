/**
 * Public lossless Python sum types for copied options and results.
 *
 * @file
 */

/**
 * Public constructors and aliases required by this package's copied types.
 *
 * @param model - Admitted Python projection.
 */
export const pythonCompoundNames = model => [
	...model.surface.copies.some(copy => copy.compound === "option")
		? [...model.taggedOptions ? ["None_"] : [], "Some", "Option"] : []
	, ...model.surface.copies.some(copy => copy.compound === "result") ? ["Ok", "Err", "Result"] : []
];

/**
 * Emit immutable tagged values rather than collapsing nested optional states.
 *
 * @param model - Admitted Python projection.
 */
export const pythonCompoundPublic = model => {
	const names = pythonCompoundNames(model);
	if(!names.length) return "";
	return `from typing import Generic as _Generic, TypeVar as _TypeVar

_T = _TypeVar("_T", covariant=True)
_E = _TypeVar("_E", covariant=True)

${names.includes("None_") ? `@_dataclass(frozen=True, slots=True)
class None_:
    pass

` : ""}${["Some", "Ok", "Err"].filter(name => names.includes(name)).map(name => `@_dataclass(frozen=True)
class ${name}(_Generic[${name === "Err" ? "_E" : "_T"}]):
    value: ${name === "Err" ? "_E" : "_T"}
`).join("\n")}
${names.includes("Option") ? names.includes("None_")
	? "Option = None_ | Some[_T]\n" : "Option = Some[_T] | None\n" : ""}
${names.includes("Result") ? "Result = Ok[_T] | Err[_E]\n" : ""}`;
};
