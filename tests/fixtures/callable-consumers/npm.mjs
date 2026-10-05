/**
 * Compiler-free primitive callable checks shared by Node, pages, React and workers.
 *
 * @file
 */
const cases = {
	Unit: [undefined], Bool: [false, true], UInt8: [0, 255], UInt16: [0, 65535]
	, UInt32: [0, 0x80000000, 0xffffffff]
	, UInt64: [0n, 1n << 53n, (1n << 64n) - 1n]
	, Int8: [-128, 127], Int16: [-32768, 32767], Int32: [-0x80000000, 0x7fffffff]
	, Int64: [-(1n << 63n), (1n << 63n) - 1n], Nat: [0n, (1n << 16384n) + 123n]
	, Int: [0n, -(1n << 16384n), (1n << 16384n) + 123n]
	, Float32: [-0, 1.25, Infinity, -Infinity, NaN]
	, Float: [-0, Math.PI, Infinity, -Infinity, NaN]
	, String: ["", "\uFEFF\0🌱", "e\u0301中文"]
	, Bytes: [new Uint8Array(), new Uint8Array([0, 128, 255])]
	, Char: ["\0", "🌱", "\u{10ffff}"]
	, USize: [0, 0xffffffff]
	, ISize: [-0x80000000, 0x7fffffff]
};

/**
 * Exercise the public package without compiler or private runtime access.
 *
 * @param api - Installed generated package, with no compiler access.
 */
export const checkCallables = api => {
	const progress = stage => globalThis.callableProgress?.(stage);
	let checks = 0;
	const check = (condition, label) => { checks++; if(!condition) throw new Error(label); };
	const equal = (actual, expected) => check(expected instanceof Uint8Array ? actual instanceof Uint8Array && actual.length === expected.length && actual.every((byte, i) => byte === expected[i]) : Object.is(actual, expected), "callable value mismatch");
	const throws = (operation, expected) => {
		let caught = false;
		try
		{ operation(); } catch(error)
		{ caught = true; if(expected) check(expected(error), `unexpected error: ${String(error)}`); }
		check(caught, "expected a rejected call");
	};
	equal(api.wordBits(), 32);
	for(const [name, values] of Object.entries(cases)) for(const value of values)
	{
		progress(name);
		let calls = 0;
		equal(api[`call${name}`](value, input => { equal(input, value); calls++; return input; }), value); equal(calls, 1);
		equal(api[`twice${name}`](value, input => { equal(input, value); calls++; return input; }), value); equal(calls, 3);
		const closure = api[`make${name}`](value), alias = closure;
		check(!closure.disposed, "new closure disposed");
		equal(closure(true, values[0]), value); equal(closure(false, values[0]), values[0]);
		if(name === "Bytes") check(closure(true, value) !== value, "retained byte view");
		throws(() => closure(true));
		equal(closure.dispose(), true); equal(alias.dispose(), false); check(alias.disposed, "alias remained open");
		throws(() => closure(true, value), error => /disposed/.test(String(error)));
		throws(() => api[`call${name}`](value, () => Promise.resolve(value)));
		equal(api[`call${name}`](value, input => input), value);
	}
	progress("exceptions");
	for(const error of [new Error("original"), undefined, null, 0])
	{
		let calls = 0;
		throws(() => api.twiceUInt32(1, () => { calls++; throw error; }), actual => actual === error);
		equal(calls, 1); equal(api.callUInt32(41, value => value + 1), 42);
	}
	for(const value of [-1, 0x100000000, 1n, NaN, "1"])
	{
		let calls = 0;
		throws(() => api.callUInt32(value, input => { calls++; return input; })); equal(calls, 0);
		throws(() => api.callUInt32(1, () => value));
	}
	for(const value of ["", "ab", "\ud800", 65]) throws(() => api.callChar("a", () => value));
	progress("reentry");
	const recurse = depth => api.callUInt32(depth, value => value ? recurse(value - 1) : 0);
	equal(recurse(63), 0); throws(() => recurse(64), error => /reentry/.test(String(error))); equal(recurse(3), 0);
	progress("expired borrow");
	const stale = api.retainCallback(value => value + 1);
	throws(() => stale(1), error => /Expired/.test(String(error))); equal(stale.dispose(), true);
	equal(api.combine("\uFEFF🌱", (1n << 64n) - 1n, (text, integer) => `${text}:${integer}`, text => text + "!"), "\uFEFF🌱:18446744073709551615!");
	equal(api.apply16((...args) => args.reduce((a, b) => a + b)), 136);
	const sixteen = api.make16(7); equal(sixteen(...Array.from({ length: 16 }, (_, i) => i + 1)), 143); sixteen.dispose();
	progress("registry capacity");
	const live = [];
	try
	{
		for(let i = 0; i < 1024; i++) live.push(api.makeUInt32(i));
		throws(() => api.makeUInt32(1025));
		for(let i = 0; i < live.length; i++) equal(live[i](true, 0), i);
	}
	finally
	{ live.forEach(closure => closure.dispose()); }
	progress("lease reuse");
	for(let i = 0; i < 2050; i++)
	{ const closure = api.makeUInt32(i); equal(closure(true, 0), i); closure.dispose(); }
	progress("callback stress");
	for(let i = 0; i < 4096; i++) equal(api.callUInt32(i, value => value + 1), i + 1);
	const disposed = api.makeUInt32(1); disposed[Symbol.dispose](); check(disposed.disposed, "Symbol.dispose ignored");
	progress("complete");
	return { checks, primitives: Object.keys(cases).length, wordBits: api.wordBits() };
};
