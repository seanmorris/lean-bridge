import lean_owned_aggregates as api

with api.new_ticket(42, "receiver") as owner:
    view = owner.retain_ticket()
    independent = view.retain()
    print(view.serial)

assert view.is_closed
with independent:
    print(independent.serial)
