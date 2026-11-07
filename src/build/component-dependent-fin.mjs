/**
 * Render the component-boundary check for a Fin whose bound is an earlier Nat argument.
 *
 * The complete Lean wrapper retains the proof-producing guard, but it cannot report a
 * failed raw component call: a failed guard there evaluates the wrapper's fallback.
 * Component adapters therefore reject the concrete pair before calling Lean.
 *
 * @file
 */

/**
 * Return an inline C guard for one dependent Fin, or null for another refinement kind.
 *
 * @param refinement - Compiler-authenticated parameter refinement.
 * @param index - Refined parameter index.
 * @param parameters - Private component parameter types.
 * @param rejectionCleanup - Ownership cleanup executed before refusal.
 * @param status - Component protocol refusal status.
 * @param value - Render one decoded Nat argument as a borrowed C expression.
 */
export const componentDependentFinGuard = (
	refinement, index, parameters, rejectionCleanup, status
	, value = position => `a${position}`
) => {
	if(refinement?.kind !== "fin-parameter") return null;
	const bound = refinement.parameter;
	if(!Number.isInteger(bound) || bound < 0 || bound >= index
		|| parameters[index]?.name !== "nat" || parameters[bound]?.name !== "nat")
		throw new TypeError("Invalid component dependent Fin refinement");
	return `  if (!lean_nat_dec_lt(${value(index)}, ${value(bound)})) { ${rejectionCleanup} return ${status}; }`;
};
