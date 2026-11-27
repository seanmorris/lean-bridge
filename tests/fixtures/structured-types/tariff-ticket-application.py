"""A downstream Python caller; the separate test observer owns the broker counters."""
from lean_tariff_quotes import exchange_ticket, new_ticket, ticket_serial, with_recovery


def check(checkpoint):
    for serial in (42, 71):
        for fail in (False, True, False):
            error = ValueError("ticket rejected by application")
            calls = []
            with new_ticket(serial) as original, new_ticket(800) as fallback, new_ticket(serial + 1) as reply:
                def exchange(borrowed):
                    calls.append(ticket_serial(borrowed))
                    if fail:
                        raise error
                    return reply

                try:
                    result = exchange_ticket(original, with_recovery(exchange, fallback))
                except ValueError as caught:
                    assert fail and caught is error
                else:
                    assert not fail and result == serial + 1
                assert calls == [serial]
                assert ticket_serial(original) == serial and ticket_serial(fallback) == 800
            checkpoint()
