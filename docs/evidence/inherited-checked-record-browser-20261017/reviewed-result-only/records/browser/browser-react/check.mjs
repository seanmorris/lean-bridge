/**
 * Public caller for installed inherited checked-record packages.
 * Expected values and failures are independent of generated bridge metadata.
 *
 * @file
 */

const snapshot = value => {
	const visiting = new Set();
	const encode = item => {
		if(item === null) return ["null"];
		const type = typeof item;
		if(type === "undefined") return [type];
		if(type === "bigint") return [type, item.toString()];
		if(type === "number") return [type, Object.is(item, -0) ? "-0" : String(item)];
		if(type === "string" || type === "boolean") return [type, item];
		if(type !== "object") throw new TypeError(`Unsupported snapshot type: ${type}`);
		if(visiting.has(item)) throw new TypeError("Cyclic snapshot input");
		const prototype = Object.getPrototypeOf(item), array = Array.isArray(item);
		if(array ? prototype !== Array.prototype
			: prototype !== Object.prototype && prototype !== null)
			throw new TypeError("Unsupported snapshot prototype");
		const keys = Reflect.ownKeys(item);
		if(keys.some(key => typeof key !== "string"))
			throw new TypeError("Unsupported snapshot symbol key");
		visiting.add(item);
		try
		{
			return [
				array ? "array" : prototype === null ? "null-prototype-object" : "object"
				, keys.sort().map(key => {
					const descriptor = Object.getOwnPropertyDescriptor(item, key);
					if(!Object.hasOwn(descriptor, "value"))
						throw new TypeError("Unsupported snapshot accessor");
					return [key, encode(descriptor.value)];
				})
			];
		}
		finally
		{ visiting.delete(item); }
	};
	return JSON.stringify(encode(value));
};

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Build one exact inherited checked-record constructor diagnostic.
 *
 * @param name - Public callable name.
 * @param suffix - Literal path below the parameter root.
 * @param constructor - Unqualified Lean constructor name.
 * @param parameter - Zero-based parameter position.
 */
export const inheritedCheckedRecordConstructorRefusal = (
	name, suffix, constructor, parameter = 0
) => {
	if(typeof name !== "string" || typeof suffix !== "string"
		|| typeof constructor !== "string" || !Number.isSafeInteger(parameter)
		|| parameter < 0)
		throw new TypeError("Expected an inherited checked-record diagnostic site");
	return new RegExp(
		`^${escapeRegExp(name)}\\.(?:arg${parameter}|value${parameter})${escapeRegExp(suffix)}`
		+ ` was rejected by InheritedCheckedRecords\\.${escapeRegExp(constructor)}$`, "u"
	);
};

/**
 * Exercise the complete full or result-only inherited checked-record API.
 *
 * @param api - Installed package exports.
 * @param root0 - Explicit package-selection options.
 * @param root0.resultOnly - Whether only Lean-produced results are exported.
 */
