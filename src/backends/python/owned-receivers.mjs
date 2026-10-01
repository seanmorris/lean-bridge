/**
 * Dispatch checked Python receiver members by their nominal value type.
 *
 * @file
 */

/**
 * Keep property access and bound methods tied to the original whole owner.
 *
 * @param values - Generated public Python types and functions.
 */
export const ownedPythonReceiverMembers = values => {
	const nodes = new Map(values.types.map(node => [node.id, node]));
	const groups = new Map(), lines = [], descriptors = [];
	for(const [index, fn] of values.functions.entries())
	{
		if(fn.receiver !== 0) continue;
		const node = nodes.get(fn.parameters[0]);
		const whole = fn.anchor === 0 || fn.transfers?.includes(0);
		const args = fn.parameters.slice(1).map((_, i) => `arg${i + 1}`);
		lines.push(`def _receiver${index}(self${args.length ? ", " + args.join(", ") : ""}):`
			, "    try:"
			, `        return _call${index}(${[whole ? "self" : "self.get()", ...args].join(", ")})`
			, "    finally:", "        self = None", "");
		descriptors.push(`_R.Value.${fn.publicName} = _OwnedReceiver${fn.receiverKind === "property" ? "Property" : "Method"}(${JSON.stringify(fn.publicName)}, _receiver${index})`);
		const names = node.kind === "variant" ? node.cases.map(branch => branch.publicName) : [node.publicType];
		for(const name of names)
		{
			const members = groups.get(name) ?? [];
			members.push(`        ${JSON.stringify(fn.publicName)}: (_receiver${index}, ${fn.receiverKind === "property" ? "True" : "False"}),`);
			groups.set(name, members);
		}
	}
	return [...lines, "_receiver_members = {"
		, ...[...groups].flatMap(([name, members]) => [`    _V.${name}: {`, ...members, "    },"])
		, "}", "", "def _receiver_member(owner, name):"
		, "    value = member = None", "    try:"
		, "        value = owner.get()"
		, "        member = _receiver_members.get(type(value), {}).get(name)"
		, "        if member is None: raise AttributeError(name)"
		, "        function, is_property = member"
		, "        return function(owner) if is_property else function.__get__(owner)"
		, "    finally:", "        owner = value = member = None", ""
		, "class _OwnedReceiverMethod:"
		, "    def __init__(self, name, function):"
		, "        self.name = name", "        self.function = function"
		, "    def __get__(self, owner, owner_type=None):"
		, "        return self.function if owner is None else _receiver_member(owner, self.name)"
		, "", "class _OwnedReceiverProperty(property):"
		, "    def __init__(self, name, function):"
		, "        super().__init__(function)", "        self.name = name"
		, "    def __get__(self, owner, owner_type=None):"
		, "        return self if owner is None else _receiver_member(owner, self.name)"
		, "", ...descriptors, ""].join("\n");
};
