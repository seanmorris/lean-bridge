/**
 * Render compiler-owned top-level refinements around a generated Lean source call.
 * Runtime ABIs carry Fin values as Nat; only this checked adapter constructs Fin.
 *
 * @file
 */

const refinements = (item, count) => item.refinements ?? {
	parameters: Array.from({ length: count }, () => null)
	, result: null
};

/**
 * Build the source-level call and retain the guards needed to construct refined inputs.
 *
 * @param item - Validated compiler export.
 * @param arguments_ - Source-level argument expressions after transport decoding.
 */
export const componentRefinedCall = (item, arguments_) => {
	const selected = refinements(item, arguments_.length);
	const parameters = arguments_.map((argument, index) => selected.parameters[index] === null
		? argument : `⟨${argument}, _bridgeFin${index}⟩`);
	const application = `${item.sourceApplication ? `(${item.sourceApplication})` : `_root_.${item.sourceDeclaration}`}${parameters.length ? ` ${parameters.join(" ")}` : ""}`;
	return {
		call: selected.result === null ? application : `(${application}).val`
		, guards: selected.parameters.flatMap((refinement, index) => refinement === null ? [] : [{
			bound: refinement.bound
			, proof: `_bridgeFin${index}`
			, value: arguments_[index]
		}])
	};
};

/**
 * Nest decidable refinement guards around a successful and rejected expression.
 *
 * @param guards - Guards returned by componentRefinedCall.
 * @param success - Expression evaluated only after every guard succeeds.
 * @param rejected - Expression returned when a runtime value violates its refinement.
 */
export const componentRefinementGuards = (guards, success, rejected) => {
	let body = success;
	for(let index = guards.length - 1; index >= 0; --index)
	{
		const guard = guards[index];
		body = `if ${guard.proof} : (${guard.value}) < ${guard.bound} then\n  ${body.replaceAll("\n", "\n  ")}\nelse\n  ${rejected}`;
	}
	return body;
};
