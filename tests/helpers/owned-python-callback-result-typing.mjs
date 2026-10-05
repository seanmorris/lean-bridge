/**
 * Exact positive and negative consumers for Python callback-owner types.
 *
 * @file
 */

/**
 * Distinguish checked argument owners from raw host callback payloads.
 *
 * @param variant - Explicit host-callback and combined-capability selection.
 */
export const ownedPythonCallbackTyping = variant => {
	const positive = `from typing import assert_type
import lean_owned_aggregates as api
def exercise(root: api.Value[api.Bundle], tree: api.Value[api.Tree]) -> None:
    closure = api.make_record(root.get())
    assert_type(closure(False, root), api.Value[api.Bundle])
    assert_type(closure.get()(False, root), api.Value[api.Bundle])
    unary = api.make_record_callback(root.get())
    assert_type(unary(root), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), unary.get()), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), unary), api.Value[api.Bundle])
    assert_type(api.make_recursive(tree.get())(False, tree), api.Value[api.Tree])
    assert_type(closure(False, root).retain(), api.Value[api.Bundle])
${variant.hostCallbacks ? `    def raw(value: api.Bundle) -> api.Bundle:
        return value
    def whole(value: api.Bundle) -> api.Value[api.Bundle]:
        return root
    assert_type(api.callback_record(root.get(), raw), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), whole), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), unary), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), api.with_recovery(raw, root.get())), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), api.with_recovery(whole, root)), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), api.with_recovery(raw, root)), api.Value[api.Bundle])
    assert_type(api.callback_record(root.get(), api.with_recovery(whole, root.get())), api.Value[api.Bundle])
` : ""}${variant.combined ? `    child = root.make_record()(False, root)
    assert_type(child.borrow_record(), api.Value[api.Bundle])
    assert_type(root.move_record(lambda value: value), api.Value[api.Bundle])
` : ""}`;
	const wrong = [
		"api.make_record(root.get())(False, root.get())"
		, "api.make_record(root.get())(False, ticket)"
		, "bad: api.Bundle = api.make_record(root.get())(False, root)"
		, ...variant.hostCallbacks ? [
			"api.callback_record(root.get(), lambda value: ticket)"
			, "api.callback_record(root.get(), needs_owner)"
		] : ["api.callback_record(root.get(), lambda value: value)"]
	];
	const invalid = `import lean_owned_aggregates as api
def needs_owner(value: api.Value[api.Bundle]) -> api.Bundle:
    return value.get()
def invalid(root: api.Value[api.Bundle], ticket: api.Value[api.Ticket]) -> None:
${wrong.map(line => "    " + line).join("\n")}
`;
	return { positive, invalid, wrong };
};
