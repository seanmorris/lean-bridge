/**
 * Public caller for installed mutually recursive checked-record npm packages.
 * Expected values and failures are authored independently of generated metadata.
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
			return [array ? "array" : prototype === null ? "null-prototype-object" : "object"
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

/**
 * Exercise recursion, aliases, active cases, exact host failures and recovery.
 *
 * @param api - Installed package exports.
 */
export const checkMutualCheckedRecords = api => {
	let checks = 0, rejections = 0, calls = 0, snapshots = 0, recoveries = 0;
	const failures = {};
	const check = (condition, label) => {
		if(!condition) throw new Error(`failed: ${label}`);
		checks++;
	};
	const equal = (actual, expected, label) =>
		check(snapshot(actual) === snapshot(expected), label);
	const none = () => ({ tag: "none" });
	const some = value => ({ tag: "some", value });
	const stop = () => ({ kind: "stop" });
	const more = packet => ({ kind: "more", packet });
	const envelope = (value, mode, next = none()) => ({ value, mode, next });
	const nested = (outer, mode, inner, innerMode) =>
		envelope(outer, mode, some(more(envelope(inner, innerMode))));
	const invoke = (name, arguments_, expected, label = name) => {
		const before = snapshot(arguments_); calls++;
		const result = api[name](...arguments_);
		equal(result, expected, label);
		check(snapshot(arguments_) === before, `${label} preserved every input`);
		snapshots++;
		return result;
	};
	const refused = (name, arguments_, expectation, key, capture = () => snapshot(arguments_)) => {
		const before = snapshot(capture()); let failure; calls++;
		try
		{ api[name](...arguments_); }
		catch(error)
		{ failure = error; }
		if(!failure) throw new Error(`accepted: ${name}`);
		const matches = typeof expectation === "function"
			? expectation(failure) : expectation.test(String(failure.message));
		check(matches, `${name} wrong refusal: ${failure?.name}: ${failure?.message}`);
		check(snapshot(capture()) === before, `${name} rejection preserved every input`);
		snapshots++; rejections++;
		if(key !== undefined && !Object.hasOwn(failures, key))
			failures[key] = { name: failure.name, message: failure.message };
		return failure;
	};
	const recover = valid => {
		invoke("first", [valid], valid.value + 1n, "recovery after refusal");
		recoveries++;
	};
	const rejectAndRecover = (name, arguments_, expectation, key, capture) => {
		const failure = refused(name, arguments_, expectation, key, capture);
		recover(nested(40n, 2n, 80n, 1n));
		return failure;
	};

	const original = nested(40n, 2n, 80n, 1n);
	invoke("first", [original], 41n);
	invoke("second", [original], 42n);
	invoke("echo", [original], nested(41n, 2n, 81n, 1n));
	invoke("first", [envelope(40n, 2n)], 41n, "inactive option branch");
	invoke("first", [envelope(40n, 2n, some(stop()))], 41n, "active empty variant branch");
	const groups = [some(original), none()];
	invoke("groups", [groups], 2n);
	invoke("echoGroups", [groups], [some(nested(42n, 2n, 82n, 1n)), none()]);
	const produced = invoke("produce", [5n], nested(6n, 1n, 7n, 2n));
	check(!Reflect.ownKeys(produced).includes("linked"), "proof field absent from result");

	const constructorFailure = error => error instanceof Error
		&& !(error instanceof TypeError) && /failed \(5\)$/u.test(error.message);
	rejectAndRecover("first", [nested(100n, 2n, 80n, 1n)]
		, constructorFailure, "outer-subtype");
	rejectAndRecover("first", [nested(40n, 2n, 100n, 1n)]
		, constructorFailure, "late-subtype");
	rejectAndRecover("first", [nested(0n, 2n, 80n, 1n)]
		, constructorFailure, "outer-record");
	rejectAndRecover("first", [nested(40n, 3n, 80n, 1n)]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0)\.mode must be bigint below 3$/u.test(error.message)
		, "outer-fin");
	rejectAndRecover("first", [nested(40n, 2n, 80n, 3n)]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0)\.next\.value\.packet\.mode must be bigint below 3$/u
				.test(error.message)
		, "nested-fin");
	rejectAndRecover("first", [{ ...original, linked: true }]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0) does not match the declared copied fields$/u
				.test(error.message)
		, "erased-proof");
	rejectAndRecover("first", [{ value: 40n, mode: 2n }]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0) does not match the declared copied fields$/u
				.test(error.message)
		, "missing-field");
	rejectAndRecover("first", [envelope(40n, 2n, { tag: "invalid" })]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0)\.next must be Option tag$/u.test(error.message)
		, "option-tag");
	rejectAndRecover("first", [envelope(40n, 2n, some({ kind: "invalid" }))]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0)\.next\.value must be declared variant constructor$/u
				.test(error.message)
		, "variant-tag");
	rejectAndRecover("first", [envelope(40n, 2n, some({ kind: "more" }))]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0)\.next\.value does not match the declared copied fields$/u
				.test(error.message)
		, "missing-active-field");
	rejectAndRecover("first", [envelope(40n, 2n, some({ kind: "stop", packet: original }))]
		, error => error instanceof TypeError
			&& /^first\.(?:arg0|value0)\.next\.value does not match the declared copied fields$/u
				.test(error.message)
		, "inactive-field");

	const cyclic = envelope(40n, 2n);
	cyclic.next = some(more(cyclic));
	rejectAndRecover("first", [cyclic]
		, error => error instanceof TypeError && error.message === "Cyclic copied value"
		, "cycle", () => ({ value: cyclic.value, mode: cyclic.mode
			, self: cyclic.next.value.packet === cyclic }));
	let deep = envelope(40n, 2n);
	for(let index = 0; index < 65; index++) deep = envelope(40n, 2n, some(more(deep)));
	rejectAndRecover("first", [deep]
		, error => error instanceof RangeError
			&& error.message === "Component recursive value depth exceeded", "depth");

	for(let round = 0n; round < 128n; round++)
	{
		const valid = nested(round % 90n, round % 3n, (round + 11n) % 90n, round % 3n);
		invoke("first", [valid], valid.value + 1n, "round accepted");
		refused("first", [nested(40n, 2n, 100n, 1n)], constructorFailure);
		invoke("second", [valid], valid.value + 2n, "round alternate constructor");
		refused("first", [envelope(40n, 2n, some({ kind: "more" }))]
			, /does not match the declared copied fields$/u);
		invoke("groups", [[none(), some(valid)]], 2n, "round alias carrier");
		recoveries++;
	}
	equal(original, nested(40n, 2n, 80n, 1n), "all calls preserved reused input");
	return { checks, rejections, calls, snapshots, recoveries, failures };
};
