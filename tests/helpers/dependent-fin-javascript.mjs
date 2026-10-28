/**
 * Shared JavaScript-family contract for direct dependent Fin packages.
 *
 * @file
 */
import { readFile } from "node:fs/promises";

export const dependentFinJavascriptProfiles = Object.freeze([
	"node-javascript", "node-typescript", "browser-javascript"
	, "browser-react", "browser-worker"
]);
export const dependentFinJavascriptRoutes = Object.freeze([
	"ordinary-source", "reviewed-ir"
]);
export const dependentFinJavascriptExpected = Object.freeze({
	checks: 1014, rejections: 1044, rawRejections: 20, recoveries: 1001
});

/**
 * Strict TypeScript source that checks the prepared package before executing it.
 *
 * @param request - Exact TypeScript consumer request.
 */
export const dependentFinTypeScript = request => `import * as api from "dependentfin";
import { executeDependentFin } from "./javascript.mjs";
import { request, loadApi } from "./package.mjs";
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type _Mirror = Expect<Equal<typeof api.mirror, (arg0: bigint, arg1: bigint) => bigint>>;
type _Label = Expect<Equal<typeof api.label, (arg0: bigint, arg1: bigint, arg2: bigint, arg3: string) => string>>;
if (false) {
  // @ts-expect-error Nat does not accept number.
  api.mirror(2, 1n);
  // @ts-expect-error Fin erases to bigint, never number.
  api.mirror(2n, 1);
}
void (null as unknown as _Mirror);
void (null as unknown as _Label);
if (request.profile !== ${JSON.stringify(request.profile)}) throw new Error("TypeScript profile drift");
console.log(JSON.stringify(executeDependentFin(request, await loadApi())));
`;

/** Shared caller source retained independently of generated package bytes. */
export const dependentFinJavascriptConsumer = () => readFile(
	"tests/fixtures/dependent-fin-consumers/javascript.mjs", "utf8"
);