export const checkInheritedCheckedRecords = (api, { resultOnly = false } = {}) => {
	if(typeof resultOnly !== "boolean")
		throw new TypeError("Expected an explicit result-only boolean");
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const rounds = 256;
	const check = (condition, label) => {
		if(!condition) throw new Error(`failed: ${label}`);
		checks++;
	};
	const equal = (actual, expected, label) =>
		check(snapshot(actual) === snapshot(expected), label);
	const invoke = (name, arguments_, expected, label = name) => {
		const before = snapshot(arguments_); calls++;
		const result = api[name](...arguments_);
		equal(result, expected, label);
		check(snapshot(arguments_) === before, `${label} preserved every input`);
		snapshots++;
		return result;
	};
	const refused = (name, arguments_, pattern) => {
		if(!(pattern instanceof RegExp)) throw new TypeError("Expected an exact refusal pattern");
		const before = snapshot(arguments_); let failure; calls++;
		try
		{ api[name](...arguments_); }
		catch(error)
		{ failure = error; }
		if(!failure) throw new Error(`accepted: ${name}`);
		check(pattern.test(String(failure.message)), `${name} wrong refusal: ${failure.message}`);
		check(snapshot(arguments_) === before, `${name} rejection preserved every input`);
		snapshots++; rejections++;
	};
	const span = (lo, hi) => ({ lo, hi });
	const ticket = (lo, hi, word) => ({ toSpan: span(lo, hi), word });
	const stamped = (lo, hi, word, mark) => ({ toTicket: ticket(lo, hi, word), mark });
	const produced = value => ticket(value, value, value + 1n);
	const producedStamped = value => stamped(value, value, value + 1n, 0n);
	const refusedBy = {
		parent: inheritedCheckedRecordConstructorRefusal(
			"first", ".toSpan", "mkSpan"
		)
		, word: inheritedCheckedRecordConstructorRefusal("first", ".word", "mkWord")
		, ticket: inheritedCheckedRecordConstructorRefusal("first", "", "mkTicket")
		, pairParent: inheritedCheckedRecordConstructorRefusal(
			"pair", ".toSpan", "mkSpan"
		)
		, pairTicket: inheritedCheckedRecordConstructorRefusal("pair", "", "mkTicket")
		, stamped: inheritedCheckedRecordConstructorRefusal("nested", "", "mkStamped")
		, alias: inheritedCheckedRecordConstructorRefusal("aliased", "", "mkTicket")
	};
	const huge = 1n << 100n;
	for(const value of [0n, 4n, huge])
	{
		invoke("produce", [value], produced(value));
		invoke("produceStamped", [value], producedStamped(value));
	}
	if(resultOnly)
	{
		for(const name of ["first", "normalized", "pair", "aliased", "nested", "echo"])
			check(!Object.hasOwn(api, name), `result-only package omitted ${name}`);
		for(let round = 0n; round < BigInt(rounds); round++)
		{
			invoke("produce", [huge + round], produced(huge + round));
			invoke("produceStamped", [huge + round], producedStamped(huge + round));
		}
		return { checks, rejections, calls, snapshots, recoveries, rounds };
	}
	const first = ticket(2n, 3n, 4n), rawRight = ticket(4n, 1n, 999n);
	invoke("first", [first], 9n);
	invoke("normalized", [ticket(4n, 1n, 0n)], 11n);
	invoke("pair", [first, rawRight], 10n);
	invoke("aliased", [ticket(4n, 1n, 4n)], 5n);
	invoke("nested", [stamped(1n, 2n, 4n, 3n)], 7n);
	invoke("echo", [ticket(1n, 2n, 0n)], ticket(1n, 2n, 3n));
	refused("first", [ticket(4n, 1n, 5n)], refusedBy.parent);
	refused("first", [ticket(1n, 2n, 0n)], refusedBy.word);
	refused("first", [ticket(1n, 5n, 3n)], refusedBy.ticket);
	refused("nested", [stamped(1n, 2n, 9n, 8n)]
		, /^nested\.(?:arg0|value0)\.mark must be bigint below 8$/u);
	refused("nested", [stamped(1n, 2n, 4n, 5n)], refusedBy.stamped);
	refused("aliased", [ticket(1n, 5n, 3n)], refusedBy.alias);
	refused("pair", [ticket(4n, 1n, 5n), rawRight], refusedBy.pairParent);
	refused("pair", [ticket(1n, 5n, 3n), rawRight], refusedBy.pairTicket);
	const shape = /does not match the declared copied fields/u;
	refused("first", [{ ...first, linked: true }], shape);
	refused("first", [{ word: 4n }], shape);
	refused("nested", [{ ...stamped(1n, 2n, 4n, 3n), stamped: true }], shape);
	equal(rawRight, ticket(4n, 1n, 999n), "normalization never mutated reused input");
	for(let round = 0n; round < BigInt(rounds); round++)
	{
		const n = round + 10n, valid = ticket(n, n + 1n, n + 2n);
		invoke("first", [valid], 3n * n + 3n, "round accepted");
		invoke("normalized", [ticket(n + 2n, n, 0n)], 4n * n + 5n
			, "round normalized");
		invoke("pair", [valid, ticket(n + 2n, n, 0n)], 3n * n + 5n
			, "round repeated position");
		invoke("aliased", [ticket(n + 2n, n, 2n * n + 1n)], 2n * n + 2n
			, "round alias");
		const mark = round % 8n;
		invoke("nested", [stamped(mark, mark, mark + 1n, mark)]
			, 2n * mark + 1n, "round nested");
		refused("first", [ticket(n + 1n, n, n + 2n)], refusedBy.parent);
		refused("first", [ticket(0n, 1n, 0n)], refusedBy.word);
		refused("first", [ticket(0n, n + 2n, n + 1n)], refusedBy.ticket);
		refused("nested", [stamped(0n, 9n, 9n, 8n)]
			, /^nested\.(?:arg0|value0)\.mark must be bigint below 8$/u);
		refused("nested", [stamped(0n, 6n, 6n, 7n)], refusedBy.stamped);
		invoke("first", [valid], 3n * n + 3n, "recovery after nested rejection");
		recoveries++;
	}
	equal(rawRight, ticket(4n, 1n, 999n), "all rounds preserved reused input");
	return { checks, rejections, calls, snapshots, recoveries, rounds };
};
