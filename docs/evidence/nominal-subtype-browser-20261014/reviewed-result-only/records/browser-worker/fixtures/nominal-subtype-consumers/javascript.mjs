/**
 * Public nominal Subtype caller for installed Node and browser packages.
 * Expected values are independent of generated metadata and adapter code.
 *
 * @file
 */
import { structuralValueSnapshot as snapshot } from "../structural-subtype-consumers/javascript.mjs";

/**
 * Check per-site normalization, result projection, rejected inputs and recovery.
 *
 * @param api - An installed public API, or an explicit oracle-test double.
 * @param options - Select the independently packaged result-only API.
 * @param options.resultOnly - Do not call any input-refined export.
 */
export const checkNominalSubtypes = (api, { resultOnly = false } = {}) => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const equal = (actual, expected, label) => check(snapshot(actual) === snapshot(expected), label);
	const call = (name, arguments_, expected) => {
		const before = snapshot(arguments_);
		const result = api[name](...arguments_);
		equal(result, expected, name);
		check(snapshot(arguments_) === before, `${name} input unchanged`);
		return result;
	};
	const refused = (name, arguments_, pattern = /failed \(5\)/u) => {
		const before = snapshot(arguments_);
		try
		{ api[name](...arguments_); }
		catch(error)
		{
			if(!pattern.test(String(error?.message))) throw new Error(`wrong rejection: ${name}: ${error?.message}`, { cause: error });
			check(snapshot(arguments_) === before, `${name} rejected input unchanged`);
			rejections++; return;
		}
		throw new Error(`accepted: ${name}`);
	};
	const some = value => ({ tag: "some", value }), none = { tag: "none" };
	const box = (payload, digit = 2n) => ({ payload, digit });
	const values = value => [none, some(box(value + 1n))];
	const huge = 1n << 100n;
	// An output outside both constructor limits must still project exactly.
	for(const value of [0n, 40n, huge])
	{
		call("scalar", [value], value + 1n);
		call("produceEnvelope", [value], box(value + 1n));
		call("arrayValues", [value], [value + 1n, value + 2n]);
		call("listValues", [value], [value + 1n, value + 2n]);
		call("optional", [value], value === 0n ? none : some(value + 1n));
		call("product", [value], [value + 1n, value + 2n]);
		call("branch", [value], value === 0n ? { error: 1n } : { ok: value + 1n });
		call("groupValues", [value], values(value));
		call("pairValues", [value], { left: values(value), right: values(value + 1n) });
		call("eventValue", [value], { kind: "box", value: box(value + 1n) });
		call("eventEmpty", [value], { kind: "empty" });
		call("eventChoices", [value], { kind: "choices", values: [none, some({ ok: value + 1n }), some({ error: value + 2n })] });
		call("noItems", [value], []);
	}
	if(resultOnly)
	{
		for(let round = 0n; round < 1000n; round++)
			call("pairValues", [huge + round], { left: values(huge + round), right: values(huge + round + 1n) });
		return { checks, rejections };
	}
	const input = box(40n), shared = { left: input, right: input };
	call("first", [input], 41n); call("second", [input], 42n);
	call("combine", [input, input], 4142n); call("nested", [shared], 4142n);
	call("first", [box(99n)], 100n); call("second", [box(89n)], 91n);
	call("first", [box(90n)], 91n);
	refused("first", [box(100n)]); refused("second", [box(90n)]);
	refused("combine", [box(100n), input]); refused("combine", [input, box(90n)]);
	refused("nested", [{ left: box(100n), right: input }]);
	refused("nested", [{ left: input, right: box(90n) }]);
	call("echo", [input], box(41n));
	for(const [name, first, second] of [["eventFirst", 1n, 2n], ["eventSecond", 2n, 1n]])
	{
		call(name, [{ kind: "empty" }], 0n);
		call(name, [{ kind: "box", value: input }], 40n + first);
		call(name, [{ kind: "choices", values: [] }], 0n);
		call(name, [{ kind: "choices", values: [none] }], 0n);
		call(name, [{ kind: "choices", values: [none, some({ ok: 40n })] }], 40n + first);
		call(name, [{ kind: "choices", values: [some({ error: 40n }), none] }], 40n + second);
		for(const branch of ["ok", "error"])
			for(const position of [0, 1, 2])
			{
				const items = [some({ ok: 40n }), none, some({ error: 40n })];
				items[position] = some({ [branch]: 100n });
				refused(name, [{ kind: "choices", values: items }]);
			}
	}
	const left = [none, some(input), some(box(1n, 0n))], right = [some(box(2n, 1n)), none];
	const normalizedLeft = [none, some(box(41n)), some(box(2n, 0n))];
	const normalizedRight = [some(box(4n, 1n)), none];
	call("aliases", [left, right], 47n);
	call("inspectAliasPair", [{ left, right }], 47n);
	call("echoGroups", [left], normalizedLeft);
	const projected = call("echoPair", [{ left, right }], { left: normalizedLeft, right: normalizedRight });
	call("echoPair", [projected], { left: [none, some(box(42n)), some(box(3n, 0n))], right: [some(box(6n, 1n)), none] });
	call("echoEvent", [{ kind: "choices", values: [none, some({ ok: 40n }), some({ error: 40n })] }], { kind: "choices", values: [none, some({ ok: 41n }), some({ error: 42n })] });
	call("echoEvent", [{ kind: "empty" }], { kind: "empty" });
	call("echoEvent", [{ kind: "box", value: input }], { kind: "box", value: box(41n) });
	call("echoGroups", [[]], []);
	call("echoPair", [{ left: [], right: [none] }], { left: [], right: [none] });
	for(const position of [0, 1, 2])
	{
		const bad = [some(input), none, some(input)]; bad[position] = some(box(100n));
		refused("echoGroups", [bad]);
		refused("inspectAliasPair", [{ left: bad, right }]);
		refused("inspectAliasPair", [{ left, right: bad }]);
	}
	// The late Fin must be checked before any selected constructor executes.
	refused("combine", [box(100n), box(40n, 3n)], /^combine\.(?:arg1|value1)\.digit must be bigint below 3$/u);
	refused("nested", [{ left: box(100n), right: box(40n, 3n) }], /^nested\.(?:arg0|value0)\.right\.digit must be bigint below 3$/u);
	refused("aliases", [[some(box(100n))], [none, some(box(40n, 3n))]], /^aliases\.(?:arg1|value1)\.1\.value\.digit must be bigint below 3$/u);
	refused("echoEvent", [{ kind: "box", value: box(100n, 3n) }], /^echoEvent\.(?:arg0|value0)\.value\.digit must be bigint below 3$/u);
	call("plainFin", [2n], 2n);
	refused("plainFin", [3n], /^plainFin\.(?:arg0|value0) must be bigint below 3$/u);
	for(let round = 0; round < 1000; round++)
	{
		const bad = [none, some(box(1n)), none]; bad[round % 3] = some(box(90n));
		refused("echoPair", [{ left, right: bad }]);
		call("echoPair", [{ left, right }], { left: normalizedLeft, right: normalizedRight });
	}
	return { checks, rejections };
};
