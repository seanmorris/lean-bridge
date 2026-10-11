/**
 * Fail closed on incomplete, reordered or fabricated dispatch transcripts.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { finContainerDispatchExpected } from "./fin-container-dispatch.mjs";
import { parseFinContainerHostDispatch } from "./fin-container-host-probes.mjs";

test("container host dispatch requires every ordered public and raw control", () => {
	const text = rows => rows.map(([step, status, counts]) => [step, status, ...counts].join(" ")).join("\n") + "\n";
	assert.deepEqual(parseFinContainerHostDispatch(text(finContainerDispatchExpected)), finContainerDispatchExpected);
	const mutations = [
		[]
		, finContainerDispatchExpected.slice(1)
		, finContainerDispatchExpected.slice(0, -1)
		, finContainerDispatchExpected.toReversed()
		, [...finContainerDispatchExpected, finContainerDispatchExpected.at(-1)]
		, finContainerDispatchExpected.map(([step, status]) => [step, status, [0, 0, 0, 0]])
		, finContainerDispatchExpected.map(([step, status, counts]) => [step, 1 - status, counts])
	];
	for(const rows of mutations) assert.throws(() => parseFinContainerHostDispatch(text(rows)));
	for(const [index, row] of finContainerDispatchExpected.entries()) for(let column = 0; column < 4; column++)
	{
		const changed = structuredClone(finContainerDispatchExpected);
		changed[index][2][column] = row[2][column] + 1;
		assert.throws(() => parseFinContainerHostDispatch(text(changed)), `${row[0]} column ${column}`);
	}
	const valid = text(finContainerDispatchExpected);
	for(const changed of ["", valid.trimEnd(), valid + "noise\n", valid.replace("start 0", "start NaN"), valid.replace("start 0", "start  0"), valid.replace("start 0", "start 00")])
		assert.throws(() => parseFinContainerHostDispatch(changed));
});
