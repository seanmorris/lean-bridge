/**
 * Validate user input before calling the installed Lean component.
 *
 * @file
 */
import { add } from "onboarding-small";

/** Parse nonnegative decimal inputs without narrowing Lean natural numbers. */
export function addInput(leftText: string, rightText: string): bigint
{
	if(!/^\d+$/.test(leftText) || !/^\d+$/.test(rightText))
	{
		throw new RangeError("Enter nonnegative whole numbers.");
	}
	const left = BigInt(leftText);
	const right = BigInt(rightText);
	return add(left, right);
}
