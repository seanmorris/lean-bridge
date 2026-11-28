/* Included only by exact-integer task adapters. Never borrow a GMP or Boost
   allocation into a Lean task, or depend on Lean's private integer layout.
   Words are native-endian uint64_t in increasing order of significance. */
static lean_object *lb_nat_import(const unsigned char *words, size_t n) {
    if (n <= 8) {
        lean_object *v = lean_box(0);
        while (n) {
            uint64_t limb; memcpy(&limb, words + 8 * --n, 8);
            lean_object *hi = lean_nat_shiftl(v, lean_box(64)), *lo = lean_uint64_to_nat(limb);
            lean_dec(v); v = lean_nat_lor(hi, lo); lean_dec(hi); lean_dec(lo);
        }
        return v;
    }
    size_t half = n / 2;
    lean_object *hi = lb_nat_import(words + 8 * half, n - half);
    lean_object *shifted = lean_nat_shiftl(hi, lean_box(64 * half)); lean_dec(hi);
    lean_object *lo = lb_nat_import(words, half), *v = lean_nat_lor(shifted, lo);
    lean_dec(shifted); lean_dec(lo); return v;
}
static lean_object *lb_integer_import(const void *words, size_t n, int negative, int is_signed) {
    lean_object *v = lb_nat_import((const unsigned char *)words, n);
    if (is_signed) {
        v = lean_nat_to_int(v);
        if (negative) { lean_object *neg = lean_int_neg(v); lean_dec(v); v = neg; }
    }
    return v;
}
/* Split large magnitudes in half: repeated shifts across the entire integer
   would make a valid near-budget argument or result quadratic in its size. */
static void lb_nat_export(lean_object *v, unsigned char *words, size_t n) {
    if (n <= 8) {
        lean_inc(v);
        for (size_t i = 0; i < n; ++i) {
            uint64_t limb = lean_uint64_of_nat(v); memcpy(words + i * 8, &limb, 8);
            lean_object *next = lean_nat_shiftr(v, lean_box(64)); lean_dec(v); v = next;
        }
        lean_dec(v); return;
    }
    size_t half = n / 2; lean_object *shift = lean_box(64 * half);
    lean_object *hi = lean_nat_shiftr(v, shift), *power = lean_nat_shiftl(lean_box(1), shift);
    lean_object *mask = lean_nat_sub(power, lean_box(1)); lean_dec(power);
    lean_object *lo = lean_nat_land(v, mask); lean_dec(mask);
    lb_nat_export(lo, words, half); lean_dec(lo);
    lb_nat_export(hi, words + 8 * half, n - half); lean_dec(hi);
}
static LB(status) lb_word_count(lean_object *mag, size_t *n) {
    *n = 0; if (lean_nat_eq(mag, lean_box(0))) return LB(OK);
    lean_object *bits = lean_nat_log2(mag);
    if (!lean_is_scalar(bits) || lean_unbox(bits) >= 8u * LB_MAX_BYTES) { lean_dec(bits); return LB(LIMIT); }
    *n = lean_unbox(bits) / 64 + 1; lean_dec(bits); return LB(OK);
}
static LB(status) lb_charge_integer(size_t count, size_t *budget) {
    if (count > (LB_MAX_BYTES - *budget) / 8) return LB(LIMIT);
    *budget += count * 8; return LB(OK);
}
#if LB_TASK_GMP
_Static_assert(GMP_NUMB_BITS == 64 && sizeof(mp_limb_t) == 8, "64-bit nail-free GMP required");
static LB(status) lb_check_integer(mpz_srcptr v, int is_signed, size_t *budget) {
    if (!v || (!is_signed && mpz_sgn(v) < 0)) return LB(INVALID);
    return lb_charge_integer(mpz_size(v), budget);
}
static lean_object *lb_integer_arg(mpz_srcptr v, int is_signed) {
    return lb_integer_import(mpz_limbs_read(v), mpz_size(v), mpz_sgn(v) < 0, is_signed);
}
static LB(status) lb_integer_result(mpz_ptr out, lean_object *v, int is_signed) {
    int negative = is_signed && lean_int_lt(v, lean_box(0));
    lean_object *mag = is_signed ? lean_nat_abs(v) : v; if (!is_signed) lean_inc(mag);
    size_t n; LB(status) s = lb_word_count(mag, &n);
    if (s == LB(OK)) {
        if (!n) mpz_set_ui(out, 0);
        else {
            mp_limb_t *words = mpz_limbs_write(out, (mp_size_t)n);
            lb_nat_export(mag, (unsigned char *)words, n);
            mpz_limbs_finish(out, negative ? -(mp_size_t)n : (mp_size_t)n);
        }
    }
    lean_dec(mag); return s;
}
#else
static LB(status) lb_check_integer(LB(integer_view) v, int is_signed, size_t *budget) {
    LB(status) s = lb_charge_integer(v.len, budget); if (s != LB(OK)) return s;
    if (v.negative && (!is_signed || !v.len)) return LB(INVALID);
    if (v.len && (!v.words || (uintptr_t)v.words % _Alignof(uint64_t) || !v.words[v.len - 1])) return LB(INVALID);
    return LB(OK);
}
static lean_object *lb_integer_arg(LB(integer_view) v, int is_signed) {
    return lb_integer_import(v.words, v.len, v.negative, is_signed);
}
void LB(integer_dispose)(LB(integer) *v) {
    if (v) { free(v->words); *v = (LB(integer)){0}; }
}
static LB(status) lb_integer_result(LB(integer) *out, lean_object *v, int is_signed) {
    bool negative = is_signed && lean_int_lt(v, lean_box(0));
    lean_object *mag = is_signed ? lean_nat_abs(v) : v; if (!is_signed) lean_inc(mag);
    size_t n; LB(status) s = lb_word_count(mag, &n);
    if (s == LB(OK)) {
        uint64_t *words = n ? malloc(n * sizeof(*words)) : NULL;
        if (n && !words) s = LB(NO_MEMORY);
        else { lb_nat_export(mag, (unsigned char *)words, n); *out = (LB(integer)){words, n, negative}; }
    }
    lean_dec(mag); return s;
}
#endif
