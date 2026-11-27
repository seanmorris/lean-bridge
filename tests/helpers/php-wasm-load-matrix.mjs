/** @file Require each installed interpreter, autoloader and loading time exactly once. */
import assert from "node:assert/strict";

/**
 * Reject missing or duplicated execution modes without requiring a fixed run order.
 *
 * @param observations - Results emitted by the installed Node and Chromium clients.
 */
export function checkPhpWasmLoadMatrix(observations)
{
	const expected=[];
	for(const host of ["Node","Chromium"])
	for(const mode of ["embedded","composer"])
	for(const loading of ["startup","lazy"]) expected.push([host,mode,loading].join("/"));
	assert.deepEqual(observations.map(({host,mode,loading})=>[host,mode,loading].join("/")).sort(),expected.sort());
}
