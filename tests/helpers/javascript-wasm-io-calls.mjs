/** @file Identical downstream checks for an installed npm package in Node and a browser. */

const equal = (a, b) => Object.is(a, b) || (a && b && typeof a === "object" && typeof b === "object"
	&& Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && Object.keys(a).length === Object.keys(b).length
	&& Object.keys(b).every(key => Object.hasOwn(a, key) && equal(a[key], b[key])));

/**
 * Exercise public methods only; no descriptor, transport, or host mocks.
 *
 * @param api - Consumer's ordinary imported package.
 */
export const exercise = api => {
	let checks = 0;
	const check = (value, label) => { if(!value) throw new Error("Installed JS IO: " + label); checks++; };
	const thrown = (call, predicate, label) => {
		try
		{ call(); } catch(error)
		{ check(predicate(error), label + " (wrong exception: " + error + ")"); return; }
		throw new Error("Expected exception: " + label);
	};
	check(api.read_total() === 0, "initial counter");
	check(api.add(2) === 2, "synchronous state change");
	for(const invalid of [-1, 2**32, 1n, 1.5]) thrown(() => api.add(invalid), e => e instanceof TypeError, "before state change");
	check(api.read_total() === 2, "invalid calls left state unchanged");
	const text = "\ufeffone\0λ🎉", bytes = new Uint8Array([0, 255, 17]), huge = (1n << 197n) + 13n;
	const scalars = {unit: undefined
		, bool: true
		, uint8: 251
		, int8: -119
		, uint16: 65535
		, int16: -32768
		, uint32: 0xffffffff
		, int32: -0x80000000
		, uint64: (1n<<64n)-1n
		, int64: -(1n<<63n)
		, usize: 0xffffffff
		, isize: -0x80000000
		, char: "🎉"
		, float32: -0
		, float64: Infinity
		, string: text, bytes, nat: huge, int: -huge};
	for(const [kind, value] of Object.entries(scalars))
	{
		const got = api["rt_" + kind](value);
		check(equal(got, value), kind);
		if(kind === "bytes")
		{ value[0] = 11; check(got[0] === 0, "bytes returned by copy"); }
	}
	for(const [kind, value] of [["bytes", new Uint8Array()], ["string", ""], ["nat", 0n], ["int", 0n], ["float64", NaN]])
		check(equal(api["rt_" + kind](value), value), "empty or special " + kind);
	for(const [tag, value] of [[0, {ok: text}], [1, {error: {ok: -huge}}], [2, {error: {error: bytes}}]])
	{
		check(equal(api.nested(false, tag, -huge, text, bytes), value), "returned nested " + tag);
		thrown(() => api.nested(true, tag, -huge, text, bytes)
			, e => e instanceof api.EIO_RubyIO_nested && equal(e.payload, value), "thrown nested " + tag);
	}
	for(const [tag, value] of [[false, {error: 4000000000}], [true, {ok: text}]])
	{
		check(equal(api.choose(false, tag, text), value), "returned Except " + tag);
		thrown(() => api.choose(true, tag, text)
			, e => e instanceof api.EIO_Ledger_choose && equal(e.payload, value), "thrown Except " + tag);
	}
	thrown(() => api.io_failure(), e => e instanceof api.IOError && /ledger offline/u.test(e.message), "Lean IO.Error");
	check(api.signed(-12) === -12 && api.wide(1n << 61n) === (1n << 61n) && api.magnitude(-huge) === -huge, "Ledger scalars");
	check(api.add(1) === 3, "shared runtime reusable after declared failures");
	return {checks, scalarKinds: Object.keys(scalars).length, counter: api.read_total()};
};
