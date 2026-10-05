"""Strictly typed callers distinguish callback results from closure arguments."""
from typing import TypeAlias

import lean_structured as api

Rows: TypeAlias = tuple[api.Option[str], ...]
Events: TypeAlias = tuple[api.Result[tuple[int, str], str], ...]
Choice: TypeAlias = api.Option[api.Option[None]]
Outcome: TypeAlias = api.Result[api.Option[int], tuple[str, ...]]
TupleValue: TypeAlias = tuple[str, tuple[bytes, int]]


def rows_callback(value: Rows) -> list[api.Option[str]]:
    return [*value, api.Some("owned\0🌿")]


def list_callback(value: Events) -> list[api.Result[tuple[int, str], str]]:
    return [*value, api.Err("domain error")]


def option_callback(value: Choice) -> Choice:
    return api.Some(api.Some(None)) if value is None else value


def result_callback(value: Outcome) -> api.Result[api.Option[int], list[str]]:
    if isinstance(value, api.Err):
        return api.Err([*value.value, "replaced"])
    return value


def tuple_callback(value: TupleValue) -> TupleValue:
    return (value[0] + "changed", (value[1][0], value[1][1] + 1))


def record_callback(value: api.Payload) -> api.Payload:
    return api.Payload(value.text, [*value.rows, api.Some("new")], value.count + 1, value.nested)


def variant_callback(value: api.Packet) -> api.Packet:
    if isinstance(value, api.PacketPayload):
        return api.PacketPayload(value.label, [*value.rows, api.Some("new")])
    return value


def alias_callback(value: api.Alias) -> api.Alias:
    return record_callback(value)


rows: Rows = api.call_array([None], rows_callback)
assert rows == (None, api.Some("owned\0🌿"))
events: Events = api.call_list([api.Ok((7, "seven"))], list_callback)
assert events == (api.Ok((7, "seven")), api.Err("domain error"))
choice: Choice = api.call_option(None, option_callback)
assert choice == api.Some(api.Some(None))
outcome: Outcome = api.call_result(api.Err(["first"]), result_callback)
assert outcome == api.Err(("first", "replaced"))
product: TupleValue = api.call_tuple(("a", (b"\0\xff", 2**128)), tuple_callback)
assert product == ("achanged", (b"\0\xff", 2**128 + 1))
record: api.Payload = api.call_record(api.Payload("a", [], 0, None), record_callback)
assert record == api.Payload("a", (api.Some("new"),), 1, None)
variant: api.Packet = api.call_variant(api.PacketPayload("a", []), variant_callback)
assert variant == api.PacketPayload("a", (api.Some("new"),))
alias: api.Alias = api.call_alias(api.Payload("a", [], 0, None), alias_callback)
assert alias == record

with api.make_array(rows) as array_closure:
    array_result: Rows = array_closure(False, [api.Some("list argument")])
    assert array_result == (api.Some("list argument"),)
with api.make_list(events) as list_closure:
    list_result: Events = list_closure(False, [api.Err("replacement")])
    assert list_result == (api.Err("replacement"),)
with api.make_option(choice) as option_closure:
    option_result: Choice = option_closure(True, None)
    assert option_result == choice
with api.make_result(outcome) as result_closure:
    result_value: Outcome = result_closure(False, api.Err(["replacement"]))
    assert result_value == api.Err(("replacement",))
with api.make_tuple(product) as tuple_closure:
    tuple_result: TupleValue = tuple_closure(True, ("", (b"", 0)))
    assert tuple_result == product
with api.make_record(record) as record_closure:
    record_result: api.Payload = record_closure(True, record)
    assert record_result == record
with api.make_variant(variant) as variant_closure:
    variant_result: api.Packet = variant_closure(True, api.PacketEmpty())
    assert variant_result == variant
with api.make_alias(alias) as alias_closure:
    alias_result: api.Alias = alias_closure(True, alias)
    assert alias_result == alias
