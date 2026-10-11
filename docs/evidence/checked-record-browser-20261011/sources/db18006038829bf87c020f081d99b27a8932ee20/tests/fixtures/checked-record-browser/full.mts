/**
 * Strict public types for every checked-record export and erased proof field.
 *
 * @file
 */
import * as api from "checkedrecords";
const interval: api.Interval = { lo: 1n, hi: 2n };
const width: bigint = api.width(interval) + api.span(interval, interval);
const triple: api.Triple = api.repeated(4n);
const data: ReadonlyArray<bigint> = api.scale(2n, triple).data;
const percent: api.Percent = { value: 40n };
const rest: bigint = api.complement(percent) + api.total(triple) + api.firstOf(triple) + api.smallest(triple);
// @ts-expect-error A proof field is never part of the host type.
api.width({ lo: 1n, hi: 2n, ordered: true });
// @ts-expect-error The payload keeps bigint Nat values.
api.total({ data: [1, 2, 3] });
void width; void data; void rest;
