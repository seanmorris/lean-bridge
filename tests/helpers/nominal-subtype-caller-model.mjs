/**
 * Explicit JavaScript double for testing the consumer oracle and generated API.
 * This is not Lean execution or installed-package acceptance.
 *
 * @file
 */
const refused = () => { throw new Error("Component recursive call failed (5)"); };
const first = value => value < 100n ? value + 1n : refused();
const second = value => value < 90n ? value + 2n : refused();
const box = (value, make) => ({ payload: make(value.payload), digit: value.digit });
const optional = (value, make) => value.tag === "none" ? { tag: "none" } : { tag: "some", value: make(value.value) };
const group = (values, make) => values.map(value => optional(value, item => box(item, make)));
const event = (value, one, two) => value.kind === "empty" ? { kind: "empty" }
	: value.kind === "box" ? { kind: "box", value: box(value.value, one) }
		: { kind: "choices", values: value.values.map(item => optional(item, branch => Object.hasOwn(branch, "ok") ? { ok: one(branch.ok) } : { error: two(branch.error) })) };
const eventSum = value => value.kind === "empty" ? 0n : value.kind === "box" ? value.value.payload
	: value.values.reduce((sum, item) => sum + (item.tag === "none" ? 0n : item.value.ok ?? item.value.error), 0n);
const groupSum = values => values.reduce((sum, item) => sum + (item.tag === "none" ? 0n : item.value.payload), 0n);
const envelope = value => ({ payload: value + 1n, digit: 2n });
const producedGroup = value => [{ tag: "none" }, { tag: "some", value: envelope(value) }];

/**
 * Independent source/constructor behavior used only in oracle mutation tests.
 *
 * @param options - Optional model surface.
 * @param options.genericCompositions - Include generic record specializations.
 */
export const nominalSubtypeCallerModel = ({ genericCompositions = false } = {}) => ({
	first: value => first(value.payload)
	, second: value => second(value.payload)
	, combine: (left, right) => first(left.payload) * 100n + second(right.payload)
	, nested: value => first(value.left.payload) * 100n + second(value.right.payload)
	, eventFirst: value => eventSum(event(value, first, second))
	, eventSecond: value => eventSum(event(value, second, first))
	, echo: value => box(value, first)
	, aliases: (left, right) => groupSum(group(left, first)) + groupSum(group(right, second))
	, inspectAliasPair: value => groupSum(group(value.left, first)) + groupSum(group(value.right, second))
	, echoGroups: value => group(value, first)
	, echoPair: value => ({ left: group(value.left, first), right: group(value.right, second) })
	, echoEvent: value => event(value, first, second)
	, plainFin: value => value
	, scalar: value => value + 1n
	, produceEnvelope: envelope
	, arrayValues: value => [value + 1n, value + 2n]
	, listValues: value => [value + 1n, value + 2n]
	, optional: value => value === 0n ? { tag: "none" } : { tag: "some", value: value + 1n }
	, product: value => [value + 1n, value + 2n]
	, branch: value => value === 0n ? { error: 1n } : { ok: value + 1n }
	, groupValues: producedGroup
	, pairValues: value => ({ left: producedGroup(value), right: producedGroup(value + 1n) })
	, eventValue: value => ({ kind: "box", value: envelope(value) })
	, eventEmpty: () => ({ kind: "empty" })
	, eventChoices: value => ({ kind: "choices", values: [{ tag: "none" }, { tag: "some", value: { ok: value + 1n } }, { tag: "some", value: { error: value + 2n } }] })
	, noItems: () => []
	, ...genericCompositions ? {
		genericUse: value => first(value.value) + value.marker
		, echoGenericFirst: value => ({ value: first(value.value), marker: value.marker })
		, echoGenericSecond: value => ({ value: second(value.value), marker: value.marker })
	} : {}
});
