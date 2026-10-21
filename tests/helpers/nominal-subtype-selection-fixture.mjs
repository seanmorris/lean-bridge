/**
 * Per-use constructor choices for the nominal source-compiler fixture.
 * Choices name constructors; fresh Lean remains responsible for types and bounds.
 *
 * @file
 */
/**
 * Select a fixture constructor.
 *
 * @param name - Constructor in the compiled fixture module.
 */
export const selectedConstructor = name => ({ constructor: `NominalConversion.${name}` });
/**
 * Name a field's constructor choice.
 *
 * @param name - Exact source field name.
 * @param refinement - Constructor choice or null.
 */
export const selectedField = (name, refinement) => ({ name, refinement });
/**
 * Select all fields of a nominal record.
 *
 * @param name - Qualified source record name.
 * @param fields - Every field in source order.
 */
export const selectedRecord = (name, ...fields) => ({ kind: "record", name, fields });
/**
 * Keep a variant case, including an empty case.
 *
 * @param name - Source case name.
 * @param fields - Every case field in source order.
 */
export const selectedCase = (name, ...fields) => ({ name, fields });
/**
 * Select every case of a nominal variant.
 *
 * @param name - Qualified source variant name.
 * @param cases - Every case in source order.
 */
export const selectedVariant = (name, ...cases) => ({ kind: "variant", name, cases });
/**
 * Nest choices under a structural transport constructor.
 *
 * @param kind - Structural transport constructor.
 * @param arguments_ - Choices in transport order.
 */
export const selectedTree = (kind, ...arguments_) => ({ kind, arguments: arguments_ });
/**
 * Keep the envelope's Fin-only sibling unselected.
 *
 * @param name - The envelope payload's checked constructor.
 */
export const selectedEnvelope = name => selectedRecord("NominalConversion.Envelope",
	selectedField("payload", selectedConstructor(name)), selectedField("digit", null));
/**
 * Give the box and two result branches independent choices.
 *
 * @param first - Constructor for the box and successful result branch.
 * @param second - Constructor for the error branch.
 */
export const selectedEvent = (first, second) => selectedVariant("NominalConversion.Event",
	selectedCase("empty")
	, selectedCase("box", selectedField("value", selectedEnvelope(first)))
	, selectedCase("choices", selectedField("values", selectedTree("array", selectedTree("option",
		selectedTree("result", selectedConstructor(first), selectedConstructor(second)))))));
/**
 * Select envelopes inside the fixture's group alias.
 *
 * @param name - Checked constructor under two structural edges.
 */
export const selectedGroup = name => selectedTree("array", selectedTree("option", selectedEnvelope(name)));
/**
 * Select the fixed refined field of an alias-named generic record.
 *
 * @param name - Checked constructor for the fixed field.
 */
export const selectedGenericNat = name => selectedRecord("NominalSelection.GenericNat",
	selectedField("value", selectedConstructor(name)), selectedField("marker", null));
/**
 * Select one top-level generic checked record and its nested Subtype field.
 *
 * @param name - Closed alias naming the generic checked record.
 * @param constructor - Checked constructor for the complete record.
 * @param subtype - Checked constructor for its Positive payload.
 */
export const selectedIndexedCarrier = (name, constructor, subtype) => ({
	kind: "checked-record", name: `NominalSelection.${name}`
	, constructor: `NominalSelection.${constructor}`
	, fields: [
		selectedField("value", selectedConstructor(subtype))
		, selectedField("marker", null)
		, selectedField("flagCount", null)
		, selectedField("labelSize", null)
		, selectedField("boundValue", null)
	]
});
/**
 * Attach a choice to its copied contract site.
 *
 * @param selection - Optional constructor choice for one copied site.
 */
export const selectedSite = selection => ({ ownership: "copy", lifetime: null, ...(selection ? { refinement: selection } : {}) });

/** Fresh mutable selections, including the same nominal record twice in one parameter. */
export const nominalSelectionContracts = () => {
	const first = selectedEnvelope("plusOne"), second = selectedEnvelope("plusTwo");
	const contract = (parameters, result = null) => ({ parameters: parameters.map(selectedSite), result: selectedSite(result) });
	return {
		"NominalConversion.first": contract([first])
		, "NominalConversion.second": contract([second])
		, "NominalConversion.combine": contract([first, second])
		, "NominalConversion.nested": contract([selectedRecord("NominalConversion.Pair",
			selectedField("left", first), selectedField("right", second))])
		, "NominalConversion.eventFirst": contract([selectedEvent("plusOne", "plusTwo")])
		, "NominalConversion.eventSecond": contract([selectedEvent("plusTwo", "plusOne")])
		// Results are compiler-owned projections. Constructor choices apply only to
		// values entering Lean; a Lean-produced Subtype already carries its proof.
		, "NominalConversion.echo": contract([first])
		, "NominalConversion.produce": contract([null])
		, "NominalConversion.produceEvent": contract([null])
		, "NominalSelection.aliases": contract([selectedGroup("plusOne"), selectedGroup("plusTwo")])
		, "NominalSelection.inspectAliasPair": contract([selectedRecord("NominalSelection.AliasPair",
			selectedField("left", selectedGroup("plusOne")), selectedField("right", selectedGroup("plusTwo")))])
		, "NominalSelection.genericUse": contract([selectedGenericNat("plusOne")])
		, "NominalSelection.echoGenericFirst": contract([selectedGenericNat("plusOne")])
		, "NominalSelection.echoGenericSecond": contract([selectedGenericNat("plusTwo")])
		, "NominalSelection.echoIndexedOnFirst": contract([
			selectedIndexedCarrier("IndexedOnAbZero", "mkIndexedOnAbZero", "plusOne")
		])
		, "NominalSelection.echoIndexedOnSecond": contract([
			selectedIndexedCarrier("IndexedOnAbZero", "mkIndexedOnAbZero", "plusTwo")
		])
		, "NominalSelection.echoIndexedOffWide": contract([
			selectedIndexedCarrier("IndexedOffEmptyWide", "mkIndexedOffEmptyWide", "plusOne")
		])
		, "NominalSelection.echoIndexedUnicode": contract([
			selectedIndexedCarrier("IndexedOffUnicodeZero", "mkIndexedOffUnicodeZero", "plusTwo")
		])
		, "NominalSelection.plainFin": contract([null])
	};
};

/** Public specializations retain independent constructors and synthesized instances. */
export const nominalSelectionSpecializations = () => [
	...["First", "Second"].map(name => ({
		name: `NominalSelection.echoGeneric${name}`
		, declaration: "NominalSelection.genericEcho"
		, types: ["NominalSelection.GenericNat"]
	}))
	, ...[
		["OnFirst", "IndexedOnAbZero"]
		, ["OnSecond", "IndexedOnAbZero"]
		, ["OffWide", "IndexedOffEmptyWide"]
		, ["Unicode", "IndexedOffUnicodeZero"]
	].map(([name, type]) => ({
		name: `NominalSelection.echoIndexed${name}`
		, declaration: "NominalSelection.dependentEcho"
		, types: [`NominalSelection.${type}`]
	}))
];
