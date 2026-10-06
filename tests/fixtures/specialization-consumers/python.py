import lean_specialized as api

checks = 0
def check(value):
    global checks
    assert value
    checks += 1

greeting = 'héllo \U0001F642'
# One generic declaration, three concrete exports; the open declaration is absent.
check(api.echo_word(0) == 0 and api.echo_word(2**32 - 1) == 2**32 - 1)
check(api.echo_text(greeting) == greeting and api.echo_text('') == '')
check(api.echo_nat(2**200) == 2**200)
words = [0, 42, 2**32 - 1]
check(api.echo_words(words) == tuple(words))
for name in ['echo', 'choose', 'first', 'duplicate']:
    check(not hasattr(api, name))
# Lean resolved each instance dictionary at build time.
check(api.choose_word(True, 5) == 5 and api.choose_word(False, 5) == 37)
check(api.choose_text(True, greeting) == greeting and api.choose_text(False, greeting) == '')
check(api.choose_words(True, words) == tuple(words) and api.choose_words(False, words) == ())
check(api.double_word(2**31 + 1) == 2)
check(api.double_nat(2**100) == 2**101)
check(api.first_text_word(greeting, 9) == greeting)
check(api.plain(1) == 4)
# Each export keeps its own concrete argument checks.
for call in [lambda: api.echo_word(2**32), lambda: api.echo_word('1'), lambda: api.echo_text(1), lambda: api.echo_nat(-1), lambda: api.first_text_word(9, greeting)]:
    try:
        call()
    except (TypeError, ValueError, OverflowError):
        check(True)
    else:
        raise AssertionError('Invalid argument accepted')
for i in range(1000):
    check(api.choose_word(i % 2 == 0, i) == (i if i % 2 == 0 else 37))
    check(api.double_word(i) == 2 * i)
print(f'specialization-ok:{checks}')
