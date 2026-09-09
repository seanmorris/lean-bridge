/**
 * Load only the installed public package and validate this example's input range.
 *
 * @file
 */

export type LeanComponent = typeof import("onboarding-small");
export interface Inputs { left: string; right: string; text: string; }
export interface Answer { sum: string; empty: boolean; }

/** ESM shares this initialization across concurrent imports in one realm. */
export const loadLean = (): Promise<LeanComponent> => import("onboarding-small");

/** Parse nonnegative decimal inputs without narrowing Lean natural numbers. */
export const calculate = (api: LeanComponent, input: Inputs): Answer => {
	if(!/^\d+$/u.test(input.left) || !/^\d+$/u.test(input.right))
		throw new RangeError("Enter nonnegative whole numbers.");
	const left = BigInt(input.left);
	const right = BigInt(input.right);
	return { sum: api.add(left, right).toString(), empty: api.isEmpty(input.text) };
};
