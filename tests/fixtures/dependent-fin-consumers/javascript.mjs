/**
 * Shared installed consumer for Node, strict TypeScript, browser, React and workers.
 *
 * @file
 */

/**
 * Exercise the public dependent-Fin boundary and its package-internal raw adapter.
 *
 * @param request - Exact installed profile and author route.
 * @param api - Installed public API plus the raw runtime call used for adapter checks.
 */
export const executeDependentFin = (request, api) => {
	const profiles = [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	];
	if(!request || request.module !== "dependentfin"
		|| !profiles.includes(request.profile)
		|| !["ordinary-source", "reviewed-ir"].includes(request.route))
		throw new TypeError("Invalid dependent Fin request");
	let checks = 0, rejections = 0, rawRejections = 0, recoveries = 0;
	const check = (value, label) => {
		if(!value) throw new Error(`failed: ${label}`);
		checks++;
	};
	const rejected = (call, label, pattern, raw = false) => {
		try
		{ call(); }
		catch(error)
		{
			if(pattern && !pattern.test(error.message))
				throw new Error(`wrong rejection: ${label}: ${error.message}`, {
					cause: error
				});
			rejections++;
			if(raw) rawRejections++;
			return;
		}
		throw new Error(`accepted: ${label}`);
	};
	const rejectedPair = (name, args, parameter, bound) => {
		rejected(() => api[name](...args), `${name} public bound`
			, new RegExp(`${name}\\.${parameter} must be bigint below ${bound}`, "u"));
		rejected(() => api.raw(name, args), `${name} raw bound`
			, /component call failed \(6\)/u, true);
	};
	const huge = 2n ** 70n, word = 2n ** 32n;
	for(const value of [0n, 1n]) rejectedPair("mirror", [0n, value], "arg1", 0n);
	check(api.mirror(1n, 0n) === 0n, "Fin 1 accepts zero");
	rejectedPair("mirror", [1n, 1n], "arg1", 1n);
	check(api.mirror(10n, 0n) === 9n && api.mirror(10n, 9n) === 0n
		, "small endpoints");
	for(const value of [10n, 11n, word, huge])
		rejectedPair("mirror", [10n, value], "arg1", 10n);
	check(api.mirror(word, word - 1n) === 0n
		&& api.mirror(word + 1n, word) === 0n, "word bounds");
	rejectedPair("mirror", [word, word], "arg1", word);
	check(api.mirror(huge, huge - 1n) === 0n
		&& api.mirror(huge, 0n) === huge - 1n, "huge endpoints");
	check(api.mirror(huge + 1n, huge) === 0n, "one past huge bound");
	for(const value of [huge, huge + 1n, 2n ** 128n])
		rejectedPair("mirror", [huge, value], "arg1", huge);
	for(let bound = 0n; bound < 12n; bound++)
	{
		if(bound > 5n)
			check(api.mirror(bound, 5n) === bound - 6n
				, `value below live bound ${bound}`);
		else rejectedPair("mirror", [bound, 5n], "arg1", bound);
	}
	check(api.label(100n, 3n, 2n, "slot") === "slot:102"
		, "later dependency");
	rejectedPair("label", [100n, 3n, 3n, "slot"], "arg2", 3n);
	rejectedPair("label", [100n, 0n, 0n, "slot"], "arg2", 0n);
	check(api.label(0n, huge, huge - 1n, "x") === `x:${huge - 1n}`
		, "huge later bound");
	for(const [args, label] of [
		[[-1n, 0n], "negative bound"]
		, [[5n, -1n], "negative value"]
		, [[5n, 1.5], "number value"]
		, [[5, 1n], "number bound"]
	]) rejected(() => api.mirror(...args), label, /must be/u);
	const caller = Object.freeze({
		start: 7n, bound: 4n, value: 4n, name: "slot"
	});
	rejectedPair("label", Object.values(caller), "arg2", 4n);
	check(Object.values(caller).join("|") === "7|4|4|slot"
		&& api.label(caller.start, caller.bound, 3n, caller.name) === "slot:10"
	, "rejected caller data unchanged");
	recoveries++;
	for(let index = 0; index < 1000; index++)
	{
		rejected(() => api.mirror(10n, 10n + BigInt(index % 5))
			, `repeated rejection ${index}`, /bigint below 10/u);
		check(api.mirror(BigInt(index % 7 + 1), BigInt(index % 7)) === 0n
			&& api.mirror(10n, BigInt(index % 10)) === BigInt(9 - index % 10)
		, `recovery ${index}`);
		recoveries++;
	}
	return {
		module: request.module, route: request.route
		, checks, rejections, rawRejections, recoveries
	};
};

// The shared browser harness imports this stable name for every corpus.
export const executeCorpus = executeDependentFin;
