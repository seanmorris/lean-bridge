/**
 * The installed npm consumer for the reviewed callback-Fin package, and a host-side model of that
 * package used only to prove the consumer fails on weaker packages. The model is not installed
 * acceptance; it validates the consumer's own checks before an installed run.
 *
 * @file
 */

/**
 * Exercise every R1 direction, and for R2 the host reply, through the public API and the
 * package-internal runtime, then dispose every closure and require later calls to be refused.
 *
 * @param hostReply - Include R2's host-produced bounded reply.
 */
export const reviewedCallbackNodeConsumer = hostReply => `import * as api from "reviewedcallbacks";
import { runtime } from "./node_modules/reviewedcallbacks/internal/runtime.mjs";
const raw = (name, args) => runtime.call("lean:ReviewedCallbacks." + name, args);
let checks = 0, rejections = 0;
const check = (ok, label) => { if (!ok) throw new Error("failed: " + label); checks++; };
const rejected = (call, pattern, label) => {
  try { call(); } catch (error) { if (!pattern.test(String(error?.message))) throw new Error("wrong rejection: " + label + ": " + error?.message); rejections++; return; }
  throw new Error("accepted: " + label);
};
const below = /below/, adapter = /failed \\(5\\)/, gone = /disposed|released/;
const scaler = api.scaler(3n), rawScaler = raw("scaler", [3n]);
check(scaler(4n) === 12n && rawScaler(9n) === 27n, "scaler");
for (const bad of [10n, 2n ** 70n]) { rejected(() => scaler(bad), below, "scaler"); rejected(() => rawScaler(bad), adapter, "raw scaler"); }
check(scaler(0n) === 0n && rawScaler(1n) === 3n, "scaler recovers");
const counter = api.counter(7n), rawCounter = raw("counter", [7n]);
check(counter(5n) === 2n && counter(3n) === 0n && rawCounter(5n) === 2n, "counter result from Lean");
const seen = [], rawSeen = [];
check(api.visit(value => { seen.push(value); return value; }) === 10n && seen.join() === "0,1,2,3,4", "visit arguments from Lean");
check(raw("visit", [value => { rawSeen.push(value); return value; }]) === 10n && rawSeen.join() === "0,1,2,3,4", "raw visit arguments from Lean");
const digits = api.digits(undefined), rawDigits = raw("digits", [undefined]);
check(digits([1n, 2n]) === 5n && digits([]) === 0n && rawDigits([2n]) === 2n, "digits");
rejected(() => digits([0n, 3n]), below, "digits element"); rejected(() => rawDigits([3n]), adapter, "raw digits element");
const tiles = api.tiles(undefined), rawTiles = raw("tiles", [undefined]);
check(tiles([{ digit: 4n, count: 6n }]) === 406n && rawTiles([{ digit: 1n, count: 2n }]) === 102n, "tiles");
rejected(() => tiles([{ digit: 5n, count: 0n }]), below, "tile field"); rejected(() => rawTiles([{ digit: 5n, count: 0n }]), adapter, "raw tile field");
const maker = api.tileMaker(2n), rawMaker = raw("tileMaker", [2n]);
const made = maker(4n), rawMade = rawMaker(4n);
check(made.digit === 1n && made.count === 4n && rawMade.digit === 1n && rawMade.count === 4n, "tile from Lean");
check(api.apply(value => value + 1n, 4n) === 5n && raw("apply", [value => value + 1n, 4n]) === 5n, "unrefined callback");
${hostReply ? `check(api.three(value => value, 2n) === 2n && raw("three", [value => value, 2n]) === 2n, "host reply");
rejected(() => api.three(() => 3n, 1n), below, "host reply bound"); rejected(() => raw("three", [() => 3n, 1n]), adapter, "raw host reply bound");
check(api.three(value => value, 0n) === 0n && raw("three", [value => value, 0n]) === 0n, "host reply recovers");` : ""}
for (const [closure, argument] of [[scaler, 1n], [rawScaler, 1n], [counter, 1n], [rawCounter, 1n], [digits, []], [rawDigits, []], [tiles, []], [rawTiles, []], [maker, 1n], [rawMaker, 1n]]) {
  closure.dispose();
  check(closure.disposed === true, "disposed");
  rejected(() => closure(argument), gone, "disposed closure");
}
console.log(JSON.stringify({ checks, rejections }));
`;

export const reviewedCallbackTypescript = `import * as api from "reviewedcallbacks";
const scaler = api.scaler(1n); const scaled: bigint = scaler(2n); scaler.dispose();
const maker = api.tileMaker(1n); const tile = maker(2n); const digit: bigint = tile.digit; maker.dispose();
// @ts-expect-error Fin arguments stay bigint.
scaler(1);
void scaled; void digit;
`;

/** Counts each consumer must report. */
export const reviewedCallbackNodeExpected = Object.freeze({ r1: { checks: 19, rejections: 18 }, r2: { checks: 21, rejections: 20 } });

/**
 * Files of a host-side package model, optionally weakened, for the consumer's own fault controls.
 *
 * @param faults - Weaknesses to introduce.
 * @param faults.acceptBound - The public layer accepts an out-of-bound closure argument.
 * @param faults.rawLayer - The raw runtime rejects with the public message.
 * @param faults.keepAlive - A disposed closure keeps running.
 */
export const reviewedCallbackMockPackage = ({ acceptBound = false, rawLayer = false, keepAlive = false } = {}) => {
	const model = `const fin = (bound, raw) => value => {
  if (!${acceptBound} || raw) { if (typeof value !== "bigint" || value < 0n || value >= bound) throw new Error(raw && !${rawLayer} ? "Component structured callable call failed (5)" : "value must be a bigint below " + bound); }
  return value;
};
const lease = body => {
  let disposed = false;
  const closure = value => { if (disposed && !${keepAlive}) throw new Error("closure disposed"); return body(value); };
  Object.defineProperty(closure, "disposed", { get: () => disposed });
  closure.dispose = () => { disposed = true; };
  return closure;
};
const make = raw => ({
  scaler: factor => lease(value => fin(10n, raw)(value) * factor),
  counter: start => lease(step => (start + step) % 10n),
  visit: host => [0n, 1n, 2n, 3n, 4n].reduce((sum, value) => sum + host(value), 0n),
  digits: () => lease(values => values.map(fin(3n, raw)).reduce((sum, digit) => sum * 3n + digit, 0n)),
  tiles: () => lease(values => values.reduce((sum, tile) => sum + fin(5n, raw)(tile.digit) * 100n + tile.count, 0n)),
  tileMaker: start => lease(step => ({ digit: (start + step) % 5n, count: step })),
  apply: (host, value) => host(value),
  three: (host, value) => fin(3n, raw)(host(fin(3n, raw)(value)))
});
export const api = make(false), rawApi = make(true);
`;
	return {
		"package.json": JSON.stringify({ type: "module" })
		, "node_modules/reviewedcallbacks/package.json": JSON.stringify({ name: "reviewedcallbacks", type: "module", exports: { ".": "./index.mjs" } })
		, "node_modules/reviewedcallbacks/model.mjs": model
		, "node_modules/reviewedcallbacks/index.mjs": "import { api } from \"./model.mjs\";\nexport const { scaler, counter, visit, digits, tiles, tileMaker, apply, three } = api;\n"
		, "node_modules/reviewedcallbacks/internal/runtime.mjs": "import { rawApi } from \"../model.mjs\";\nexport const runtime = { call: (id, args) => rawApi[id.split(\".\").at(-1)](...args) };\n"
	};
};
