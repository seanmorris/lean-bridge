/** @file Typed C++ borrowed input records over the scoped C field adapter. */

/**
 * Keep the caller's original callable (including move-only captures) in place.
 * Only the native input view and its trampolines belong to this call frame.
 *
 * @param nodes - C++ types including distinct caller-input and leased-result records.
 * @param calls - Native entry points for explicitly selected, borrowed record parameters.
 * @param invalid - Package-specific invalid-argument status.
 */
export const ownedCppHostRecords = (nodes, calls, invalid) => {
	const seen = new Set(), lines = [];
	for(const call of calls) for(const slot of call.hostRecordSlots)
	{
		const node = nodes.get(slot.node.id), index = node.index, input = node.hostInput;
		if(seen.has(index)) continue;
		seen.add(index);
		const templates = input.fields.map((_, i) => "F" + i);
		const args = templates.map(f => "class " + f).join(", ");
		const view = "OwnedRecordView" + index;
		lines.push(`template<class> inline constexpr bool owned_input${index} = false;`
			, `template<${args}> inline constexpr bool owned_input${index}<${input.name}<${templates.join(", ")}>> = true;`
			, `template<class R> concept OwnedRecord${index} = (std::same_as<std::remove_cvref_t<R>, ${node.hostName}>`
			, `  || owned_input${index}<std::remove_cvref_t<R>>) && requires(R& row) {`);
		for(const f of slot.fields)
			lines.push(`  requires OwnedCallback${nodes.get(f.type).index}<decltype((row.${f.name}))>;`);
		lines.push("};", `template<class R> requires OwnedRecord${index}<R> struct ${view} {`
			, `  ${slot.inputType} value{};`);
		const check = [], build = [];
		for(const [i, f] of node.fields.entries())
		{
			const child = nodes.get(f.type), selected = input.fields.includes(f.name);
			const raw = "row." + f.name, value = !selected && f.boxed ? "*" + raw : raw;
			const ty = selected
				? `OwnedCallbackView${child.index}<std::remove_reference_t<decltype((std::declval<R&>().${f.name}))>>`
				: `OwnedView${child.index}`;
			lines.push(`  std::unique_ptr<${ty}> field${i};`);
			if(!selected && f.boxed) check.push(`    if (!${raw}) throw Error(${invalid});`);
			check.push(selected ? `    owned_check_callback${child.index}(${value}, call);`
				: `    owned_check${child.index}(${value}, 1, call.budget, call.state);`);
			build.push(`    field${i} = std::make_unique<${ty}>(${value}, ${selected ? "call" : "call.state"});`
				, `    value.${f.name} = ${f.pointer ? "&" : ""}field${i}->value;`);
		}
		lines.push(`  static void check(R& row, OwnedCall& call) {`
			, `    call.budget.enter(0); call.budget.native(1, sizeof(${slot.inputType}));`
			, `    call.budget.storage(1, sizeof(${view}));`, ...check, "  }"
			, `  ${view}(R& row, OwnedCall& call) {`, ...build, "  }", "};");
	}
	return lines;
};
