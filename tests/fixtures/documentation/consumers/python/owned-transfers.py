import copy
from lean_owned_aggregates import new_ticket, retain_ticket, serial

original = new_ticket(42, "shipment")
alias = copy.copy(original)
independent = original.retain()

with retain_ticket(original) as received:
    assert original.is_closed and alias.is_closed
    assert serial(received) == 42
    assert serial(independent) == 42

independent.close()
print("transferred")
