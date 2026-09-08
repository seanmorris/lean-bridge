/**
 * Load only the installed public package and validate this example's input range.
 *
 * @file
 */

export type LeanComponent = typeof import("onboarding-small");
export interface Inputs { left: string; right: string; text: string; }
export interface Answer { sum: string; empty: boolean; }
export const maximumSum = (1n << 31n) - 1n;

/** ESM shares this initialization across concurrent imports in one realm. */
export const loadLean = (): Promise<LeanComponent> => import("onboarding-small");

/** Keep the installed runtime on its supported small-Nat path. */
export const calculate = (api: LeanComponent, input: Inputs): Answer => {
	if(!/^\d+$/u.test(input.left) || !/^\d+$/u.test(input.right))
		throw new RangeError("Enter nonnegative whole numbers.");
	const left = BigInt(input.left);
	const right = BigInt(input.right);
	if(left + right > maximumSum)
		throw new RangeError(`The current example supports sums through ${maximumSum}.`);
	return { sum: api.add(left, right).toString(), empty: api.isEmpty(input.text) };
};
