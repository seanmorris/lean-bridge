import lean_glyphs as api

points = [__POINTS__]
values = [chr(point) for point in points]
checks = 0

def check(value):
    global checks
    assert value
    checks += 1

for point, value in zip(points, values):
    check(api.keep(value) == value)
    check(api.point(value) == point)
    check(api.text(value) == value)
    check(api.choose(True, value, "x") == value)
    check(api.choose(False, "x", value) == value)
    check(api.keep_array([value, "\0"]) == (value, "\0"))
    label = api.keep_label(api.Label(marker=value, line=values))
    check(label.marker == value and tuple(label.line) == tuple(values))
    check(api.keep_rows([values, [], [value]]) == (tuple(values), (), (value,)))
check(api.sprout() == "🌱")
check(api.keep_array([]) == ())
for bad in ["", "ab", "e\u0301", "☀️", "🇨🇦", "\ud800", "\udfff", 65, None, True, ["a"]]:
    for call in [lambda: api.keep(bad), lambda: api.keep_array(["a", bad]),
                 lambda: api.keep_rows([["a"], [bad]]),
                 lambda: api.keep_label(api.Label(marker=bad, line=values)),
                 lambda: api.keep_label(api.Label(marker="a", line=[bad]))]:
        try:
            call()
        except (TypeError, ValueError):
            check(True)
        else:
            raise AssertionError("Accepted invalid Char")
        check(api.keep("🌱") == "🌱")
for _ in range(1000):
    check(api.keep_rows([values, values]) == (tuple(values), tuple(values)))
print(f"char-ok:{checks}")
