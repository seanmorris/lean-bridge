/**
 * Host assertions shared by installed Node, React, browser and worker callers.
 *
 * @file
 */
/**
 * Exercise installed public functions with independent wasm32 expectations.
 *
 * @param api - Installed Words package exports.
 */
export const checkWords = api => {
	let checks = 0;
	const check = condition => { if(!condition) throw new Error("Platform integer mismatch"); checks++; };
	const unsigned = [0, 1, 127, 65535, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff];
	const signed = [-0x80000000, -0x7fffffff, -65536, -1, 0, 1, 65535, 0x7fffffff];
	check(api.wordBits() === 32);
	for(const value of unsigned)
	{
		check(api.keepUnsigned(value) === value);
		check(api.unsignedText(value) === String(value));
		check(api.advanceUnsigned(value) === (value === 0xffffffff ? 0 : value + 1));
	}
	for(const value of signed)
	{
		check(api.keepSigned(value) === value);
		check(api.signedText(value) === String(value));
		check(api.advanceSigned(value) === (value === 0x7fffffff ? -0x80000000 : value + 1));
	}
	for(const [calls, invalid] of [
		[[api.keepUnsigned, api.unsignedText, api.advanceUnsigned], [-1, 0x100000000, 0x100000041]]
		, [[api.keepSigned, api.signedText, api.advanceSigned], [-0x80000001, 0x80000000, 0x100000000]]
	]) for(const call of calls)
		for(const value of [...invalid, NaN, Infinity, -Infinity, 0.5, 1n, "1", true, null, undefined, {}, [1]])
		{
			let rejected = false;
			try
			{ call(value); } catch(error)
			{ if(!(error instanceof TypeError || error instanceof RangeError)) throw error; rejected = true; }
			check(rejected); check(api.keepSigned(-1) === -1);
		}
	for(let i = 0; i < 1000; i++)
	{
		check(api.keepUnsigned(0xffffffff) === 0xffffffff);
		check(api.keepSigned(-0x80000000) === -0x80000000);
	}
	return { checks, wordBits: 32, unsigned, signed };
};
