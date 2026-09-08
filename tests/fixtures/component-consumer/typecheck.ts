/**
 * Compile the generated package declarations without executing invalid calls.
 *
 * @file
 */

import { add, isEmpty } from "onboarding-small";

const sum: bigint = add(20n, 22n);
const empty: boolean = isEmpty("");
void [sum, empty];
// @ts-expect-error Lean Nat uses bigint, not number.
add(20, 22);
// @ts-expect-error The copied String input must be a JavaScript string.
isEmpty(0);
// @ts-expect-error A Nat result is not a JavaScript number.
const wrong: number = add(20n, 22n);
void wrong;
