/**
 * Render bounded-integer rejection paths without borrowing stack storage or formatting user text.
 *
 * @file
 */

/**
 * Emit a rejection with literal field/case names and the actual array/list indices.
 * Static paths remain string literals. Indexed paths use leaf-local thread storage sized
 * from the complete format literal and a conservative decimal size_t bound, including NUL.
 *
 * @param options - The failed leaf and the caller's rejection statement.
 * @param options.path - Literal path segments and generated index expressions.
 * @param options.bound - Exact decimal Fin bound.
 * @param options.name - Unique generated C identifier for the failed leaf.
 * @param options.indent - Indentation of the enclosing condition.
 * @param options.reject - Generate a rejection from a C string expression.
 */
export const finDiagnosticRejection = ({ path, bound, name, indent, reject }) => refinementDiagnosticRejection({ path, suffix: ` is not below its Fin ${bound} bound`, name, indent, reject });

/**
 * Emit a leaf's rejection without treating source text as a printf directive.
 *
 * @param options - Failed leaf and rejection renderer.
 * @param options.path - Literal path segments and generated indices.
 * @param options.suffix - Literal diagnostic suffix.
 * @param options.name - Unique generated buffer identifier.
 * @param options.indent - Indentation of the enclosing condition.
 * @param options.reject - Render rejection from a C string expression.
 */
export const refinementDiagnosticRejection = ({ path, suffix, name, indent, reject }) => {
	const indices = path.filter(part => typeof part !== "string").map(part => part.index);
	if(!indices.length) return reject(JSON.stringify(path.join("") + suffix));
	// Source names can contain percent signs. Only generated indices are format directives.
	const format = JSON.stringify(path.map(part => typeof part === "string" ? part.replaceAll("%", "%%") : "%zu").join("") + suffix.replaceAll("%", "%%"));
	const buffer = `${name}_message`;
	return `{
${indent}  static _Thread_local char ${buffer}[sizeof(${format}) + ${indices.length} * 3 * sizeof(size_t)];
${indent}  (void)snprintf(${buffer}, sizeof(${buffer}), ${format}, ${indices.join(", ")});
${indent}  ${reject(buffer)}
${indent}}`;
};
