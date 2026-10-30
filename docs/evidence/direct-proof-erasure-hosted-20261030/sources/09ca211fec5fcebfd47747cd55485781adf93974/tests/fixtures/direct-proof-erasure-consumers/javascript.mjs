/**
 * Independent public JavaScript caller for the direct proof-erasure package.
 *
 * @file
 */

/**
 * Exercise the installed one-word API without manufacturing a proof argument.
 *
 * @param api - Installed generated public API, or a deliberate test double.
 */
export const checkDirectProofErasure = api => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => {
		if(!ok) throw new Error(`failed: ${label}`);
		checks++;
	};
	const refused = (call, label) => {
		try
		{ call(); }
		catch(error)
		{
			if(!(error instanceof TypeError))
				throw new Error(`wrong rejection: ${label}: ${error?.message}`
					, { cause: error });
			rejections++;
			return;
		}
		throw new Error(`accepted: ${label}`);
	};
	check(typeof api.keep === "function" && api.keep.length === 1
		, "one public runtime parameter");
	for(const value of [0, 1, 0x7fffffff, 0xffffffff])
		check(api.keep(value) === value, `UInt32 ${value}`);
	for(let value = 0; value < 1000; value++)
		check(api.keep(value) === value, `round ${value}`);
	for(const [value, label] of [
		[-1, "negative"], [0x100000000, "overflow"]
		, [1.5, "fraction"], [true, "boolean"]
	]) refused(() => api.keep(value), label);
	return { checks, rejections };
};
