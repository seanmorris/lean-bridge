/**
 * Render compiler-authenticated Lean defaults as ordinary Python values.
 *
 * The public wrapper applies these values before the private full-arity ABI is
 * called. Python's `None` therefore remains an explicit value at call sites:
 * it is Unit or Option.none only when the declared Lean type admits it, and it
 * still reaches the generated validator for every other type.
 *
 * @file
 */

/**
 * Render one canonical Binding IR default.
 *
 * @param value - Canonical default from Binding IR.
 * @param options - Host representation used by the selected Python surface.
 * @param options.taggedOptions - Preserve Option.some with the public `Some`
 * constructor used by ordinary copied packages.
 */
export const renderPythonDefault = (value, { taggedOptions = true } = {}) => {
	if(value.kind === "unit" || value.kind === "option-none") return "None";
	if(value.kind === "boolean") return value.value ? "True" : "False";
	if(value.kind === "integer") return value.value;
	if(value.kind === "string" || value.kind === "char") return JSON.stringify(value.value);
	if(value.kind === "option-some")
	{
		const child = renderPythonDefault(value.value, { taggedOptions });
		return taggedOptions ? `Some(${child})` : child;
	}
	throw new TypeError(`Unsupported canonical Python default kind: ${value.kind}`);
};
