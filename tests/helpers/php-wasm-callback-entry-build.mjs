/**
 * Compile one separate callback-entry probe through the shared authenticated observer.
 *
 * @file
 */
import {
	instrumentPhpWasmCallbackEntries, validatePhpWasmCallbackEntrySelection
} from "./php-wasm-callback-entry-c.mjs";
import { phpWasmCallbackEntrySelection } from "./php-wasm-callback-entry-selection.mjs";
import { buildPhpWasmRefinementEntryProbe } from "./php-wasm-refinement-entry-build.mjs";

/**
 * Build one separately instrumented callback-entry package.
 *
 * @param options - Exact callback author, compiler, runtime and record roots.
 */
export const buildPhpWasmCallbackEntryProbe = options => buildPhpWasmRefinementEntryProbe({
	...options
	, selectEntries: phpWasmCallbackEntrySelection
	, instrumentEntries: instrumentPhpWasmCallbackEntries
	, validateEntries: validatePhpWasmCallbackEntrySelection
});
