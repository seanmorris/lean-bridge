/** @file Call-scoped Ruby input records, distinct from records returned by Lean. */

/**
 * Select a borrowed record or direct callback encoder, if the C call admits it.
 *
 * @param fn - Projected call with per-parameter host capabilities.
 * @param i - Parameter position.
 * @param checking - Emit preflight validation instead of native staging.
 */
export const rubyCallableInput = (fn, i, checking) => {
	const prefix = fn.hostRecordSlots?.some(s => s.index === i) ? "record_input" : fn.hosts[i] ? "host" : null;
	return prefix && `${prefix}${fn.parameters[i].index}(arg${i}, ${checking ? "checked" : "scope, frame"})`;
};

/**
 * Encode the input-only layout. Result records never gain a callable codec.
 *
 * @param node - Nominal record with a selected alternate input layout.
 * @param nodes - Ruby types indexed by their binding identities.
 * @param publicName - Qualify a generated Ruby constant.
 * @param childInput - Encode an unchanged, non-callback member.
 */
export const rubyHostRecordInput = (node, nodes, publicName, childInput) => {
	const view = node.hostInput;
	const body = view.fields.flatMap((field, i) => {
		if(!field.host) return childInput(field, "field" + i, field.offset);
		const child = nodes.get(field.type);
		return [`raise TypeError, "Expected a leased ${child.publicType}" if leased && !exact?(field${i}, ${publicName(child.publicType)})`
			, `descriptor = host${child.index}(field${i}, scope, frame, depth + 1)`
			, `out[${field.offset + 8}, 8] = [descriptor.to_i].pack("Q<") unless scope.check_only`];
	});
	return `      def record_input${node.index}(value, scope, frame = nil, depth = 0)
        leased = exact?(value, ${publicName(node.publicType)})
        raise TypeError, "Expected ${view.publicType} or ${node.publicType}" unless leased || exact?(value, ${publicName(view.publicType)})
        key = IDENTIFY.bind_call(value)
        scope.enter(key, depth, ${view.size})
        begin
${view.fields.map((f, i) => `          field${i} = FIELD.bind_call(value, :@${f.publicName})`).join("\n")}
          out = scope.allocate(${view.size})
${body.map(line => "          " + line).join("\n")}
          out
        ensure
          scope.leave(key)
        end
      end`;
};
