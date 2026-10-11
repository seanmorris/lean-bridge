/**
 * Independently specified entry order for the complete original PHP Subtype caller.
 * Every expected source entry names an actual function, except zeroEven's erased constant.
 *
 * @file
 */

/**
 * Expected entries for one checked call, including early and late rejection.
 *
 * @param name - Public export name.
 * @param parameters - Checked parameter positions and selected constructor names.
 * @param source - Actual Lean source declaration, or null for a constant result.
 * @param accepted - Whether validation permits adapter entry.
 * @param validated - Number of constructors reached before rejection.
 */
export const subtypeEntryCall = (name, parameters = [], source = name, accepted = true, validated = parameters.length) => {
	const entries = [];
	const entry = (kind, label) => entries.push({ kind, label: "Subtypes." + label });
	for(const [index, constructor] of parameters.slice(0, validated))
	{ entry("validator", name + ":" + index); entry("constructor", constructor); }
	if(accepted)
	{
		entry("adapter", name);
		for(const [, constructor] of parameters) entry("constructor", constructor);
		if(source !== null) entry("source", source);
	}
	return { publicName: name, entries, counts: Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [kind, entries.filter(item => item.kind === kind).length])) };
};

/** Complete caller order, including all 1,000 invalid/valid recovery pairs and eight supplements. */
export const subtypeEntryCorpusCalls = () => {
	const calls = [], row = (...args) => calls.push(subtypeEntryCall(...args));
	const word = [[0, "checkedWord"]], even = [[0, "checkedEven"]], small = [[1, "checkedSmall"]];
	const payload = [[0, "checkedPayload"]], words = [[0, "checkedWord"], [1, "checkedWord"]];
	const bounded = [[0, "checkedBounded"]], byte = [[0, "checkedByte"]], normalized = [[0, "normalizedEven"]];
	row("shout", word); row("shout", word); row("shout", word, "shout", false);
	row("half", even); row("half", even); row("half", even, "half", false);
	row("scale", small); row("scale", small); row("scale", small, "scale", false); row("scale", small, "scale", false);
	row("head", payload); row("head", payload, "head", false);
	row("pad"); row("join", words); row("join", words, "join", false); row("join", words, "join", false, 1);
	row("clamp", bounded); row("clamp", bounded);
	row("mix", even); row("mix", even, "mix", false, 0); row("mix", even, "mix", false, 0); row("mix", even, "mix", false);
	for(let i = 0; i < 1000; i++)
	{ row("half", even, "half", false); row("half", even); }
	row("byte", byte); row("byte", byte, "byte", false);
	row("firstEven", even, "echo"); row("firstEven", even, "echo", false);
	row("secondEven", normalized, "echo"); row("secondEven", normalized, "echo");
	row("zeroEven", [], null); row("join", words, "join", false);
	return calls;
};
