/**
 * Authorize retained resource fields without changing copied-value semantics.
 *
 * @file
 */

/**
 * Check the explicit policy used by compiler requests and owned graph reports.
 *
 * @param policy - Closed author decision, not a type or layout assertion.
 */
export const validateOwnedAggregatePolicy = policy => {
	const keys = ["ownership", "disposal", "fallback", "cycles"];
	if(!policy || ![Object.prototype, null].includes(Object.getPrototypeOf(policy))
		|| Reflect.ownKeys(policy).length !== keys.length
		|| Reflect.ownKeys(policy).some(key => !keys.includes(key))
		|| keys.some(key => !Object.hasOwn(Object.getOwnPropertyDescriptor(policy, key) ?? {}, "value"))
		|| policy.ownership !== "lease" || policy.disposal !== "required"
		|| !["none", "queued-finalizer"].includes(policy.fallback) || policy.cycles !== "reject")
		throw new TypeError("Owned aggregates require explicit lease ownership, required disposal, a none or queued-finalizer fallback, and rejected cycles");
	return policy;
};
