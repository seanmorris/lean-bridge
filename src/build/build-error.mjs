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
