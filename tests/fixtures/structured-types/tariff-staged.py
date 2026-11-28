"""Installed API only: a synchronous Python callback returns a Lean function."""
from lean_tariff_quotes import flat_quote, make_tariff, new_ticket, staged_quote, with_recovery


def check_cases(checkpoint):
    flat_calls = []

    def flat(base, units):
        flat_calls.append((base, units))
        return base * 10 + units

    assert flat_quote(flat, 10, 3) == 103 and flat_calls == [(10, 3)]
    checkpoint("flat scalar reply")

    with make_tariff(700).quote as fallback:
        calls = []

        def make(base):
            calls.append(base)
            return make_tariff(base + 80).quote

        assert staged_quote(with_recovery(make, fallback), 10, 3) == 93
        assert calls == [10]
        assert staged_quote(with_recovery(lambda base: fallback, fallback), 10, 3) == 703
        assert fallback(9) == 709
    checkpoint("returned and independently owned functions")

    with make_tariff(700).quote as fallback:
        def fail_if_called(*_):
            raise AssertionError("must reject invalid recovery before callback entry")

        for invalid in (fail_if_called, with_recovery(fail_if_called, lambda n: n)):
            try:
                staged_quote(invalid, 10, 3)
            except TypeError:
                pass
            else:
                raise AssertionError("accepted missing or non-Lean recovery function")
        assert fallback(9) == 709
    checkpoint("recovery checked before invocation")

    with make_tariff(700).quote as fallback:
        error = ValueError("price unavailable")

        def fail(base):
            assert base == 10
            raise error

        try:
            staged_quote(with_recovery(fail, fallback), 10, 3)
        except ValueError as observed:
            assert observed is error
        else:
            raise AssertionError("exposed recovery as a successful price")
        assert fallback(9) == 709
    checkpoint("original callback exception")

    with new_ticket(1) as wrong, make_tariff(700).quote as fallback:
        for invalid in (lambda n: n, wrong):
            calls = []

            def invalid_reply(base):
                calls.append(base)
                return invalid

            try:
                staged_quote(with_recovery(invalid_reply, fallback), 10, 3)
            except TypeError:
                pass
            else:
                raise AssertionError("accepted a Python lambda or another resource as a Lean function")
            assert calls == [10]
        assert staged_quote(with_recovery(lambda base: fallback, fallback), 10, 3) == 703
    checkpoint("invalid replies and later success")
