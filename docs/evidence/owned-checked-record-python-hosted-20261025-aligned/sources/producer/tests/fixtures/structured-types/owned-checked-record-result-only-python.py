"""Installed-wheel result-only consumer for owned checked records."""
import lean_owned_checked_records as api

checks = 0


def check(value, message):
    global checks
    checks += 1
    if not value:
        raise AssertionError(message)


ticket = api.new_ticket(20, "result-only")
produced = api.claim_for(ticket)
check(isinstance(produced, api.Some), "claim is present")
check(produced.value.quota == 0, "proof is erased")
check(api.serial(produced.value.holder) == 20, "resource is usable")
check(not hasattr(api, "echo_claim"), "input constructor surface is absent")
produced.value.holder.close()
ticket.close()
check(ticket.is_closed, "owner closes")
print(f"owned-checked-record-result-only-python:{checks}")
