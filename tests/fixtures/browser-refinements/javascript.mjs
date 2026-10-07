/**
 * Refinement checks shared by the browser page, React effect and dedicated worker.
 *
 * @file
 */

/**
 * Exercise every refined export of the installed package and count what passed.
 * Rejections must come from the package, never from the harness, so each invalid
 * call is expected to throw and the next valid call must still succeed.
 *
 * @param request - Installed package request (module name and profile).
 * @param api - Loaded public API.
 */
export const executeCorpus = (request, api) => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const same = (a, b) => JSON.stringify(a, (_, v) => typeof v === "bigint" ? `${v}n` : v) === JSON.stringify(b, (_, v) => typeof v === "bigint" ? `${v}n` : v);
	const rejected = (call, label) => {
		try
		{ call(); }
		catch
		{ rejections++; return; }
		throw new Error(`accepted: ${label}`);
	};
	const none = { tag: "none" }, some = value => ({ tag: "some", value });
	const good = [none, some([2n, { ok: 4n }]), some([0n, { error: 1n }])];
	// Scalar Fin: endpoints, beyond-bound, negative and non-bigint inputs.
	check(api.mirror(3n) === 6n && api.mirror(0n) === 9n && api.mirror(9n) === 0n, "mirror endpoints");
	for(const bad of [10n, 11n, -1n, 3, "3", 2n ** 70n]) rejected(() => api.mirror(bad), `mirror ${String(bad)}`);
	// Structural containers: first, middle and last invalid elements; empty Fin 0; a 2^64 bound; nested pairs and Except.
	const cases = [
		["rows", [[0n, 9n], []], [[], [0n, 9n]], [[[10n]], [[-1n]], [[9]], [[0n, 10n]], [[0n], [10n]]]]
		, ["empty", [], [], [[0n]]]
		, ["huge", [184467440737095516169n], [184467440737095516169n], [[184467440737095516170n]]]
		, ["nested", good, [...good].reverse(), [[some([3n, { ok: 4n }])], [some([2n, { ok: 5n }])], [some([0n, { error: 2n }])]]]];
	for(const [name, value, expected, invalid] of cases)
	{
		check(same(api[name](value), expected), `${name} valid`);
		for(let round = 0; round < 8; round++) for(const bad of invalid)
		{
			rejected(() => api[name](bad), `${name} ${JSON.stringify(bad, (_, v) => typeof v === "bigint" ? `${v}n` : v)}`);
			check(same(api[name](value), expected), `${name} recovers`);
		}
	}
	check(same(good, [none, some([2n, { ok: 4n }]), some([0n, { error: 1n }])]), "caller data unchanged");
	// Author-checked Subtype: the nonempty string and the bounded UInt32 are checked before the export runs.
	check(api.echo("Lean λ 🙂") === "Lean λ 🙂" && api.echo("a\0b") === "a\0b", "echo");
	rejected(() => api.echo(""), "echo empty");
	check(api.use("hello", 9, "!") === "hello9!", "use");
	rejected(() => api.use("", 9, "!"), "use empty text");
	rejected(() => api.use("valid", 10, "!"), "use small at bound");
	rejected(() => api.use("valid", -1, "!"), "use negative");
	for(let round = 0; round < 32; round++)
	{
		rejected(() => api.echo(""), "echo empty again");
		check(api.echo("x") === "x" && api.use("hello", 0, "") === "hello0", "subtype recovers");
	}
	// Direct runtime calls skip the generated JavaScript validation; the compiled adapter entry must still fail the
	// call before any dispatch, for a top-level scalar Fin as much as for containers and Subtypes.
	check(api.raw("mirror", [3n]) === 6n && same(api.raw("rows", [[[0n, 9n], []]]), [[], [0n, 9n]]) && api.raw("echo", ["raw"]) === "raw", "raw valid");
	const rawInvalid = [["mirror", [10n]], ["mirror", [2n ** 70n]], ["rows", [[[10n]]]], ["empty", [[0n]]], ["huge", [[184467440737095516170n]]]];
	rawInvalid.push(["nested", [[some([0n, { error: 2n }])]]], ["echo", [""]], ["use", ["valid", 10, "!"]], ["use", ["", 0, ""]]);
	for(const [name, args] of rawInvalid)
	{
		rejected(() => api.raw(name, args), `raw ${name}`);
		check(api.raw("mirror", [9n]) === 0n && api.raw("use", ["ok", 1, "?"]) === "ok1?", `raw ${name} recovers`);
	}
	return { module: request.module, checks, rejections };
};
