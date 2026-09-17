/**
 * Implements the build error module in the build subsystem.
 *
 * @file
 */

/**
 * Reports canonical build failures with stable machine-readable codes and structured diagnostic context.
 */
export class CanonicalBuildError extends Error
{
	/**
   * Initializes the error used to report canonical build failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param root0 - Named initialization options and dependency overrides for the new instance.
   * @param root0.hint - Actionable remediation attached to the structured failure.
   * @param root0.details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, { hint = null, details = {} } = {})
	{
		super(message);
		this.name = "CanonicalBuildError";
		this.code = code;
		this.hint = hint;
		this.details = details;
	}
}

/**
 * Keep reviewed declarations out of source-only compiler admission.
 *
 * @param inventory - Captured project inputs, before starting any build tools.
 */
export const assertSourceBuildInputs = inventory => {
	const paths = inventory.inputs.filter(input => input.path.endsWith(".binding-ir.json")).map(input => input.path).sort();
	if(paths.length) throw new CanonicalBuildError("reviewed-ir-build-unsupported"
		, "Ordinary builds require fresh Lean metadata, not a supplied Binding IR; reviewed contracts currently support analysis only"
		, { details: { paths }, hint: "Use analyze to validate the reviewed contract. To build from source, keep reviewed documents outside the source project and express supported export decisions in lean-bridge.exports.json." });
};
