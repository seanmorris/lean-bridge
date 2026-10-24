/**
 * Independent compact call plans for nominal and recursive graph entry probes.
 * Compiler output supplies identities; these cases supply semantic order.
 *
 * @file
 */
import assert from "node:assert/strict";
import { nominalPrimitiveSubtypeFields } from "./nominal-primitive-subtype-fixture.mjs";
import { validateSubtypeEntrySelection } from "./php-wasm-subtype-entry-c.mjs";

const kinds = ["validator", "constructor", "adapter", "source"];
const counts = entries => Object.fromEntries(kinds.map(kind => [
	kind, entries.filter(item => item.kind === kind).length
]));

const escaped = text => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * Close compiler-classified entries that cannot carry a per-call marker.
 * Module-initialized values are read, not called; a reduced-arity source runs
 * in an implementation the marked wrapper only delegates to.
 *
 * @param selected - Complete entry selection.
 * @param options - Classified globals and reduced-arity call targets.
 * @param options.globalDefinitions - Authored entries compiled as module-initialized values.
 * @param options.reducedArity - Authored sources reached only through a reduced-arity target.
 * @param options.unreachedSources - Authored sources no compiled call reaches.
 */
export const phpWasmUnmarkedEntries = (selected, {
	globalDefinitions = [], reducedArity = [], unreachedSources = []
} = {}) => {
	assert.ok(Array.isArray(globalDefinitions) && Array.isArray(reducedArity) && Array.isArray(unreachedSources));
	const closeItems = (items, kinds, fields) => items.map(item => {
		assert.deepEqual(Object.keys(item ?? {}).sort(), [...fields].sort());
		assert.ok(kinds.includes(item.kind), `${item.symbol} cannot be unmarked`);
		assert.equal(selected.filter(value => value.symbol === item.symbol && value.kind === item.kind
			&& value.label === item.label).length, 1, `selected unmarked entry ${item.symbol}`);
		return structuredClone(item);
	});
	const globals = closeItems(globalDefinitions, ["constructor", "source"], ["symbol", "kind", "label"]);
	const reduced = closeItems(reducedArity, ["source"], ["symbol", "kind", "label", "target"]);
	for(const item of reduced) assert.equal(item.target, `l_${item.label.replaceAll(".", "_")}___redArg`);
	const unreached = new Set(closeItems(unreachedSources, ["source"], ["symbol", "kind", "label"])
		.map(item => `${item.kind}/${item.label}`));
	const symbols = [...globals, ...reduced, ...unreachedSources].map(item => item.symbol);
	assert.equal(new Set(symbols).size, symbols.length, "one classification per entry");
	const classes = [["moduleInitialized", globals], ["reducedArity", reduced]].map(([key, items]) => [
		key, new Set(items.map(item => `${item.kind}/${item.label}`))
	]);
	const unmarked = (control, outcome, publicName, planned, count) => {
		assert.ok(!planned.some(entry => unreached.has(`${entry.kind}/${entry.label}`))
			, `${control} cannot plan a source no compiled call reaches`);
		const declared = Object.fromEntries(classes.map(([key, values]) => [key
			, [...new Set(planned.filter(entry => values.has(`${entry.kind}/${entry.label}`)).map(entry => entry.label))].sort()]));
		const entries = planned.filter(entry => !classes.some(([, values]) => values.has(`${entry.kind}/${entry.label}`)));
		const call = { publicName, entries, counts: count(entries) };
		return { control, outcome, call
			, ...Object.fromEntries(Object.entries(declared).filter(([, labels]) => labels.length)) };
	};
	const sources = new Set([...globals, ...reduced].filter(item => item.kind === "source").map(item => item.label));
	// A source is covered by its marker or by an authenticated unmarked classification.
	const reachesSource = value => value.call.counts.source > 0
		|| [...value.moduleInitialized ?? [], ...value.reducedArity ?? []].some(label => sources.has(label));
	// The plan carries only classifications its own calls exercise; the rest are inert module facts.
	const close = cases => {
		assert.ok(cases.some(reachesSource), "some planned call reaches its source");
		const exercised = (key, items) => items.filter(value => cases.some(item => item[key]?.includes(value.label)));
		return { globals: exercised("moduleInitialized", globals), reduced: exercised("reducedArity", reduced) };
	};
	return { unmarked, reachesSource, close };
};

