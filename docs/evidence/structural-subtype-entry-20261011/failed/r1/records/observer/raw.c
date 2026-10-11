#define _GNU_SOURCE
#include <structuralsubtypes.h>
#include <lean/lean.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef lean_object *(*unary)(lean_object *);
typedef lean_object *(*binary)(lean_object *, lean_object *);
static void *lookup(const char *name) { void *value = dlsym(RTLD_DEFAULT, name); if (!value) { fprintf(stderr, "missing raw symbol %s\n", name); exit(1); } return value; }
static lean_object *values(int bad, unary some) {
  lean_object *result = lean_mk_empty_array();
  for (int i = 0; i < 3; ++i) {
    lean_object *value = lean_unsigned_to_nat(i == bad ? 0 : (unsigned)i + 1);
    result = lean_array_push(result, some ? some(value) : value);
  }
  return result;
}
int main(int argc, char **argv) {
  if (argc != 3) return 2;
  const int bad = atoi(argv[2]);
  if (bad < -1 || bad > 2) return 2;
  structuralsubtypes_error error = {0}; mpz_t value, answer;
  mpz_init_set_ui(value, 1); mpz_init(answer);
  if (structuralsubtypes_unrestricted(value, answer, &error) != STRUCTURALSUBTYPES_STATUS_OK || mpz_cmp_ui(answer, 1)) return 1;
  mpz_clears(value, answer, NULL);
  unary call, some, list_from_array; binary call2, make_pair;
  lean_object *first = NULL, *second = NULL;
  const int array_case = strcmp(argv[1], "arrays") == 0;
  const int alias_case = strcmp(argv[1], "aliasArguments") == 0;
  const int nested_case = strcmp(argv[1], "nested") == 0;
  if (array_case) { *(void **)&call = lookup("lb_a8afafdcdccfd487c60aab47"); first = values(bad, NULL); }
  else if (alias_case) {
    *(void **)&call2 = lookup("lb_486d24ee5849ed09fee4459f"); *(void **)&some = lookup("lb_tundefined_some");
    first = values(-1, some); second = values(bad, some);
  } else if (nested_case) {
    *(void **)&call = lookup("lb_d0560c47cb866c2fde2d7214"); *(void **)&some = lookup("lb_tundefined_some");
    *(void **)&make_pair = lookup("lb_tundefined_make"); *(void **)&list_from_array = lookup("lb_tundefined_from_array");
    lean_object *number = lean_unsigned_to_nat(bad == 1 ? 0 : 1);
    lean_object *index = bad == 0 ? lean_cstr_to_nat("184467440737095516170") : lean_unsigned_to_nat(0);
    lean_object *row = some(make_pair(number, index));
    first = lean_array_push(lean_mk_empty_array(), list_from_array(lean_array_push(lean_mk_empty_array(), row)));
  } else return 2;
  fputs("LB_STRUCTURAL_RAW_V1 begin\n", stderr);
  lean_object *result = alias_case ? call2(first, second) : call(first);
  fputs("LB_STRUCTURAL_RAW_V1 end\n", stderr);
  const int accepted = !lean_is_scalar(result);
  if (accepted != (bad == -1)) return 1;
  if (accepted) {
    lean_object *payload = lean_ctor_get(result, 0);
    if (nested_case) { if (!lean_nat_dec_eq(payload, lean_unsigned_to_nat(1))) return 1; }
    else if (lean_array_size(payload) != (size_t)(alias_case ? 6 : 3)) return 1;
    if (alias_case && !lean_nat_dec_eq(lean_ctor_get(lean_array_get_core(payload, 3), 0), lean_unsigned_to_nat(2))) return 1;
  }
  lean_dec(result);
  printf("raw:%s:%d:%d\n", argv[1], bad, accepted);
  return 0;
}
