"""The consumer uses only the public function and explicitly retained closures."""
from lean_tariff_quotes import LeanBridgeError, visit_quote


def expired(q):
    try:
        q(1)
    except LeanBridgeError as error:
        assert error.status == 4
    else:
        raise AssertionError("the original callback borrow escaped")


def check(checkpoint):
    original = RuntimeError("the application rejected the quote")
    for keep in (False, True):
        for fail in (False, True):
            saved = []

            def visit(q, units):
                saved.append(q)
                if keep:
                    saved.append(q.retain())
                    assert q == saved[1]
                assert q(units) == 42
                if fail:
                    raise original
                return q(units)

            try:
                value = visit_quote(40, visit, 2)
            except RuntimeError as error:
                assert fail and error is original
            else:
                assert not fail and value == 42
            assert len(saved) == 1 + keep
            expired(saved[0])
            if keep:
                assert saved[0] != saved[1] and saved[1](5) == 45
                saved[1].close()
                expired(saved[1])
            checkpoint()

    inner = []
    def outer(q, units):
        def nested(other, n):
            inner.append(other)
            assert q != other and other(n) == 93
            raise original
        try:
            visit_quote(90, nested, 3)
        except RuntimeError as error:
            assert error is original
        else:
            raise AssertionError("nested failure lost")
        assert len(inner) == 1
        expired(inner[0])
        return q(units)

    assert visit_quote(30, outer, 4) == 34
    checkpoint()
    visit = lambda q, n: q(n)
    assert visit_quote(1, visit, 5) == 6 and visit_quote(60, visit, 3) == 63
    checkpoint()
