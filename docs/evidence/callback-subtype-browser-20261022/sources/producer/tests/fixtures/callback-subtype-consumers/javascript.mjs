/**
 * Exercise the public callback Subtype API without author sources or tools.
 * This caller runs unchanged in Node, pages, React, and dedicated workers.
 *
 * @file
 */

/**
 * Run the complete callback contract and return its deterministic counts.
 *
 * @param api - Installed callback-subtypes package.
 */
export const checkCallbackSubtypes = api => {
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

	equal(api.callHost(api.withRecovery(value => {
		callbackCalls++;
		return value + 1n;
	}, 1n)), 2n, "valid host result");
	let calls = 0;
	rejects(() => api.callHost(value => { calls++; return value; })
		, /requires withRecovery/u, "missing recovery");
	equal(calls, 0, "missing recovery stops callback");
	rejects(() => api.callHost(api.withRecovery(value => { calls++; return value; }, 0n))
		, /failed \(5\)/u, "invalid recovery");
	equal(calls, 0, "invalid recovery stops callback");
	calls = 0;
	rejects(() => api.callHost(api.withRecovery(() => { calls++; return 0n; }, 1n))
		, /failed \(5\)/u, "invalid host result");
	equal(calls, 1, "invalid host result calls callback once");
	callbackCalls += calls;
	const original = new Error("host callback failed");
	equal(rejects(() => api.callHost(api.withRecovery(() => { throw original; }, 1n))
		, null, "host exception"), original, "host exception identity");
	equal(api.callHost(api.withRecovery(value => value, 1n)), 1n, "host recovery reuse");

	equal(api.callHostMixed(api.withRecovery((marker, value) => {
		callbackCalls++;
		equal(marker, 7n, "mixed host marker");
		return value + 2n;
	}, 1n)), 3n, "mixed host result");
	const mixed = api.makeMixedClosure(0n);
	equal(mixed(9n, 2n), 2n, "mixed closure result");
	rejects(() => mixed(9n, 0n), /failed \(5\)/u, "mixed closure argument");
	equal(mixed(9n, 3n), 3n, "mixed closure recovery");
	equal(mixed.dispose(), true, "mixed closure disposal");

	const closure = api.makeClosure(9n);
	equal(closure(2n), 2n, "closure result");
	rejects(() => closure(0n), /failed \(5\)/u, "closure argument");
	equal(closure(3n), 3n, "closure recovery");
	equal(closure.dispose(), true, "closure disposal");

	deep(api.callHostContainer(api.withRecovery(
		() => ({ ok: { tag: "some", value: 2n } })
		, { ok: { tag: "some", value: 1n } }
	)), { ok: { tag: "some", value: 2n } }, "nested host result");
	const container = api.makeContainerClosure(0n);
	deep(container([{ tag: "none" }]), { tag: "none" }, "nested closure result");
	rejects(() => container([{ tag: "some", value: 0n }])
		, /failed \(5\)/u, "nested closure argument");
	deep(container([]), { tag: "none" }, "nested closure recovery");
	equal(container.dispose(), true, "nested closure disposal");

	return { checks, rejections, callbackCalls };
};

/**
 * Validate a browser request before touching the installed API.
 *
 * @param request - Explicit route and browser realm.
 * @param api - Installed callback-subtypes package.
 */
export const executeCorpus = (request, api) => {
	const profiles = ["browser-javascript", "browser-react", "browser-worker"];
	if(!request || Object.keys(request).sort().join(",") !== "module,profile,route"
		|| request.module !== "callbacksubtypes"
		|| !profiles.includes(request.profile)
		|| !["ordinary", "reviewed"].includes(request.route))
		throw new Error("Invalid callback Subtype browser request");
	return { route: request.route, ...checkCallbackSubtypes(api) };
};
