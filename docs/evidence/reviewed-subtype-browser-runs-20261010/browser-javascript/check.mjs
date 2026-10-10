/**
 * The same independent Subtype corpus through generated JavaScript and the raw installed runtime.
 *
 * @file
 */

/**
 * Check constructor decisions, normalization, rejection, recovery and every declared primitive base.
 *
 * @param api - Installed generated API.
 * @param raw - Installed runtime call by short export name and argument list.
 */
export const checkReviewedSubtype = (api, raw) => {
	let checks = 0, rejections = 0;
	const check = (actual, expected, label) => {
		if(actual !== expected) throw new Error(`failed: ${label}: ${String(actual)} != ${String(expected)}`);
		checks++;
	};
	const rejected = (call, pattern, label) => {
		try
		{ call(); }
		catch(error)
		{
			if(!pattern.test(String(error?.message))) throw new Error(`wrong rejection: ${label}: ${error?.message}`, { cause: error });
			rejections++; return;
		}
		throw new Error(`accepted: ${label}`);
	};
	for(const [route, call] of [["public", (name, args) => api[name](...args)], ["raw", raw]])
	{
		const bytes = new Uint8Array([0, 255]);
		const values = [
			["shout", ["héllo 🙂"], "héllo 🙂!"]
			, ["shout", ["a\0b"], "a\0b!"]
			, ["half", [42n], 21n]
			, ["half", [2n ** 100n], 2n ** 99n]
			, ["scale", [-3n, -128n], 384n]
			, ["scale", [-3n, 127n], -381n]
			, ["head", [bytes], 0]
			, ["pad", [21n], 42n]
			, ["join", ["ab", "cd"], "abcd"]
			, ["clamp", [250n], 100n]
			, ["clamp", [7n], 7n]
			, ["mix", [4n, 3n], 7n]
			, ["byte", [255], 255]
			, ["firstEven", [6n], 6n]
			, ["secondEven", [7n], 14n]
			, ["secondEven", [2n ** 100n], 2n ** 101n]
			, ["zeroEven", [], 0n]
		];
		for(const [name, args, expected] of values) check(call(name, args), expected, `${route} ${name}`);
		check(bytes.join(), "0,255", `${route} caller bytes`);
		// Subtype constructors run in Lean even through the public wrapper. Scalar ABI status 6
		// distinguishes rejected input from transport errors; Fin also has a public JS guard.
		const invalid = [
			["shout", [""]], ["half", [7n]]
			, ["scale", [-3n, 128n]], ["scale", [-3n, -129n]]
			, ["head", [new Uint8Array()]]
			, ["join", ["ab", ""]], ["join", ["", "cd"]]
			, ["mix", [5n, 3n]], ["byte", [0]], ["firstEven", [7n]]
		];
		for(const [name, args] of invalid) rejected(() => call(name, args), /failed \(6\)/u, `${route} ${name}`);
		for(const value of [4n, 5n]) rejected(() => call("mix", [value, 10n]), route === "public" ? /below/u : /failed \(6\)/u, `${route} Fin before constructor`);
		for(let index = 0n; index < 1000n; index++)
		{
			rejected(() => call("half", [index * 2n + 1n]), /failed \(6\)/u, `${route} rejection ${index}`);
			check(call("half", [index * 2n]), index, `${route} recovery ${index}`);
		}
	}
	return { checks, rejections };
};
