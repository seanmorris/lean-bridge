/**
 * Typed-array API for the compiled Lean Aho–Corasick component.
 *
 * @file
 */

import createLeanModule from "./runtime/lean-aho-corasick.mjs";

const ERROR = 0xffff_ffff;
const encoder = new TextEncoder();
let modulePromise;
let scratchPointer = 0;
let scratchCapacity = 0;

/** Load and initialize the generated Emscripten module once. */
const loadModule = async () => {
	const pending = modulePromise ??= createLeanModule({
		locateFile: path => path === "lean-aho-corasick.wasm"
			? new URL("./runtime/lean-aho-corasick.wasm", import.meta.url).href : path
	}).then(module => {
		if(module._lean_aho_runtime_init() !== 1) throw new Error("Lean runtime initialization failed");
		return module;
	}).catch(error => {
		if(modulePromise === pending) modulePromise = undefined;
		throw error;
	});
	return pending;
};

const reserveScratch = (module, bytes) => {
	if(!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 0xffff_ffff)
		throw new RangeError("Scan storage exceeds the Wasm32 allocation limit");
	const capacity = Math.max(bytes, 4);
	if(capacity <= scratchCapacity) return scratchPointer;
	const pointer = module._malloc(capacity);
	if(!pointer) throw new Error(`Unable to allocate ${capacity} Wasm bytes`);
	if(scratchPointer) module._free(scratchPointer);
	scratchPointer = pointer;
	scratchCapacity = capacity;
	return pointer;
};

const normalizeBytes = (value, label) => {
	if(value instanceof Uint8Array) return value;
	if(typeof value === "string") return encoder.encode(value);
	throw new TypeError(`${label} must be a string or Uint8Array`);
};

const encodePatterns = patterns => {
	if(!Array.isArray(patterns) || patterns.length === 0) throw new TypeError("patterns must be a nonempty array");
	const encoded = patterns.map((pattern, index) => {
		const bytes = normalizeBytes(pattern, `patterns[${index}]`);
		if(bytes.length === 0) throw new RangeError("empty patterns are not supported");
		return bytes.slice();
	});
	const offsets = new Uint32Array(encoded.length + 1);
	let length = 0;
	for(let index = 0; index < encoded.length; index += 1)
	{
		length += encoded[index].length;
		if(length > 0xffff_ffff) throw new RangeError("Pattern storage exceeds the Wasm32 allocation limit");
		offsets[index + 1] = length;
	}
	const tokens = new Uint8Array(length);
	let cursor = 0;
	for(const pattern of encoded)
	{ tokens.set(pattern, cursor); cursor += pattern.length; }
	return { encoded, offsets, tokens };
};

const parseMatches = (module, pointer, length) => {
	if(length % 3 !== 0) throw new Error("Lean returned a malformed match stream");
	return Uint32Array.from(module.HEAPU32.subarray(pointer >>> 2, (pointer >>> 2) + length));
};

/**
 * Compile patterns once and return synchronous batch and streaming scanners.
 *
 * @param {Array<string | Uint8Array>} patterns Exact nonempty patterns to compile.
 * @returns {Promise<object>} Prepared synchronous scanners and a disposal hook.
 */
export const prepareMatcher = async patterns => {
	const { encoded, offsets, tokens } = encodePatterns(patterns);
	const module = await loadModule();
	const inputBytes = offsets.byteLength + tokens.byteLength + 4;
	const pointer = reserveScratch(module, inputBytes);
	const offsetsPointer = (pointer + 3) & ~3;
	const tokensPointer = offsetsPointer + offsets.byteLength;
	module.HEAPU32.set(offsets, offsetsPointer >>> 2);
	module.HEAPU8.set(tokens, tokensPointer);
	const machine = module._lean_aho_prepare(offsetsPointer, offsets.length, tokensPointer, tokens.length) >>> 0;
	if(machine === 0)
		throw new Error("Lean rejected the pattern table");
	let outputPointer = 0;
	let outputCapacity = 0;
	let disposed = false;
	const scanBytes = value => {
		if(disposed) throw new Error("Matcher has been disposed");
		const bytes = normalizeBytes(value, "input");
		const input = bytes.buffer === module.HEAPU8.buffer ? bytes.slice() : bytes;
		const words = input.length * encoded.length * 3;
		const required = input.length + 4 + words * 4;
		const base = reserveScratch(module, required);
		module.HEAPU8.set(input, base);
		const candidate = (base + input.length + 3) & ~3;
		outputPointer = candidate;
		outputCapacity = words;
		const length = module._lean_aho_scan(machine, base, input.length, outputPointer, outputCapacity) >>> 0;
		if(length === ERROR) throw new Error("Lean rejected or could not certify the scan result");
		return parseMatches(module, outputPointer, length);
	};
	const maxPatternLength = encoded.reduce((maximum, pattern) => Math.max(maximum, pattern.length), 0);
	const createStream = () => {
		if(disposed) throw new Error("Matcher has been disposed");
		let carry = new Uint8Array(0);
		let consumed = 0;
		/**
		 * Scan one chunk while retaining the bounded suffix needed for boundary matches.
		 *
		 * @param {string | Uint8Array} value Next stream chunk.
		 * @returns {Uint32Array} Match triples ending in this chunk.
		 */
		const push = value => {
			if(disposed) throw new Error("Matcher has been disposed");
			const chunk = normalizeBytes(value, "chunk");
			if(consumed + chunk.length > 0xffff_ffff)
				throw new RangeError("Stream positions exceed the Uint32 match format; reset the stream");
			const combined = new Uint8Array(carry.length + chunk.length);
			combined.set(carry); combined.set(chunk, carry.length);
			const raw = scanBytes(combined);
			const kept = [];
			for(let index = 0; index < raw.length; index += 3)
				if(raw[index + 2] > carry.length) kept.push(raw[index], raw[index + 1] + consumed - carry.length,
					raw[index + 2] + consumed - carry.length);
			consumed += chunk.length;
			carry = combined.slice(Math.max(0, combined.length - maxPatternLength + 1));
			return Uint32Array.from(kept);
		};
		/** Reset stream position and retained suffix. */
		const reset = () => { carry = new Uint8Array(0); consumed = 0; };
		return { push, reset };
	};
	const checkedScan = value => {
		if(disposed) throw new Error("Matcher has been disposed");
		return scanBytes(value);
	};
	/** Release the prepared Lean machine. */
	const dispose = () => {
		if(!disposed)
		{
			module._lean_aho_release(machine);
			disposed = true;
		}
	};
	return {
		patterns: encoded.map(bytes => bytes.slice())
		, scanBytes: checkedScan
		, createStream
		, dispose
	};
};

/**
 * Convert a flat result into ergonomic match records.
 *
 * @param {Uint32Array} result Flat `(pattern, start, stop)` triples.
 * @returns {Array<{pattern: number, start: number, stop: number}>} Match records.
 */
export const unpackMatches = result => {
	if(!(result instanceof Uint32Array) || result.length % 3 !== 0) throw new TypeError("result must contain match triples");
	const matches = [];
	for(let index = 0; index < result.length; index += 3)
		matches.push({ pattern: result[index], start: result[index + 1], stop: result[index + 2] });
	return matches;
};

/** Resolve after the compiled Lean runtime is initialized. */
export const ready = loadModule;
