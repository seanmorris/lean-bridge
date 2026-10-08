/**
 * Keep the host-neutral dispatch steps, interposer and reader exact, and identical to the interposer the
 * native PHP counter run measured.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeFinDispatchColumns, nativeFinSymbol } from "./native-fin-consumers.mjs";
import { nativeFinCountInterposer } from "./native-fin-count-interposer.mjs";
import { nativeFinAdapterSymbol, nativeFinCountInterposerFor, nativeFinDispatchExpected, nativeFinDispatchMutations, nativeFinDispatchSources, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./native-fin-dispatch.mjs";

test("the parametrized interposer reproduces the measured native-fin interposer byte for byte", () => {
	assert.equal(nativeFinCountInterposerFor("native-fin@1.0.0"), nativeFinCountInterposer());
	assert.equal(sha256(nativeFinCountInterposerFor("native-fin@1.0.0")), "a6584dcb1a98f5d517680e475ad039e255d1ff15a1bfdb4e0ab49414651da710");
	assert.deepEqual(nativeFinDispatchSymbols("native-fin@1.0.0"), nativeFinDispatchColumns);
	for(const name of nativeFinDispatchSources)
		assert.equal(nativeFinAdapterSymbol("native-fin@1.0.0", `NativeFin.${name}`), nativeFinSymbol(`NativeFin.${name}`));
	const other = nativeFinDispatchSymbols("nativefin@1.0.0");
	assert.deepEqual(other.slice(0, 3), nativeFinDispatchColumns.slice(0, 3));
	for(const [index, symbol] of other.slice(3).entries())
	{
		assert.notEqual(symbol, nativeFinDispatchColumns[index + 3]);
		assert.equal(nativeFinCountInterposerFor("nativefin@1.0.0").split(`dlsym(RTLD_NEXT, "${symbol}")`).length, 2, symbol);
	}
});

test("the dispatch steps separate rejections from positive controls", () => {
	const firstValid = nativeFinDispatchSteps.findIndex(([, , , outcome]) => outcome.ok);
	assert.ok(nativeFinDispatchSteps.slice(1, firstValid).every(([, , , outcome, counts]) => outcome.rejected && counts.every(value => value === 0)));
	for(const [index, [step, name, , outcome, counts]] of nativeFinDispatchSteps.entries())
	{
		if(!index) continue;
		const change = counts.map((value, column) => value - nativeFinDispatchSteps[index - 1][4][column]);
		const column = nativeFinDispatchSources.indexOf(name);
		assert.deepEqual(change, outcome.ok ? change.map((_, i) => i === column || i === column + 3 ? 1 : 0) : [0, 0, 0, 0, 0, 0], step);
		if(name === "impossible") assert.deepEqual(outcome.rejected, ["arg0", "0"], step);
	}
	assert.ok(nativeFinDispatchSteps.some(([step, , args]) => step.startsWith("invalid-") && args[0] === 2n ** 70n));
	assert.ok(nativeFinDispatchSteps.some(([, , , outcome]) => outcome.rejected?.[0] === "arg1"));
	assert.ok(nativeFinDispatchSteps.every(Object.isFrozen) && Object.isFrozen(nativeFinDispatchSteps));
});

test("the dispatch reader accepts only the exact ordered per-step rows", () => {
	const expected = nativeFinDispatchExpected(outcome => outcome.rejected ? `rejected:${outcome.rejected.join("<")}` : `ok:${outcome.ok}`);
	const { valid, mutations } = nativeFinDispatchMutations(expected);
	assert.deepEqual(readNativeFinDispatch(valid, expected), expected);
	assert.ok(Object.keys(mutations).length > 60);
	for(const [name, output] of Object.entries(mutations))
		assert.throws(() => readNativeFinDispatch(output, expected), TypeError, name);
	assert.throws(() => readNativeFinDispatch(Buffer.from(valid), expected), TypeError);
});
