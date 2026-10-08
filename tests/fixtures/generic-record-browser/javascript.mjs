/**
 * Generic-record checks shared by the browser page, React effect and dedicated worker.
 *
 * @file
 */

const text = value => JSON.stringify(value, (_, item) => typeof item === "bigint" ? `${item}n` : item);

/**
 * Call every alias-named export of the installed package with exact expected values, require each
 * malformed shape to be rejected by the package, and read each record's instantiation from the
 * descriptor the installed runtime loads.
 *
 * @param request - Installed package request (module name and profile).
 * @param api - Loaded public API and the installed component descriptor.
 */
export const executeCorpus = (request, api) => {
	let checks = 0, rejections = 0;
	const check = (ok, label) => { if(!ok) throw new Error(`failed: ${label}`); checks++; };
	const same = (actual, expected, label) => check(text(actual) === text(expected), `${label}: ${text(actual)}`);
	const rejected = (call, label) => {
		try
		{ call(); }
		catch
		{ rejections++; return; }
		throw new Error(`accepted: ${label}`);
	};
	const box = (value, count) => ({ value, count });
	const wide = 2n ** 70n;
	same(api.bump(box(4n, 1n)), box(5n, 2n), "bump");
	same(api.again(box(4n, 1n)), box(8n, 1n), "again");
	same(api.shout(box("héllo 🙂", 3n)), box("héllo 🙂!", 3n), "shout");
	same(api.swapNamed({ first: "a", second: 1n }), { first: "a!", second: 2n }, "swapNamed");
	same([api.orZero(box({ tag: "some", value: 5n }, 2n)), api.orZero(box({ tag: "none" }, 2n))], [7n, 2n], "orZero");
	same([api.total([box(1n, 0n), box(wide, 0n)]), api.total([])], [wide + 1n, 0n], "total");
	same([api.firstBoxes(2n), api.firstBoxes(0n)], [{ tag: "some", value: [box(0n, 2n), box(1n, 2n)] }, { tag: "none" }], "firstBoxes");
	same(api.unpair({ first: box(3n, 0n), second: box("abcd", 0n) }), 7n, "unpair");
	same(api.retag({ tag: "t", payload: 1n }), { tag: "t#", payload: 2n }, "retag");
	same(api.relabel({ label: "m" }), { label: "m?" }, "relabel");
	// Finite specializations of one generic echo: a second alias, two namespaces, lists and options.
	same([api.echoNatBox(box(4n, 1n)), api.echoAgain(box(4n, 1n)), api.echoTextBox(box("héllo 🙂", 1n))], [box(4n, 1n), box(4n, 1n), box("héllo 🙂", 1n)], "echo records");
	same([api.echoLeft(box(5n, 2n)), api.echoRight(box(6n, 3n))], [box(5n, 2n), box(6n, 3n)], "echo namespaces");
	same([api.echoBoxes([box(wide, 0n)]), api.echoBoxes([])], [[box(wide, 0n)], []], "echoBoxes");
	const optionalBoxes = [{ tag: "some", value: [box(3n, 0n)] }, { tag: "none" }, { tag: "some", value: [] }];
	same(optionalBoxes.map(value => api.echoOptionalBoxes(value)), optionalBoxes, "echoOptionalBoxes");
	same([api.echoNats([0n, wide]), api.echoNats([]), api.echoOptionalNat({ tag: "some", value: wide }), api.echoOptionalNat({ tag: "none" })]
		, [[0n, wide], [], { tag: "some", value: wide }, { tag: "none" }], "echo containers");
	// Array fields: an Array argument, an Array of named records, and a record over one.
	const row = Object.freeze([box(2n, 3n), box(wide, 1n), box(0n, 7n)].map(Object.freeze));
	const arrayBox = Object.freeze(box(Object.freeze([1n, wide]), 3n));
	same([api.pushCount(arrayBox), api.pushCount(box([], 0n))], [box([1n, wide, 3n], 4n), box([0n], 1n)], "pushCount");
	same([api.rowTotal(row), api.rowTotal([])], [wide + 6n, 0n], "rowTotal");
	same([api.rowOf(3n), api.rowOf(0n)], [[box(0n, 3n), box(1n, 3n), box(2n, 3n)], []], "rowOf");
	same([api.rowBoxSum(box(row, 10n)), api.rowBoxSum(box([], 4n))], [wide + 12n, 4n], "rowBoxSum");
	same([arrayBox, row], [box([1n, wide], 3n), [box(2n, 3n), box(wide, 1n), box(0n, 7n)]], "caller data unchanged");
	rejected(() => api.bump({ value: "x", count: 1n }), "wrong field type");
	rejected(() => api.bump({ value: 4n }), "missing field");
	rejected(() => api.bump({ value: 4n, count: 1n, extra: 1n }), "extra field");
	rejected(() => api.unpair({ first: box(3n, 0n), second: box(4n, 0n) }), "wrong nested record");
	rejected(() => api.total([{ value: 1n }]), "list element missing field");
	rejected(() => api.retag({ tag: 1n, payload: 1n }), "wrong instantiated field");
	rejected(() => api.relabel({ label: "m", id: 1n }), "phantom argument field");
	rejected(() => api.echoLeft({ value: -1n, count: 0n }), "negative specialized field");
	rejected(() => api.echoRight({ value: 1n }), "missing specialized field");
	rejected(() => api.echoBoxes([{ value: 1, count: 0n }]), "invalid specialized list element");
	rejected(() => api.echoOptionalBoxes({ tag: "some", value: [{}] }), "invalid specialized nested record");
	rejected(() => api.echoOptionalNat({ tag: "some", value: 1 }), "invalid specialized option element");
	// The first, middle and last element of each Array is checked.
	for(const index of [0, 1, 2])
	{
		const broken = row.map((item, at) => at === index ? { value: item.value } : item);
		rejected(() => api.rowTotal(broken), `row element ${index}`);
		rejected(() => api.rowBoxSum(box(broken, 0n)), `row field element ${index}`);
		rejected(() => api.pushCount(box([1n, 2n, 3n].map((item, at) => at === index ? Number(item) : item), 0n)), `array field element ${index}`);
	}
	rejected(() => api.pushCount(box("1", 0n)), "array field is not an array");
	rejected(() => api.rowBoxSum(box([box(1n, 0n)], -1n)), "negative count beside an array field");
	for(let round = 0; round < 1000; round++)
	{
		rejected(() => api.bump({ value: round, count: 1n }), "round");
		check(api.bump(box(BigInt(round), 0n)).value === BigInt(round + 1), "recovers");
	}
	// Identity: the Binding IR the installed runtime loads keeps each alias's own definition and origin.
	const records = api.descriptor.bindingIr.types.filter(type => type.kind === "record");
	const named = name => records.find(type => type.id === `lean:OnboardingSmall.${name}`);
	const [natBox, again] = [named("NatBox"), named("NatBoxAgain")];
	check(natBox && again && natBox.id !== again.id && text(natBox.fields) === text(again.fields), "two aliases of one application keep two definitions");
	check(text(natBox.source.extensions["lean-lang.org/instantiation"]) === text(again.source.extensions["lean-lang.org/instantiation"]), "two aliases share one origin");
	check(!api.descriptor.bindingIr.declarations.some(item => item.parameters.concat([item.result]).some(site => text(site.type).includes("OnboardingSmall.Marker\""))), "the phantom argument is never a signature type");
	// Each specialization is its own export over the one generic, which is never exported itself.
	const declarations = api.descriptor.bindingIr.declarations, specialized = declarations.filter(item => item.source.declaration === "OnboardingSmall.echo");
	check(specialized.length > 0 && !declarations.some(item => item.id === "lean:OnboardingSmall.echo"), "the generic declaration is not exported");
	check(specialized.every(item => item.typeParameters.length === 0 && text(item.parameters[0].type) === text(item.result.type)), "specializations are closed and keep their type");
	const specializations = Object.fromEntries(specialized.map(item => [item.id, item.parameters[0].type]).sort(([a], [b]) => a < b ? -1 : 1));
	const instantiations = Object.fromEntries(records.map(type => [type.id, type.source.extensions?.["lean-lang.org/instantiation"] ?? null])
		.sort(([a], [b]) => a < b ? -1 : 1));
	return { module: request.module, checks, rejections, instantiations, specializations };
};
