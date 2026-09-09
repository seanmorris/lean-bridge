/**
 * Compile intentionally invalid calls to check the generated declarations.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

// Compiled but never executed: these errors check the generated declarations.
// @ts-expect-error Nat inputs use bigint.
add(20, 22);
// @ts-expect-error String inputs do not accept numbers.
isEmpty(0);
// @ts-expect-error Nat outputs are not JavaScript numbers.
const wrongResult: number = add(20n, 22n);
void wrongResult;
