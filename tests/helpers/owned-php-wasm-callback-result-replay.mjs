/**
 * Select live PHP-Wasm generators or the authenticated callback producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../../src/build/php-wasm-owned-component.mjs";
import { phpWasmCopiedPins } from "../../src/build/php-wasm-copied-artifacts.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedPhpWasmCallbackProducer = "39a82da8a81730db7d576b706011f20ea4a29892";
export const ownedPhpWasmCallbackProducerEntries = Object.freeze([
	"src/build/php-wasm-graph-model.mjs"
	, "src/build/php-wasm-owned-component.mjs"
	, "src/build/php-wasm-copied-artifacts.mjs"
]);
// This receipt predates complete import inventories. Bind its exact 17-source
// map, then authenticate all 114 imports independently at the same producer.
const sourceMapSha256 = "6724fb2ce872dfc76e78b263ca26937a1406e17ac7931c8250962b4f2ceade8d";
export const ownedPhpWasmCallbackProducerClosureSha256
	= "1b6593edf50719479debf7ef9303262dc042926ed0ad1b7baa0386b81eb44ef8";
const current = Object.freeze({
	createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters
	, generateCompiledPhpWasmOwned, phpWasmCopiedPins
});
const assertSources = sources => {
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	assert.equal(sha256(canonicalJson(sources)), sourceMapSha256);
};

/**
 * Authenticate recorded sources and the complete relative generator closure.
 *
 * @param sources - Original receipt source identities.
 */
export const ownedPhpWasmCallbackProducerClosure = sources => {
	assertSources(sources);
	for(const [path, expected] of Object.entries(sources))
		bytesAtProducer(ownedPhpWasmCallbackProducer, path, expected);
	const files = new Map();
	const visit = path => {
		if(files.has(path)) return;
		const bytes = bytesAtProducer(ownedPhpWasmCallbackProducer, path, sources[path]);
		files.set(path, sha256(bytes));
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? joined + ".mjs" : joined);
		}
	};
	for(const entry of ownedPhpWasmCallbackProducerEntries) visit(entry);
	assert.equal(sha256(canonicalJson(Object.fromEntries(files))), ownedPhpWasmCallbackProducerClosureSha256);
	return [...files.keys()].sort();
};

/**
 * Fresh reports retain current generators. Historical tests explicitly select
 * the original producer without loading its old verifier or changing receipts.
 *
 * @param sources - Optional historical source identities.
 */
export const ownedPhpWasmCallbackReplay = async sources => {
	if(sources === undefined) return current;
	ownedPhpWasmCallbackProducerClosure(sources);
	const modules = await Promise.all(ownedPhpWasmCallbackProducerEntries
		.map(entry => moduleAtProducer(ownedPhpWasmCallbackProducer, entry)));
	const exports = Object.assign({}, ...modules);
	const selected = Object.fromEntries(Object.entries(current).map(([name, value]) => {
		assert.equal(typeof exports[name], typeof value, name);
		return [name, exports[name]];
	}));
	return Object.freeze({ ...selected, assertSources });
};
