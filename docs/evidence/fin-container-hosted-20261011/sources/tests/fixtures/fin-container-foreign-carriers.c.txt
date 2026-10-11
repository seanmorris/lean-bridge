#define _GNU_SOURCE
#include "fincontainers.h"
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

typedef union carrier {
  fincontainers_array_nat_span array;
  fincontainers_list_nat_span list;
  fincontainers_option_nat_value option;
  fincontainers_option_list_nat_value optional;
  fincontainers_array_option_nat_span options;
  fincontainers_list_array_nat_span rows;
} carrier;
typedef struct arena {
  uint32_t limbs[9];
  fincontainers_nat nats[9];
  fincontainers_option_nat_value options[3];
  fincontainers_array_nat_span rows[3];
  carrier input;
} arena;
static unsigned long (*counter)(unsigned);
static unsigned long calls, released;
static void fail(const char *message) { fprintf(stderr, "foreign carrier probe: %s\n", message); exit(5); }
static void borrowed_release(void *owner) { (void)owner; released++; }
static void check_definition(const char *symbol, const char *expected) {
  void *address = dlsym(RTLD_DEFAULT, symbol); Dl_info info;
  char *actual = address && dladdr(address, &info) ? realpath(info.dli_fname, NULL) : NULL;
  if (!actual || strcmp(actual, expected)) { free(actual); fail("unexpected public definition"); }
  free(actual);
}
static void setup(arena *a, unsigned method) {
  memset(a, 0, sizeof(*a));
  for (unsigned i = 0; i < 9; i++) {
    a->limbs[i] = i + 1;
    a->nats[i] = (fincontainers_nat){&a->limbs[i], 1, a, borrowed_release};
  }
  for (unsigned i = 0; i < 3; i++) {
    a->options[i].has_value = i != 1;
    a->options[i].value = a->nats[i];
    a->rows[i] = (fincontainers_array_nat_span){&a->nats[3 * i], 3, a, borrowed_release};
  }
  switch (method) {
    case 0: a->input.array = (fincontainers_array_nat_span){NULL, 0, a, borrowed_release}; break;
    case 1: a->input.list = (fincontainers_list_nat_span){NULL, 0, a, borrowed_release}; break;
    case 2: a->input.option.has_value = 0; a->input.option.value = a->nats[0]; break;
    case 3: a->input.optional.has_value = 1; a->input.optional.value = (fincontainers_list_nat_span){a->nats, 3, a, borrowed_release}; break;
    case 4: a->input.options = (fincontainers_array_option_nat_span){a->options, 3, a, borrowed_release}; break;
    case 5: a->input.rows = (fincontainers_list_array_nat_span){a->rows, 3, a, borrowed_release}; break;
    default: fail("unknown method");
  }
}
static void change(arena *a, unsigned method, unsigned kind, unsigned row, unsigned column) {
  if (kind <= 2) return;
  size_t length = kind == 4 ? SIZE_MAX : 1;
  if (kind == 3 || kind == 4) {
    switch (method) {
      case 0: a->input.array.data = kind == 4 ? a->nats : NULL; a->input.array.length = length; break;
      case 1: a->input.list.data = kind == 4 ? a->nats : NULL; a->input.list.length = length; break;
      case 2: a->input.option.has_value = 1; a->input.option.value.data = kind == 4 ? a->limbs : NULL; a->input.option.value.length = length; break;
      case 3: a->input.optional.value.data = kind == 4 ? a->nats : NULL; a->input.optional.value.length = length; break;
      case 4: a->input.options.data = kind == 4 ? a->options : NULL; a->input.options.length = length; break;
      case 5: a->input.rows.data = kind == 4 ? a->rows : NULL; a->input.rows.length = length; break;
      default: fail("unknown root");
    }
    return;
  }
  if (kind == 5) {
    a->nats[row].data = NULL; a->nats[row].length = 1;
    switch (method) {
      case 0: a->input.array.data = a->nats; a->input.array.length = 3; break;
      case 1: a->input.list.data = a->nats; a->input.list.length = 3; break;
      case 2: a->input.option.has_value = 1; a->input.option.value = a->nats[row]; break;
      case 3: break;
      case 4: a->options[row].has_value = 1; a->options[row].value = a->nats[row]; break;
      default: fail("unknown leaf");
    }
    return;
  }
  if (kind == 6) {
    if (method == 2) a->input.option.has_value = column;
    else if (method == 3) a->input.optional.has_value = column;
    else if (method == 4) a->options[row].has_value = column;
    else fail("unknown option");
    return;
  }
  if (kind == 7) { a->rows[row].data = NULL; a->rows[row].length = 1; return; }
  if (kind == 8) { a->nats[3 * row + column].data = NULL; a->nats[3 * row + column].length = 1; return; }
  if (kind == 9) {
    fincontainers_nat poison = {NULL, SIZE_MAX, a, borrowed_release};
    switch (method) {
      case 0: a->nats[0] = poison; a->input.array.data = a->nats; break;
      case 1: a->nats[0] = poison; a->input.list.data = a->nats; break;
      case 2: a->input.option.value = poison; break;
      case 3: a->input.optional.has_value = 0; a->input.optional.value.data = NULL; a->input.optional.value.length = SIZE_MAX; break;
      case 4: for (unsigned i = 0; i < 3; i++) { a->options[i].has_value = 0; a->options[i].value = poison; } break;
      case 5: for (unsigned i = 0; i < 3; i++) { a->rows[i].data = a->nats; a->rows[i].length = 0; } a->nats[0] = poison; break;
      default: fail("unknown inactive payload");
    }
    return;
  }
  if (kind == 10) {
    switch (method) {
      case 0: a->input.array.data = a->nats; a->input.array.length = 1; break;
      case 1: a->input.list.data = a->nats; a->input.list.length = 1; break;
      case 2: a->input.option.has_value = 1; break;
      case 3: a->limbs[1] = 10; break;
      case 4: a->options[1].has_value = 1; a->limbs[1] = 10; break;
      case 5: a->limbs[4] = 10; break;
      default: fail("unknown bound");
    }
    return;
  }
  fail("unknown case");
}
static fincontainers_status invoke(unsigned method, const carrier *arg, carrier *out, fincontainers_error *error) {
  switch (method) {
    case 0: return fincontainers_empty_array(arg ? &arg->array : NULL, out ? &out->array : NULL, error);
    case 1: return fincontainers_empty_list(arg ? &arg->list : NULL, out ? &out->list : NULL, error);
    case 2: return fincontainers_empty_option(arg ? &arg->option : NULL, out ? &out->option : NULL, error);
    case 3: return fincontainers_optional_digits(arg ? &arg->optional : NULL, out ? &out->optional : NULL, error);
    case 4: return fincontainers_present(arg ? &arg->options : NULL, out ? &out->array : NULL, error);
    case 5: return fincontainers_flatten(arg ? &arg->rows : NULL, out ? &out->optional : NULL, error);
    default: fail("unknown call"); return FINCONTAINERS_STATUS_UNEXPECTED_ERROR;
  }
}
static void sentinels(carrier *out, arena *a, unsigned method) {
  memset(out, 0, sizeof(*out));
  if (method == 0 || method == 4) out->array = (fincontainers_array_nat_span){a->nats, 9, a, borrowed_release};
  else if (method == 1) out->list = (fincontainers_list_nat_span){a->nats, 9, a, borrowed_release};
  else if (method == 2) { out->option.has_value = 1; out->option.value = a->nats[8]; }
  else { out->optional.has_value = 1; out->optional.value = (fincontainers_list_nat_span){a->nats, 9, a, borrowed_release}; }
}
static void result(carrier *out, unsigned method, unsigned kind) {
  const fincontainers_nat *values = NULL; size_t count = 0;
  size_t expected = kind == 9 ? 0 : method == 3 ? 3 : method == 4 ? 2 : method == 5 ? 9 : 0;
  if (method == 0 || method == 4) { count = out->array.length; values = out->array.data; }
  else if (method == 1) { count = out->list.length; values = out->list.data; }
  else if (method == 2) { if (out->option.has_value != 0) fail("Fin 0 result is present"); }
  else {
    if (out->optional.has_value != (method == 3 && kind == 9 ? 0 : 1)) fail("incorrect result presence");
    if (out->optional.has_value) { count = out->optional.value.length; values = out->optional.value.data; }
  }
  if (count != expected || (count && !values)) fail("incorrect result length");
  for (size_t i = 0; i < count; i++) {
    uint32_t value = method == 4 ? (i ? 3 : 1) : i + 1;
    if (values[i].length != 1 || !values[i].data || values[i].data[0] != value) fail("incorrect result Nat");
  }
  if (method == 0 || method == 4) fincontainers_array_nat_span_clear(&out->array);
  else if (method == 1) fincontainers_list_nat_span_clear(&out->list);
  else if (method == 2) fincontainers_option_nat_value_clear(&out->option);
  else fincontainers_option_list_nat_value_clear(&out->optional);
}
static void exercise(unsigned method, unsigned kind, unsigned row, unsigned column) {
  arena a, snapshot; carrier out, saved; fincontainers_error error = {0};
  unsigned long before[8]; for (unsigned i = 0; i < 8; i++) before[i] = counter(i);
  int accepted = kind == 0 || kind == 9;
  setup(&a, method); change(&a, method, kind, row, column);
  memcpy(&snapshot, &a, sizeof(a));
  memset(&out, 0, sizeof(out)); if (!accepted) sentinels(&out, &a, method);
  memcpy(&saved, &out, sizeof(out));
  fincontainers_status status = invoke(method, kind == 1 ? NULL : &a.input, kind == 2 ? NULL : &out, &error);
  calls++;
  if (memcmp(&snapshot, &a, sizeof(a)) || released) fail("caller input or borrowed ownership changed");
  if (accepted) {
    if (status != FINCONTAINERS_STATUS_OK || error.code != FINCONTAINERS_ERROR_NONE) fail("positive call refused");
    result(&out, method, kind);
  } else {
    const char *bounds[6] = {"arg0[0] is not below its Fin 0 bound", "arg0[0] is not below its Fin 0 bound", "arg0? is not below its Fin 0 bound",
      "arg0?[1] is not below its Fin 10 bound", "arg0[1]? is not below its Fin 10 bound", "arg0[1][1] is not below its Fin 10 bound"};
    const char *message = kind <= 2 ? "a required C argument is null" : kind == 10 ? bounds[method] : "Invalid copied input or 16 MiB call limit exceeded";
    if (status != FINCONTAINERS_STATUS_INVALID_ARGUMENT || error.code != FINCONTAINERS_ERROR_INVALID_ARGUMENT
      || !error.message || error.message_length != strlen(message) || memcmp(error.message, message, strlen(message)))
      fail("incorrect structural or bound refusal");
    if (memcmp(&saved, &out, sizeof(out))) fail("rejection changed the result slot");
  }
  if (released) fail("borrowed input or sentinel output released");
  for (unsigned i = 0; i < 8; i++) {
    unsigned long delta = accepted && (i == method + 2 || (method >= 4 && i == method - 4)) ? 1 : 0;
    if (counter(i) != before[i] + delta) fail("incorrect source or adapter dispatch");
  }
}
static void report(const char *name, const char *status) {
  printf("foreign-carrier %s %s %lu", name, status, calls);
  for (unsigned i = 0; i < 8; i++) printf(" %lu", counter(i));
  putchar('\n');
}
int main(void) {
  *(void **)&counter = dlsym(RTLD_DEFAULT, "fin_container_edge_count");
  if (!counter) { fputs("edge interposer is not loaded\n", stderr); return 2; }
/* FOREIGN_DEFINITIONS */
  report("start", "ok");
/* FOREIGN_CASES */
/* FOREIGN_RECOVERY */
  return 0;
}
