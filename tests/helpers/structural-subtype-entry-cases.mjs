/**
 * Independent entry expectations for every original structural C caller operation.
 * The sequence follows caller inputs, not generated compiler refinement trees.
 *
 * @file
 */

/**
 * Expected constructors, validators and dispatch for one public call.
 *
 * @param name - Public export name.
 * @param leaves - Runtime checked leaves in caller traversal order.
 * @param accepted - Whether the public validator permits adapter/source entry.
 * @param reached - Number of leaves reached, including a rejecting leaf.
 */
export const structuralSubtypeEntryCall = (name, leaves = [], accepted = true, reached = leaves.length) => {
	const entries = [], enter = (kind, label) => entries.push({ kind, label: `StructuralSubtypes.${label}` });
	for(const [suffix, constructor] of leaves.slice(0, reached))
	{ enter("validator", `${name}:${suffix}`); enter("constructor", constructor); }
	if(accepted)
	{
		enter("adapter", name);
		for(const [, constructor] of leaves) enter("constructor", constructor);
		enter("source", name === "specialized" ? "generic" : name);
	}
	return { publicName: name, entries, counts: Object.fromEntries(["validator", "constructor", "adapter", "source"].map(kind => [kind, entries.filter(entry => entry.kind === kind).length])) };
};

/** All original C calls, including first/middle/last failures and 1,000 recovery pairs. */
export const structuralSubtypeEntryCorpus = () => {
	const calls = [], row = (...args) => calls.push(structuralSubtypeEntryCall(...args));
	const positive = (suffix, count = 1) => Array.from({ length: count }, () => [suffix, "checkedPositive"]);
	const normalized = (suffix, count) => Array.from({ length: count }, () => [suffix, "normalizePositive"]);
	row("scalar", positive("0")); row("scalar", positive("0"), false);
	row("arrays"); row("lists");
	for(const name of ["arrays", "lists", "specialized"]) row(name, positive("0_0", 3));
	for(let index = 0; index < 3; index++) for(const name of ["arrays", "lists", "specialized"]) row(name, positive("0_0", 3), false, index + 1);
	row("options"); row("options", positive("0_0")); row("options", positive("0_0"), false);
	const product = [...positive("0_0"), ["0_1", "checkedWord"]];
	row("product", product); row("product", product, false); row("product", product, false, 1);
	row("branch", positive("0_0")); row("branch", positive("0_0"), false);
	row("branch", [["0_1", "checkedWord"]]); row("branch", [["0_1", "checkedWord"]], false);
	const bytes = [["0_0_0_0", "checkedByte"], ...positive("0_0_0_1")];
	row("byteBranches", bytes); row("byteBranches", bytes, false, 1); row("byteBranches", bytes, false);
	const nested = positive("0_0_0_0_0");
	row("nested", nested); row("nested", nested, false, 0); row("nested", nested, false); row("nested", nested);
	row("aliasPair", [...positive("0_0_0_0", 2), ...normalized("0_1_0_0", 3)]);
	const arguments_ = [...positive("0_0_0", 2), ...normalized("1_0_0", 3)];
	row("aliasArguments", arguments_); row("plainFin"); row("plainFin", [], false);
	for(let round = 0; round < 1000; round++)
	{ row("aliasArguments", arguments_, false, 3 + round % 3); row("aliasArguments", arguments_); }
	return calls;
};
