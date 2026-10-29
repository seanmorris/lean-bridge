"""Independent caller of the installed optional-parameter wheel."""
from lean_defaults import Some, character, maybe, natural, present, text, unit_value, word

checks = 0


def check(condition):
    global checks
    assert condition
    checks += 1


check(word() == 7)
check(word(7) == 7)
check(word(11) == 11)

large = 184467440737095516160
check(natural() == large)
check(natural(large) == large)
check(natural(11) == 11)

check(text() == "Lean\nBridge")
check(text("Lean\nBridge") == "Lean\nBridge")
check(text("other") == "other")

check(character() == "λ")
check(character("λ") == "λ")
check(character("猫") == "猫")

check(maybe() is None)
check(maybe(None) is None)
check(maybe(Some(11)) == Some(11))

check(present() == Some(9))
check(present(Some(9)) == Some(9))
check(present(None) is None)
check(present(Some(11)) == Some(11))

check(unit_value() is None)
check(unit_value(None) is None)

for invalid in (lambda: word(None), lambda: natural(None)):
    try:
        invalid()
    except TypeError:
        check(True)
    else:
        raise AssertionError("explicit host null was accepted")

print(f"optional-parameter-python:{checks}")
