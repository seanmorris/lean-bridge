/**
 * Implements the frontend module in the binding IR subsystem.
 *
 * @file
 */

import { validateBindingIr } from "./contract.mjs";

/**
 * Reports Binding IR frontend failures with stable machine-readable codes and structured diagnostic context.
 */
export class BindingIrFrontendError extends Error
{
	/**
   * Initializes the error used to report Binding IR frontend failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "BindingIrFrontendError";
		this.code = code;
		this.details = Object.freeze({ ...details });
	}
}

const fail = (code, message, details = {}) => {
	throw new BindingIrFrontendError(code, message, details);
};

const deepFreeze = value => {
	if(value !== null && typeof value === "object" && !Object.isFrozen(value))
	{
		Object.freeze(value);
		for(const child of Object.values(value)) deepFreeze(child);
	}
	return value;
};

/**
 * Wraps an analyzer with producer identity checks, Binding IR validation, and deep freezing at the frontend boundary.
 *
 * @param root0 - Named inputs and dependency overrides used to create binding IR frontend.
 * @param root0.producerId - Stable identifier for the producer.
 * @param root0.adapter - Boundary adapter that validates identities and translates calls between projected and native representations.
 * @param root0.adapterVersion - Stable adapter revision recorded as Binding IR frontend provenance.
 * @param root0.analyze - Injected analyzer used to inspect a project without coupling the caller to its implementation.
 */
export const createBindingIrFrontend = ({
	producerId
	, adapter
	, adapterVersion
	, analyze
}) => {
	if(typeof producerId !== "string" || producerId.length === 0)
	{
		fail("invalid-frontend", "producerId must be a non-empty string");
	}
	if(typeof adapter !== "string" || adapter.length === 0)
	{
		fail("invalid-frontend", "adapter must be a non-empty string");
	}
	if(!Number.isSafeInteger(adapterVersion) || adapterVersion < 1)
	{
		fail("invalid-frontend", "adapterVersion must be a positive integer");
	}
	if(typeof analyze !== "function")
	{
		fail("invalid-frontend", "analyze must be a function");
	}

	return Object.freeze({
		producerId
		, adapter
		, adapterVersion
		, analyze:
			/**
       * Runs the injected analyzer, verifies its declared producer matches this frontend, and returns deeply frozen Binding IR.
       *
       * @param input - Frontend input containing the project facts used to derive Binding IR.
       */
			async function(input) {
				const candidate = await analyze(input);
				validateBindingIr(candidate);
				const producer = candidate.producers.find(item => item.id === producerId);
				if(!producer)
				{
					fail("missing-producer", `binding IR does not declare producer ${producerId}`, {
						producerId
					});
				}
				if(producer.adapter !== adapter || producer.adapterVersion !== adapterVersion)
				{
					fail("frontend-version", `binding IR producer ${producerId} does not match its frontend`, {
						producerId
						, expected: { adapter, adapterVersion }
						, actual: {
							adapter: producer.adapter
							, adapterVersion: producer.adapterVersion
						}
					});
				}
				return deepFreeze(structuredClone(candidate));
			}
	});
};
