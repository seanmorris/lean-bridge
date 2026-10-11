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
		, "NominalConversion.echo": contract([first], second)
		, "NominalConversion.produce": contract([null], first)
		, "NominalConversion.produceEvent": contract([null], selectedEvent("plusOne", "plusTwo"))
		, "NominalSelection.aliases": contract([selectedGroup("plusOne"), selectedGroup("plusTwo")])
		, "NominalSelection.inspectAliasPair": contract([selectedRecord("NominalSelection.AliasPair",
			selectedField("left", selectedGroup("plusOne")), selectedField("right", selectedGroup("plusTwo")))])
		, "NominalSelection.plainFin": contract([null])
	};
};
