/**
 * Strict public types for a package with checked results and no checked inputs.
 *
 * @file
 */
import * as api from "checkedrecords";
const triple: api.Triple = api.repeated(4n);
const data: ReadonlyArray<bigint> = triple.data;
// @ts-expect-error The Lean-produced record carries no proof field.
const proof: boolean = triple.sized;
void data; void proof;
// @ts-expect-error A result-only package has no checked input API.
api.width({ lo: 1n, hi: 2n });
