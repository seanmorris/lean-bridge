"""Only the harness sees the native broker. This client uses the installed wheel's public API."""
from lean_tariff_quotes import (LeanBridgeError, make_tariff, pass_application_quote,
                               staged_quote, visit_application_quote, with_recovery)


def check(checkpoint):
    def rejected(callback, status):
        try:
            callback(900)
        except LeanBridgeError as error:
            assert error.status == status, (error.status, status)
        else:
            raise AssertionError("a stale registration entered application code")

    calls = []

    def price(n):
        calls.append(n)
        return 40 + n

    with pass_application_quote(price) as stale:
        rejected(stale, 10)
    assert not calls
    checkpoint()

    saved = []

    def visit(q, n):
        saved.extend((q, q.retain()))
        assert q(0) == 40
        with pass_application_quote(q) as forwarded:
            return forwarded(n)

    assert visit_application_quote(price, visit, 2) == 42 and calls == [0, 2]
    rejected(saved[0], 4)
    rejected(saved[1], 10)
    saved[1].close()
    checkpoint()

    def reply(q, n):
        with make_tariff(800).quote as fallback, pass_application_quote(q) as forwarded:
            return staged_quote(with_recovery(lambda _: forwarded, fallback), 99, n)

    assert visit_application_quote(price, reply, 3) == 43 and calls == [0, 2, 3]
    checkpoint()

    def nested(outer, n):
        held = []

        def inside(inner, m):
            held.append(inner.retain())
            return outer(n) + inner(m)

        assert visit_application_quote(lambda m: 100 + m, inside, 1) == 145
        rejected(held[0], 10)
        held[0].close()
        return outer(n + 1)

    assert visit_application_quote(price, nested, 4) == 45 and calls == [0, 2, 3, 4, 5]
    checkpoint()

    original = RuntimeError("pricing callback failed")

    def broken(_):
        raise original

    try:
        visit_application_quote(broken, reply, 1)
    except RuntimeError as error:
        assert error is original
    else:
        raise AssertionError("recovery replaced the original failure")
    checkpoint()

    with make_tariff(900).quote as genuine, pass_application_quote(genuine) as kept:
        genuine.close()
        assert kept(6) == 906
    assert visit_application_quote(price, lambda q, n: q(n), 7) == 47
    assert calls == [0, 2, 3, 4, 5, 7]
    checkpoint()
