import lean_words as api

us = [0, 1, 2**32 - 1, 2**53 + 1, 2**64 - 1]
ss = [-2**63, -2**53 - 1, -1, 0, 2**63 - 1]
checks = 0
def check(value):
    global checks
    assert value
    checks += 1

check(api.word_bits() == 64)
for u, s in zip(us, ss):
    check(api.keep_unsigned(u) == u)
    check(api.keep_signed(s) == s)
    check(api.unsigned_text(u) == str(u))
    check(api.signed_text(s) == str(s))
    check(api.advance_unsigned(u) == (u + 1) % 2**64)
    check(api.advance_signed(s) == (-2**63 if s == 2**63 - 1 else s + 1))
    out = api.keep_sample(api.Sample(natural=u, integer=s, unsigned_values=us, signed_values=ss))
    check(out.natural == u and out.integer == s)
    check(tuple(out.unsigned_values) == tuple(us) and tuple(out.signed_values) == tuple(ss))
for name, valid, bads in [('unsigned', us, [-1, 2**64]), ('signed', ss, [-2**63 - 1, 2**63])]:
    for bad in bads + [True, None, 1.5, '1', [1]]:
        for call in [lambda: getattr(api, 'keep_' + name)(bad),
                     lambda: getattr(api, 'keep_' + name + '_values')([valid[0], bad]),
                     lambda: getattr(api, 'keep_' + name + '_rows')([[valid[0]], [bad]]),
                     lambda: api.keep_sample(api.Sample(natural=bad if name == 'unsigned' else 1, integer=bad if name == 'signed' else -1, unsigned_values=us, signed_values=ss)),
                     lambda: api.keep_sample(api.Sample(natural=1, integer=-1, unsigned_values=[bad] if name == 'unsigned' else us, signed_values=[bad] if name == 'signed' else ss))]:
            try:
                call()
            except (TypeError, ValueError, OverflowError):
                check(True)
            else:
                raise AssertionError('Invalid platform integer accepted')
            check(api.keep_signed(-1) == -1)
for _ in range(1000):
    check(api.keep_unsigned_values(us) == tuple(us))
    check(api.keep_signed_values(ss) == tuple(ss))
    check(api.keep_unsigned_rows([us, []]) == (tuple(us), ()))
    check(api.keep_signed_rows([ss, []]) == (tuple(ss), ()))
print(f'word-ok:{checks}')
