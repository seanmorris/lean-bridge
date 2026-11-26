"""An installed caller sees one identity with two distinct lifetimes."""
from lean_tariff_quotes import LeanBridgeError, exchange_tariff, make_tariff, with_recovery


def check():
    saved = []
    other = make_tariff(900)

    def revise(value):
        borrowed = value.quote
        retained = borrowed.retain()
        assert borrowed == retained and retained == borrowed and borrowed != other.quote
        saved.extend([borrowed, retained])
        return value

    assert exchange_tariff(with_recovery(revise, other), 30, 3) == 33
    borrowed, retained = saved
    try:
        borrowed(5)
    except LeanBridgeError as error:
        assert error.status == 4
    else:
        raise AssertionError("retaining a function kept the original borrow callable")
    assert borrowed != retained and retained(5) == 35
    retained.close()
    other.quote.close()


if __name__ == "__main__":
    check()
