/* Compare only the public Wasmtime value kinds used by this fixture. No Lean layout is inspected. */
static bool edge_equal(const value *a, const value *b) {
  if (a->kind != b->kind) return false;
  if (a->kind == WASMTIME_COMPONENT_U32) return a->of.u32 == b->of.u32;
  if (a->kind == WASMTIME_COMPONENT_OPTION) {
    if (!a->of.option || !b->of.option) return a->of.option == b->of.option;
    return edge_equal(a->of.option, b->of.option);
  }
  if (a->kind == WASMTIME_COMPONENT_LIST) {
    if (a->of.list.size != b->of.list.size) return false;
    for (size_t i = 0; i < a->of.list.size; ++i)
      if (!edge_equal(&a->of.list.data[i], &b->of.list.data[i])) return false;
    return true;
  }
  return false;
}

/* Retain a deep public-value snapshot through the failed call, then dispose both owners. */
static bool edge_refused(const char *name, value *argument, const char *needle) {
  value snapshot = {0}, output = {.kind = WASMTIME_COMPONENT_U32, .of.u32 = 991};
  wasmtime_component_val_clone(argument, &snapshot);
  wasmtime_error_t *error = fincontainers_wasmtime_call(session, name, argument, 1, &output);
  bool unchanged = edge_equal(argument, &snapshot);
  clear(argument); clear(&snapshot);
  if (!error) { clear(&output); return false; }
  wasm_name_t message; wasmtime_error_message(error, &message);
  char *copy = calloc(message.size + 1, 1);
  if (!copy) exit(1);
  memcpy(copy, message.data, message.size);
  bool found = strstr(copy, needle) != NULL;
  if (!found) fprintf(stderr, "%s: expected '%s' in '%s'\n", name, needle, copy);
  free(copy); wasm_name_delete(&message); wasmtime_error_delete(error);
  return found && unchanged && output.kind == WASMTIME_COMPONENT_U32 && output.of.u32 == 991;
}