/**
 * Build the exact expected marker sequence for each compact installed call.
 * Graph-carried selections validate each refined position through its own
 * generated graph validator; their order follows the generated conversions.
 *
 * @param family - One explicit #1824 graph family.
 * @param selected - Compiler-derived plus authored marker identities.
 * @param generatedLeanSource - Exact generated adapter source compiled by the probe.
 * @param options - Compiler-classified entry forms and call targets.
 * @param options.globalDefinitions - Authored entries compiled as module-initialized values.
 * @param options.reducedArity - Authored sources reached only through a reduced-arity target.
 * @param options.unreachedSources - Authored sources no compiled call reaches.
 */
export const phpWasmRefinementEntryPlan = (family, selected, generatedLeanSource, options = {}) => {
	validateSubtypeEntrySelection(selected); assert.equal(typeof generatedLeanSource, "string");
	const { unmarked, close } = phpWasmUnmarkedEntries(selected, options);
	const namespace = family.startsWith("nominal-") ? "NominalPrimitiveSubtypes"
		: family === "recursive-subtype" ? "RecursiveSubtypes"
			: family === "recursive-checked-record" ? "RecursiveCheckedRecords"
				: family.startsWith("dependent-") ? "DependentRecords"
					: family.startsWith("value-index-") ? "CheckedRecordValueIndices"
						: family.startsWith("zero-payload-") ? "ZeroPayloadCheckedRecords"
							: null;
	assert.ok(namespace, `unknown entry family: ${family}`);
	const find = (kind, label) => {
		const matches = selected.filter(item => item.kind === kind && item.label === label);
		assert.equal(matches.length, 1, `${kind}/${label}`);
		return { kind, label };
	};
	const optional = (kind, label) => selected.some(item => item.kind === kind && item.label === label)
		? [find(kind, label)] : [];
	const constructor = name => find("constructor", `${namespace}.${name}`);
	const source = name => find("source", `${namespace}.${name}`);
	const adapter = name => find("adapter", `${namespace}.${name}`);
	const fin = name => optional("validator", `${namespace}.${name}:fin_guard_0`);
	const refinement = (name, constructorName = null) => {
		const candidates = selected.filter(item => item.kind === "validator"
			&& item.label.startsWith(`${namespace}.${name}:refinement_0`)
			&& !item.label.includes(":graph_refinement_"));
		if(constructorName === null) return candidates
			.filter(item => item.label === `${namespace}.${name}:refinement_0`)
			.map(item => ({ kind: item.kind, label: item.label }));
		if(candidates.length <= 1) return candidates.map(item => ({ kind: item.kind, label: item.label }));
		const matches = candidates.filter(item => {
			const start = generatedLeanSource.indexOf(`@[export ${item.symbol}]`);
			assert.ok(start >= 0, item.symbol);
			const next = generatedLeanSource.indexOf("\n@[export ", start + 9);
			return generatedLeanSource.slice(start, next < 0 ? undefined : next)
				.includes(`_root_.${namespace}.${constructorName}`);
		});
		assert.equal(matches.length, 1, `${name} refinement validator for ${constructorName}`);
		return [{ kind: "validator", label: matches[0].label }];
	};
	const graph = (name, constructorName) => {
		const candidates = selected.filter(item => item.kind === "validator"
			&& item.label.startsWith(`${namespace}.${name}:graph_refinement_0_`));
		if(candidates.length === 0) return [];
		const indirectConstructor = block => {
			const references = [...block.matchAll(/\b(LbErased\.[A-Za-z0-9_.]+\.via_[a-f0-9]+)\b/gu)]
				.map(match => match[1]);
			return references.some(reference => {
				const start = generatedLeanSource.indexOf(`def ${reference} `);
				assert.ok(start >= 0, reference);
				const next = generatedLeanSource.indexOf("\ndef ", start + 4);
				const definition = generatedLeanSource.slice(start, next < 0 ? undefined : next);
				return definition.includes(`_root_.${namespace}.${constructorName}`);
			});
		};
		const blocks = candidates.map(item => {
			const annotation = `@[export ${item.symbol}]`, start = generatedLeanSource.indexOf(annotation);
			assert.ok(start >= 0, annotation);
			const next = generatedLeanSource.indexOf("\n@[export ", start + annotation.length);
			return { item, block: generatedLeanSource.slice(start, next < 0 ? undefined : next) };
		});
		const direct = blocks.filter(({ block }) => block.includes(`_root_.${namespace}.${constructorName}`));
		const matches = direct.length ? direct : blocks.filter(({ block }) => indirectConstructor(block));
		assert.equal(matches.length, 1, `${name} graph validator for ${constructorName}`);
		return [{ kind: "validator", label: matches[0].item.label }, constructor(constructorName)];
	};
	const constructors = names => names.map(constructor);
	const item = (control, outcome, publicName, planned) => unmarked(control, outcome, publicName, planned, counts);
	const accepted = (control, name, names = [], sourceNames = [name]) => {
		const values = constructors(names);
		return item(control, "accepted", name, [
			...fin(name), ...refinement(name, names[0] ?? null), ...values
			, adapter(name), ...values, ...sourceNames.map(source)
		]);
	};
	const refused = (control, name, names, diagnosis = []) => item(control, "refused", name, [
		...fin(name), ...refinement(name, names[0] ?? null), ...constructors(names)
		, ...diagnosis.flatMap(constructorName => graph(name, constructorName))
	]);
	const graphCarried = selected.some(entry => entry.kind === "public" && /^lg_call\d+$/u.test(entry.symbol));
	const exportBlock = symbol => {
		const annotation = `@[export ${symbol}]`, start = generatedLeanSource.indexOf(annotation);
		assert.ok(start >= 0, annotation);
		assert.equal(generatedLeanSource.indexOf(annotation, start + 1), -1, `unique ${annotation}`);
		const next = generatedLeanSource.indexOf("\n@[export ", start + annotation.length);
		return generatedLeanSource.slice(start, next < 0 ? undefined : next);
	};
	const viaReferences = block => [...new Set([...block.matchAll(/\b(LbErased\.[A-Za-z0-9_.]+\.via_[a-f0-9]+)\b/gu)]
		.map(match => match[1]))];
	// One generated conversion: ordered selected constructors and self-recursion steps.
	const viaSteps = via => {
		const header = `def ${via} `, start = generatedLeanSource.indexOf(header);
		assert.ok(start >= 0, header);
		const ends = ["\ndef ", "\n@[export "].map(token => generatedLeanSource.indexOf(token, start + header.length))
			.filter(index => index >= 0);
		const definition = generatedLeanSource.slice(start, ends.length ? Math.min(...ends) : undefined);
		const body = definition.slice(definition.indexOf(":=") + 2);
		const pattern = new RegExp(`(${escaped(via)})\\b|_root_\\.${escaped(namespace)}\\.([A-Za-z_][A-Za-z0-9_]*)\\b`, "gu");
		const steps = [...body.matchAll(pattern)].flatMap(match => match[1] ? [{ recurse: true }]
			: selected.some(entry => entry.kind === "constructor" && entry.label === `${namespace}.${match[2]}`)
				? [{ constructor: match[2] }] : []);
		assert.equal(steps.filter(step => step.recurse).length, 1, `${via} recurses once`);
		assert.ok(steps.some(step => step.constructor), `${via} constructs a selected refinement`);
		return steps;
	};
	const conversion = name => {
		const adapters = selected.filter(entry => entry.kind === "adapter" && entry.label === `${namespace}.${name}`);
		assert.equal(adapters.length, 1, `${name} Lean adapter`);
		const references = viaReferences(exportBlock(adapters[0].symbol));
		assert.equal(references.length, 1, `${name} converts one recursive graph type`);
		return viaSteps(references[0]);
	};
	// A leaf validator calls its constructor; a checked-record validator rebuilds its value.
	const graphValidator = (name, constructorName) => {
		const blocks = selected.filter(entry => entry.kind === "validator"
			&& entry.label.startsWith(`${namespace}.${name}:graph_refinement_0_`))
			.map(entry => ({ entry, block: exportBlock(entry.symbol) }));
		const direct = blocks.filter(({ block }) => new RegExp(`_root_\\.${escaped(namespace)}\\.${escaped(constructorName)}\\b`, "u").test(block));
		if(direct.length)
		{
			assert.equal(direct.length, 1, `${name} leaf validator for ${constructorName}`);
			assert.deepEqual(viaReferences(direct[0].block), [], `${name} leaf validator converts no graph`);
			return { label: direct[0].entry.label, via: null };
		}
		const records = blocks.flatMap(({ entry, block }) => viaReferences(block)
			.filter(via => viaSteps(via).at(-1)?.constructor === constructorName).map(via => ({ entry, via })));
		assert.equal(records.length, 1, `${name} record validator for ${constructorName}`);
		return { label: records[0].entry.label, via: records[0].via };
	};
	const construct = (steps, node) => steps.flatMap(step => step.recurse
		? node.tail ? construct(steps, node.tail) : [] : [constructor(step.constructor)]);
	// The transport walks the conversion order, checking each refined position before the Lean adapter.
	const visits = (name, steps, node) => steps.flatMap(step => {
		if(step.recurse) return node.tail ? visits(name, steps, node.tail) : [];
		const validator = graphValidator(name, step.constructor);
		return [[{ kind: "validator", label: validator.label }
			, ...validator.via ? construct(viaSteps(validator.via), node) : [constructor(step.constructor)]]];
	});
	const graphCall = (name, roots) => {
		assert.ok(graphCarried, `${family} requires a graph-carried selection`);
		assert.ok(Array.isArray(roots));
		const steps = roots.length ? conversion(name) : [];
		return {
			checks: roots.flatMap(root => visits(name, steps, root))
			, converted: roots.flatMap(root => construct(steps, root))
		};
	};
	const graphAccepted = (control, name, roots = [], sourceNames = [name]) => {
		const { checks, converted } = graphCall(name, roots);
		return item(control, "accepted", name, [
			...checks.flat(), adapter(name), ...converted, ...sourceNames.map(source)
		]);
	};
	const graphRefused = (control, name, roots, refusingVisit) => {
		const { checks } = graphCall(name, roots);
		assert.ok(Number.isSafeInteger(refusingVisit) && refusingVisit >= 0 && refusingVisit < checks.length
			, `${control} refuses at a planned visit`);
		return item(control, "refused", name, checks.slice(0, refusingVisit + 1).flat());
	};
	const node = (tail = null) => ({ tail });
	// A flat provider checks every refined field at its own position, in field order.
	const positions = (name, prefix, constructorNames) => {
		assert.ok(!graphCarried, `${family} positions belong to a flat selection`);
		const pattern = new RegExp(`^${escaped(`${namespace}.${name}:refinement_${prefix}_`)}(\\d+)$`, "u");
		const validators = selected.filter(entry => entry.kind === "validator" && pattern.test(entry.label))
			.map(entry => ({ entry, index: Number(pattern.exec(entry.label)[1]) }))
			.sort((left, right) => left.index - right.index);
		assert.deepEqual(validators.map(item => item.index), constructorNames.map((_, index) => index)
			, `${name} position ${prefix} validates every authored field once`);
		return validators.map(({ entry }, index) => {
			const block = exportBlock(entry.symbol);
			const checked = selected.filter(item => item.kind === "constructor" && new RegExp(
				`_root_\\.${escaped(item.label)}(?![A-Za-z0-9_])`, "u").test(block));
			assert.deepEqual(checked.map(item => item.label), [`${namespace}.${constructorNames[index]}`]
				, `${entry.label} checks only its authored field constructor`);
			return [{ kind: "validator", label: entry.label }, constructor(constructorNames[index])];
		});
	};
	const positionalAccepted = (control, name, groups = []) => {
		const checks = groups.flatMap(([prefix, names]) => positions(name, prefix, names));
		return item(control, "accepted", name, [
			...checks.flat(), adapter(name)
			, ...checks.map(([, built]) => built), source(name)
		]);
	};
	const positionalRefused = (control, name, groups, refusingConstructor) => {
		const checks = groups.flatMap(([prefix, names]) => positions(name, prefix, names));
		const refusing = checks.findIndex(([, built]) => built.label === `${namespace}.${refusingConstructor}`);
		assert.ok(refusing >= 0, `${control} refuses at a planned position`);
		return item(control, "refused", name, checks.slice(0, refusing + 1).flat());
	};
	let cases;
	if(family === "nominal-full")
	{
		const a = nominalPrimitiveSubtypeFields.map(item => item.constructor + "A");
		const b = nominalPrimitiveSubtypeFields.map(item => item.constructor + "B");
		// Position prefixes name the parameter and active branch path of each authored record.
		cases = [
			positionalAccepted("direct", "echoA", [["0", a]])
			, positionalRefused("first-refusal", "echoA", [["0", a]], "isizeA")
			, positionalAccepted("recovery", "echoA", [["0", a]])
			, positionalAccepted("repeated-fields", "combine", [["0", a], ["1", b]])
			, positionalAccepted("inactive-branch", "echoEventA")
			, positionalAccepted("active-branch", "echoEventA", [["0_1_0", a]])
			, accepted("constructor-free", "produce")
		];
	}
	else if(family === "nominal-result-only") cases = [
		accepted("present-result", "produce")
		, accepted("absent-result", "produce")
		, accepted("repeated-result", "producePair", [], [
			"producePair", "produceGroup", "produce"
		])
		, accepted("constructor-free", "wordBits")
	];
	// Recursive callers author only value shapes: one root per present argument value.
	else if(family === "recursive-subtype") cases = [
		graphAccepted("direct", "first", [node(node())])
		, graphRefused("first-refusal", "first", [node(node())], 1)
		, graphAccepted("recovery", "first", [node()])
		, graphAccepted("repeated-fields", "groups", [node(), node()])
		, graphAccepted("inactive-branch", "echo", [])
		, graphAccepted("active-branch", "echo", [node()])
		, graphAccepted("constructor-free", "produce")
	];
	else if(family === "recursive-checked-record") cases = [
		graphAccepted("direct", "first", [node()])
		, graphRefused("first-refusal", "first", [node(node())], 1)
		, graphRefused("record-refusal", "first", [node()], 1)
		, graphAccepted("recovery", "first", [node()])
		, graphAccepted("repeated-fields", "groups", [node(), node()])
		, graphAccepted("inactive-branch", "groups", [])
		, graphAccepted("constructor-free", "produce")
	];
	else if(family === "dependent-full") cases = [
		accepted("direct", "dependentTotal", ["mkDependent"])
		, refused("first-refusal", "dependentTotal", ["mkDependent"], ["mkDependent"])
		, accepted("recovery", "dependentTotal", ["mkDependent"])
		, accepted("roundtrip", "dependentRoundtrip", ["mkDependent"])
		, accepted("constructor-free", "dependentResult")
	];
	else if(family === "dependent-result-only") cases = [
		accepted("constructor-free", "dependentResult")
		, accepted("repeated-result", "dependentResult")
	];
	else if(family === "value-index-full") cases = [
		accepted("direct-bool", "trueBoolIndex", ["mkOn"])
		, accepted("direct-string", "abStringIndex", ["mkAb"])
		, accepted("direct-nat", "emptySizedIndex", ["mkEmptySized"])
		, refused("bool-refusal", "trueBoolIndex", ["mkOn"])
		, accepted("bool-recovery", "zeroNatIndex", ["mkZeroToken"])
		, refused("string-refusal", "abStringIndex", ["mkAb"])
		, accepted("string-recovery", "zeroNatIndex", ["mkZeroToken"])
		, refused("nat-refusal", "emptySizedIndex", ["mkEmptySized"])
		, accepted("nat-recovery", "zeroNatIndex", ["mkZeroToken"])
		, accepted("wide-index", "wideNatIndex", ["mkWideToken"])
		, accepted("constructor-free", "produceWideNat")
	];
	else if(family === "value-index-result-only") cases = [
		accepted("bool-true-result", "produceTrueBool")
		, accepted("bool-false-result", "produceFalseBool")
		, accepted("string-result", "produceAb")
		, accepted("empty-string-result", "produceEmptyString")
		, accepted("unicode-string-result", "produceUnicodeString")
		, accepted("empty-nat-result", "produceEmptySized")
		, accepted("zero-nat-result", "produceZeroNat")
		, accepted("constructor-free", "produceWideNat")
	];
	else if(family === "zero-payload-full") cases = [
		accepted("direct", "witnessCount", ["mkWitness"])
		, refused("first-refusal", "absentCount", ["mkAbsent"], ["mkAbsent"])
		, accepted("recovery", "witnessCount", ["mkWitness"])
		, accepted("unit-payload", "tokenTag", ["mkToken"])
		, accepted("inactive-branch", "markCount")
		, accepted("active-branch", "markCount", ["mkWitness"])
		, accepted("constructor-free", "produceWitness")
		, accepted("array-result", "witnesses")
		, accepted("absent-result", "maybeWitness")
		, accepted("variant-result", "produceMark")
	];
	else
	{
		assert.equal(family, "zero-payload-result-only");
		cases = [
			accepted("constructor-free", "produceWitness")
			, accepted("unit-result", "produceToken")
			, accepted("array-result", "witnesses")
			, accepted("present-result", "maybeWitness")
			, accepted("plain-empty-result", "produceMarker")
			, accepted("variant-result", "produceMark")
		];
	}
	assert.ok(cases.some(item => item.call.counts.adapter > 0));
	const { globals, reduced } = close(cases);
	assert.equal(new Set(cases.map(item => item.control)).size, cases.length);
	return { scope: "separate-instrumented-probe", family
		, selected: structuredClone(selected), cases
		, ...globals.length ? { globals } : {}, ...reduced.length ? { reducedArity: reduced } : {} };
};
