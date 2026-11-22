/* Compile this same corpus as C11/GMP or C++20/Boost. Check Lean-created
   magnitudes independently, so mutually inverse conversion mistakes cannot
   turn a broken encoder/decoder round trip into a passing test. */
#undef NDEBUG
#include <assert.h>
#include <stdio.h>
#ifdef __cplusplus
#include <lbc_wide.hpp>
namespace api = lean_bridge::lbc_wide;
#else
#include <lbc_wide.h>
#endif
int main(void) {
    const unsigned bits[] = {0,1,2,30,31,32,33,61,62,63,64,65,126,127,128,129,
        447,448,449,510,511,512,513,575,576,577,1023,1024,1025,4097,32767,123456};
    for (unsigned i = 0; i < sizeof(bits)/sizeof(*bits); ++i) {
        unsigned k = bits[i];
#ifdef __cplusplus
        api::Nat power = api::Nat(1) << k;
        assert(api::huge(k).get() == power);
        api::Int n = power + (api::Nat(1) << (k / 3)) + 19;
        for (int delta = -1; delta <= 1; ++delta) {
            api::Int z = -n + delta; assert(api::sum(n, z).get() == delta);
            z -= n; assert(api::sum(n, z).get() == -n + delta);
        }
#else
        mpz_t power, n, z, answer, expect; mpz_inits(power, n, z, answer, expect, NULL);
        mpz_setbit(power, k); lbc_wide_huge_handle h = {0};
        assert(lbc_wide_huge_start(k, &h) == lbc_wide_OK && lbc_wide_huge_take(&h, answer) == lbc_wide_OK);
        assert(mpz_cmp(power, answer) == 0);
        mpz_setbit(n, k / 3); mpz_add(n, n, power); mpz_add_ui(n, n, 19);
        for (long delta = -1; delta <= 1; ++delta) {
            mpz_set_si(expect, delta); mpz_sub(z, expect, n); lbc_wide_sum_handle s = {0};
            assert(lbc_wide_sum_start(n, z, &s) == lbc_wide_OK && lbc_wide_sum_take(&s, answer) == lbc_wide_OK);
            assert(mpz_cmp(answer, expect) == 0);
            mpz_sub(z, z, n); mpz_sub(expect, expect, n);
            assert(lbc_wide_sum_start(n, z, &s) == lbc_wide_OK && lbc_wide_sum_take(&s, answer) == lbc_wide_OK);
            assert(mpz_cmp(answer, expect) == 0);
        }
        mpz_clears(power, n, z, answer, expect, NULL);
#endif
    }
    puts("32 exact integer boundaries: ok"); return 0;
}
