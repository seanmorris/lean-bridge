import { hashBindingIr } from "../binding-ir/canonical.mjs";
import { validateBindingIr } from "../binding-ir/contract.mjs";

/**
 * Reports initialization generation failures with stable machine-readable codes and structured diagnostic context.
 */
export class InitializationGenerationError extends Error
{
	/**
   * Initializes the error used to report initialization generation failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "InitializationGenerationError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new InitializationGenerationError(code, message, details);
};

/**
 * Compiles initialization version 1 into the explicit representation consumed by the generated host-adapter ABI.
 *
 * @param ir - Binding IR document that defines the source types and operations.
 * @param abi - Closed ABI contract defining native symbols, ownership, and adapter semantics for the generated projection.
 */
export const compileInitializationV1 = (ir, abi) => {
	validateBindingIr(ir);
	if(abi === null || typeof abi !== "object" || Array.isArray(abi))
	{
		fail("invalid-initialization-abi", "private ABI must be an object");
	}
	if(
		abi.initialize !== null
    && (typeof abi.initialize !== "string" || abi.initialize.length === 0)
	) {
		fail(
			"invalid-initialization-abi",
			"private ABI initialize must be null or a non-empty symbol",
		);
	}
	return Object.freeze({
		kind: "initialization-v1"
		, abiVersion: 1
		, bindingIrSha256: hashBindingIr(ir)
		, required: abi.initialize !== null
		, symbol: abi.initialize
		, trigger: "first-call"
		, scope: "component-runtime"
		, success: "nonzero"
		, failure: "terminal"
		, retry: "never"
	});
};
