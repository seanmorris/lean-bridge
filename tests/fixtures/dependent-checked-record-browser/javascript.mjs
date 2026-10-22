/**
 * Exercise dependent checked records only through an installed public package.
 *
 * @file
 */

/**
 * Run the complete public dependent-record corpus.
 *
 * @param api - Installed generated package exports.
 * @param resultOnly - Whether only Lean-produced results are exported.
 * @param reviewed - Whether reviewed Binding IR supplies public parameter names.
 */
export const checkDependentRecords = (
	api, resultOnly = false, reviewed = false
) => {
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const check = (condition, label) => {
		if(!condition) throw new Error(`failed: ${label}`);
		checks++;
	};
	const invoke = (call, ...arguments_) => {
		calls++;
		return call(...arguments_);
	};
	const record = (value, bound, below, label) => {
		check(Object.keys(value).sort().join() === "below,bound"
			&& value.bound === bound && value.below === below, label);
		snapshots++;
	};
	if(resultOnly)
	{
		for(let seed = 0n; seed < 512n; seed++)
			record(invoke(api.dependentResult, seed), seed + 1n, seed, "result");
		const huge = 2n ** 130n;
		record(invoke(api.dependentResult, huge), huge + 1n, huge
			, "huge result");
		return { checks, rejections, calls, snapshots, recoveries };
	}
	const refused = (call, label) => {
		try
		{ invoke(call); }
		catch(error)
		{
			const parameter = reviewed ? "value0" : "arg0";
			if(error?.message !== `${parameter} was rejected by `
				+ "DependentRecords.mkDependent")
				throw new Error(`wrong refusal: ${label}: ${error?.message}`
					, { cause: error });
			rejections++;
			check(invoke(api.dependentTotal, { bound: 2n, below: 1n }) === 3n
				, `${label} recovery`);
			recoveries++;
			return;
		}
		throw new Error(`accepted: ${label}`);
	};
	const shape = (call, label) => {
		try
		{ invoke(call); }
		catch
		{
			rejections++;
			check(invoke(api.dependentTotal, { bound: 2n, below: 1n }) === 3n
				, `${label} recovery`);
			recoveries++;
			return;
		}
		throw new Error(`accepted: ${label}`);
	};
	const first = { bound: 3n, below: 2n };
	check(invoke(api.dependentTotal, first) === 5n, "total");
	record(invoke(api.dependentRoundtrip, first), 3n, 2n, "roundtrip");
	check(first.bound === 3n && first.below === 2n
		&& Object.keys(first).sort().join() === "below,bound", "caller unchanged");
	refused(() => api.dependentTotal({ bound: 2n, below: 2n }), "equal bound");
	refused(() => api.dependentTotal({ bound: 0n, below: 0n }), "zero bound");
	shape(() => api.dependentTotal({ bound: 3n, below: 2n, valid: true })
		, "supplied proof");
	shape(() => api.dependentTotal({ bound: 3n }), "missing dependent field");
	const huge = 2n ** 130n;
	check(invoke(api.dependentTotal, { bound: huge, below: huge - 1n })
		=== 2n * huge - 1n, "huge total");
	record(invoke(api.dependentRoundtrip, { bound: huge, below: huge - 1n })
		, huge, huge - 1n, "huge roundtrip");
	for(let below = 0n; below < 256n; below++)
	{
		const bound = below + 1n, value = { bound, below };
		check(invoke(api.dependentTotal, value) === bound + below, "loop total");
		record(invoke(api.dependentRoundtrip, value), bound, below, "loop roundtrip");
		refused(() => api.dependentTotal({ bound, below: bound }), "loop bound");
	}
	return { checks, rejections, calls, snapshots, recoveries };
};
