#undef NDEBUG
#include <lbc_wide.h>
#include <assert.h>
#include <poll.h>
#include <stdio.h>
#include <unistd.h>
#define OK(expr) assert((expr) == lbc_wide_OK)
#define READY(fn, handle) do { int fd = -1; lbc_wide_status s = fn(handle, &fd); \
    if (s == lbc_wide_PENDING) { struct pollfd slot = {fd, POLLIN, 0}; assert(poll(&slot, 1, 15000) == 1); } \
    else assert(s == lbc_wide_OK && fd == -1); } while (0)

int main(void) {
    alarm(90);
    mpz_t n, z, result, expected, error, save;
    mpz_inits(n, z, result, expected, error, save, NULL);
    /* Both halves of a split, a high word with its sign bit set, and zero words. */
    mpz_set_ui(n, 3); mpz_setbit(n, 4095); mpz_setbit(n, 2051); mpz_setbit(n, 511);
    mpz_mul_2exp(z, n, 1); mpz_neg(z, z); mpz_sub_ui(z, z, 17);
    mpz_add(expected, n, z);
    lbc_wide_sum_handle a = {0}; lbc_wide_buffer ioe = {0}; uint32_t hits = 0;
    OK(lbc_wide_sum_start(n, z, &a)); READY(lbc_wide_sum_poll, a); OK(lbc_wide_sum_take(&a, result));
    assert(mpz_cmp(result, expected) == 0);
    OK(lbc_wide_calls_call(&hits, &ioe)); assert(hits == 1);
    assert(lbc_wide_sum_start(z, n, &a) == lbc_wide_INVALID && !a.id);
    mpz_set_ui(save, 1); mpz_mul_2exp(save, save, 134217720); /* within limit on its own */
    assert(lbc_wide_sum_start(save, z, &a) == lbc_wide_LIMIT && !a.id);
    OK(lbc_wide_calls_call(&hits, &ioe)); assert(hits == 1);
    mpz_set_ui(save, 0);
    OK(lbc_wide_sum_start(save, save, &a)); OK(lbc_wide_sum_take(&a, result)); assert(mpz_sgn(result) == 0);
    lbc_wide_huge_handle huge = {0};
    OK(lbc_wide_huge_start(134217728, &huge)); mpz_set_si(result, -49);
    assert(lbc_wide_huge_take(&huge, result) == lbc_wide_LIMIT && !huge.id && mpz_cmp_si(result, -49) == 0);
    OK(lbc_wide_huge_start(64, &huge)); OK(lbc_wide_huge_take(&huge, result));
    assert(mpz_popcount(result) == 1 && mpz_tstbit(result, 64));
    lbc_wide_late_handle late = {0};
    mpz_set(save, z); OK(lbc_wide_late_start(z, &late)); mpz_set_ui(z, 0);
    assert(lbc_wide_late_take(&late, result) == lbc_wide_PENDING);
    uint8_t unit; OK(lbc_wide_open_gate_call(&unit, &ioe));
    READY(lbc_wide_late_poll, late); OK(lbc_wide_late_take(&late, result)); assert(mpz_cmp(result, save) == 0);
    mpz_set(z, save);

    lbc_wide_checked_handle ch = {0}; lbc_wide_checked_value nested = {0};
    assert(lbc_wide_checked_start(true, false, n, z, &ch, error) == lbc_wide_TYPED_ERROR && !ch.id && mpz_cmp(error, z) == 0);
    OK(lbc_wide_checked_start(false, true, n, z, &ch, error)); OK(lbc_wide_checked_take(&ch, &nested));
    assert(!nested.ok && mpz_cmp(nested.as.error, z) == 0);
    lbc_wide_checked_value_dispose(&nested); lbc_wide_checked_value_dispose(&nested);
    OK(lbc_wide_checked_start(false, false, n, z, &ch, error)); OK(lbc_wide_checked_take(&ch, &nested));
    assert(nested.ok && !nested.as.value.ok && mpz_cmp(nested.as.value.as.error, n) == 0); lbc_wide_checked_value_dispose(&nested);
    OK(lbc_wide_checked_start(false, false, n, n, &ch, error)); OK(lbc_wide_checked_take(&ch, &nested));
    assert(nested.ok && nested.as.value.ok && mpz_cmp(nested.as.value.as.value, n) == 0); lbc_wide_checked_value_dispose(&nested);

    lbc_wide_series_handle st = {0}; lbc_wide_series_value item = {0};
    assert(lbc_wide_series_start(true, false, n, z, &st, error) == lbc_wide_TYPED_ERROR && !st.id && mpz_cmp(error, n) == 0);
    for (int terminal = 0; terminal <= 1; ++terminal) {
        OK(lbc_wide_series_start(false, terminal, n, z, &st, error));
        OK(lbc_wide_series_pull(st)); OK(lbc_wide_series_take(&st, &item, error));
        assert(!item.ok && mpz_cmp(item.as.error, n) == 0); lbc_wide_series_value_dispose(&item);
        OK(lbc_wide_series_pull(st));
        if (terminal) { assert(lbc_wide_series_take(&st, &item, error) == lbc_wide_TYPED_ERROR && mpz_cmp(error, z) == 0); }
        else { OK(lbc_wide_series_take(&st, &item, error)); assert(item.ok && mpz_cmp(item.as.value, z) == 0);
            lbc_wide_series_value_dispose(&item); OK(lbc_wide_series_pull(st)); assert(lbc_wide_series_take(&st, &item, error) == lbc_wide_END); }
        assert(!st.id); lbc_wide_series_value_dispose(&item);
    }
    OK(lbc_wide_closes_call(&hits, &ioe)); assert(hits == 2);
    mpz_clears(n, z, result, expected, error, save, NULL);
    puts("exact installed c tasks: ok"); return 0;
}
