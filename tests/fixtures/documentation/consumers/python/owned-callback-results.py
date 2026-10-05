import lean_owned_aggregates as api

ticket = api.new_ticket(42, "ready")
bundle = api.Bundle(ticket.get(), None, (), (), api.Payload(0, b""))
owner = api.copy_value(bundle)
callback = api.make_record(bundle)

# The callback result borrows its second argument, not its captured bundle.
view = callback(False, owner)
print(api.serial(view.get().primary))
independent = view.retain()

owner.close()
assert view.is_closed
print(api.serial(independent.get().primary))

view.close()
independent.close()
callback.close()
ticket.close()
