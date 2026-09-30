import lean_owned_aggregates as api

with api.new_ticket(42, "example") as owner:
    view = api.retain_ticket(owner)
    independent = view.retain()
    assert view == owner

assert view.is_closed
with independent:
    print(api.serial(independent.get()))

with api.copy_value([], result_of=api.echo_array) as empty:
    borrowed_empty = api.echo_array(empty)
    assert borrowed_empty.get() == ()
assert borrowed_empty.is_closed
