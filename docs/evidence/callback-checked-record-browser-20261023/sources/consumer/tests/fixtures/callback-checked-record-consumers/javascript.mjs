/**
 * Exercise the public callback checked-record API without author sources or
 * tools. This caller runs unchanged in Node, pages, React, and dedicated
 * workers. Records cross as plain payload objects; only Lean's constructor
 * accepts or refuses them.
 *
 * @file
 */

/**
 * Run the complete callback contract and return its deterministic counts.
 *
 * @param api - Installed callbackcheckedrecords package.
 */
export const checkCallbackCheckedRecords = api => {
	let checks = 0, rejections = 0, callbackCalls = 0;
	const equal = (actual, expected, label) => {
		if(actual !== expected) throw new Error(`${label}: ${actual} !== ${expected}`);
		checks++;
	};
	const deep = (actual, expected, label) => {
		const encode = value => JSON.stringify(value, (_, item) => typeof item === "bigint" ? `${item}n` : item);
		if(encode(actual) !== encode(expected)) throw new Error(`${label}: ${encode(actual)} !== ${encode(expected)}`);
		checks++;
	};
	const rejects = (operation, pattern, label) => {
		try
		{ operation(); }
		catch(error)
		{
			if(pattern && !pattern.test(String(error?.message ?? error))) throw error;
			rejections++;
			return error;
		}
		throw new Error(`${label}: expected rejection`);
	};
	const interval = (lo, hi) => ({ lo, hi });

	// A host reply is a payload record; Lean's mkInterval accepts or refuses it.
	equal(api.callHost(api.withRecovery(value => {
		callbackCalls++;
		deep(value, interval(1n, 3n), "host argument projects the proof-backed interval");
		return interval(value.lo, value.hi + 2n);
	}, interval(0n, 0n))), 4n, "valid host reply");
	let calls = 0;
	rejects(() => api.callHost(value => { calls++; return value; })
		, /requires withRecovery/u, "missing recovery");
	equal(calls, 0, "missing recovery stops callback");
	rejects(() => api.callHost(api.withRecovery(value => { calls++; return value; }, interval(3n, 1n)))
		, /failed \(5\)/u, "invalid recovery record");
	equal(calls, 0, "invalid recovery stops callback");
	calls = 0;
	rejects(() => api.callHost(api.withRecovery(() => { calls++; return interval(5n, 2n); }, interval(0n, 0n)))
		, /failed \(5\)/u, "invalid host reply");
	equal(calls, 1, "invalid host reply calls callback once");
	callbackCalls += calls;
	const original = new Error("host callback failed");
	equal(rejects(() => api.callHost(api.withRecovery(() => { throw original; }, interval(0n, 0n)))
		, null, "host exception"), original, "host exception identity");
	equal(api.callHost(api.withRecovery(value => value, interval(0n, 0n))), 2n, "host recovery reuse");

	equal(api.callHostMixed(api.withRecovery((marker, value) => {
		callbackCalls++;
		equal(marker, 7n, "mixed host marker");
		return interval(value.lo, value.hi + 1n);
	}, interval(0n, 0n))), 3n, "mixed host reply");
	const mixed = api.makeMixedClosure(0n);
	deep(mixed(9n, interval(2n, 5n)), interval(2n, 5n), "mixed closure projects its interval result");
	rejects(() => mixed(9n, interval(5n, 2n)), /failed \(5\)/u, "mixed closure argument");
	deep(mixed(9n, interval(3n, 3n)), interval(3n, 3n), "mixed closure recovery");
	equal(mixed.dispose(), true, "mixed closure disposal");

	const closure = api.makeClosure(9n);
	equal(closure(interval(2n, 6n)), 4n, "closure result");
	rejects(() => closure(interval(6n, 2n)), /failed \(5\)/u, "closure argument");
	equal(closure(interval(3n, 3n)), 0n, "closure recovery");
	equal(closure.dispose(), true, "closure disposal");

	equal(api.callHostContainer(api.withRecovery(
		value => {
			callbackCalls++;
			deep(value, { tag: "none" }, "nested host argument projects an absent interval");
			return { ok: { tag: "some", value: interval(1n, 4n) } };
		}
		, { ok: { tag: "none" } }
	)), 3n, "nested host reply");
	rejects(() => api.callHostContainer(api.withRecovery(() => ({ ok: { tag: "some", value: interval(4n, 1n) } }), { ok: { tag: "none" } }))
		, /failed \(5\)/u, "nested invalid host reply");
	equal(api.callHostContainer(api.withRecovery(() => ({ error: "none" }), { ok: { tag: "none" } })), 1n, "nested error reply");
	const container = api.makeContainerClosure(0n);
	deep(container([{ tag: "none" }]), { tag: "none" }, "nested closure result");
	rejects(() => container([{ tag: "some", value: interval(4n, 1n) }])
		, /failed \(5\)/u, "nested closure argument");
	deep(container([{ tag: "some", value: interval(1n, 4n) }]), { tag: "none" }, "nested closure recovery");
	equal(container.dispose(), true, "nested closure disposal");

	// A refined payload field: the Subtype constructor runs before the record constructor.
	const weighted = (weight, limit) => ({ weight, limit });
	equal(api.callHostNested(api.withRecovery(value => {
		callbackCalls++;
		deep(value, weighted(1n, 2n), "nested host argument projects the weighted record");
		return weighted(2n, 5n);
	}, weighted(1n, 1n))), 3n, "weighted host reply");
	rejects(() => api.callHostNested(api.withRecovery(() => weighted(0n, 5n), weighted(1n, 1n)))
		, /failed \(5\)/u, "zero weight refused by the Subtype constructor");
	rejects(() => api.callHostNested(api.withRecovery(() => weighted(6n, 5n), weighted(1n, 1n)))
		, /failed \(5\)/u, "weight above limit refused by the record constructor");
	const nested = api.makeNestedClosure(0n);
	equal(nested(weighted(2n, 5n)), 3n, "weighted closure result");
	rejects(() => nested(weighted(0n, 5n)), /failed \(5\)/u, "weighted closure zero weight");
	rejects(() => nested(weighted(6n, 5n)), /failed \(5\)/u, "weighted closure weight above limit");
	equal(nested(weighted(1n, 1n)), 0n, "weighted closure recovery");
	equal(nested.dispose(), true, "weighted closure disposal");

	return { checks, rejections, callbackCalls };
};

/**
 * Validate a browser request before touching the installed API.
 *
 * @param request - Explicit route and browser realm.
 * @param api - Installed callbackcheckedrecords package.
 */
export const executeCorpus = (request, api) => {
	const profiles = ["browser-javascript", "browser-react", "browser-worker"];
	if(!request || Object.keys(request).sort().join(",") !== "module,profile,route"
		|| request.module !== "callbackcheckedrecords"
		|| !profiles.includes(request.profile)
		|| !["ordinary", "reviewed"].includes(request.route))
		throw new Error("Invalid callback checked-record browser request");
	return { route: request.route, ...checkCallbackCheckedRecords(api) };
};
