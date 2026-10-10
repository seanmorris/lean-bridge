/**
 * Preserve the exact reviewed npm callers for installed producers and independent report checks.
 *
 * @file
 */
export const reviewedSubtypeNpmTypescript = `import * as api from "subtypes";
const text: string = api.shout("hello") + api.join("a", "b");
const nat: bigint = api.half(4n) + api.pad(3n) + api.clamp(200n) + api.mix(4n, 3n);
const signed: bigint = api.scale(-3n, 127n);
const byte: number = api.head(new Uint8Array([255])) + api.byte(1);
const first: bigint = api.firstEven(6n), second: bigint = api.secondEven(7n), zero: bigint = api.zeroEven();
// @ts-expect-error Nat retains bigint, including in specialized Subtype exports.
api.firstEven(6);
// @ts-expect-error UInt8 retains number.
api.byte(1n);
// @ts-expect-error ByteArray retains Uint8Array.
api.head([1, 2]);
// @ts-expect-error A zero-argument result is not a Unit-argument function.
api.zeroEven(undefined);
void text; void nat; void signed; void byte; void first; void second; void zero;
`;
export const reviewedSubtypeNpmCaller = 'import * as api from "subtypes";\nimport { runtime } from "./node_modules/subtypes/internal/runtime.mjs";\nimport { checkReviewedSubtype } from "./check.mjs";\nconsole.log(JSON.stringify(checkReviewedSubtype(api, (name, args) => runtime.call("lean:Subtypes." + name, args))));\n';
export const reviewedSubtypePackageTestNames = Object.freeze({
	"c-cpp": "source-free reviewed C and C++ archives execute each checked constructor and distinct generic choices"
	, npm: "source-free reviewed npm archives execute checked Subtype constructors for Node and strict TypeScript"
});
export const reviewedSubtypePackageChecks = Object.freeze({ c: 2033, cpp: 2026, npm: 2036 });
