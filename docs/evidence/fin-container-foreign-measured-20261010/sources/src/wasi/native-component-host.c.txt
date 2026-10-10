#include "lean_alpha.h"

#include <wasm.h>
#include <wasmtime.h>
#include <wasmtime/component.h>

#include <errno.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void fail_wasmtime(const char *operation, wasmtime_error_t *error)
{
  wasm_name_t message;
  wasmtime_error_message(error, &message);
  fprintf(stderr, "%s: %.*s\n", operation, (int)message.size, message.data);
  wasm_name_delete(&message);
  wasmtime_error_delete(error);
  exit(1);
}

static uint8_t *read_bytes(const char *path, size_t *length)
{
  FILE *file = fopen(path, "rb");
  if (file == NULL) {
    fprintf(stderr, "cannot open %s: %s\n", path, strerror(errno));
    exit(1);
  }
  if (fseek(file, 0, SEEK_END) != 0) exit(1);
  long size = ftell(file);
  if (size < 0 || fseek(file, 0, SEEK_SET) != 0) exit(1);
  uint8_t *bytes = malloc((size_t)size);
  if (bytes == NULL || fread(bytes, 1, (size_t)size, file) != (size_t)size) exit(1);
  fclose(file);
  *length = (size_t)size;
  return bytes;
}

static wasmtime_error_t *lean_read_box(
    void *data,
    wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type,
    wasmtime_component_val_t *args,
    size_t nargs,
    wasmtime_component_val_t *results,
    size_t nresults)
{
  (void)data;
  (void)context;
  (void)type;
  if (nargs != 1 || nresults != 1 || args[0].kind != WASMTIME_COMPONENT_U32) {
    return wasmtime_error_new("component adapter called the Lean host with the wrong signature");
  }
  lean_alpha_error error = {0};
  lean_alpha_box *box = NULL;
  uint32_t value = 0;
  lean_alpha_status status = lean_alpha_box_create(args[0].of.u32, &box, &error);
  if (status == LEAN_ALPHA_STATUS_OK) status = lean_alpha_box_read(box, &value, &error);
  lean_alpha_box_dispose(&box);
  if (status != LEAN_ALPHA_STATUS_OK) {
    return wasmtime_error_new(error.message == NULL ? "native Lean call failed" : error.message);
  }
  results[0].kind = WASMTIME_COMPONENT_U32;
  results[0].of.u32 = value;
  return NULL;
}

static void default_component_path(char output[PATH_MAX])
{
  char executable[PATH_MAX];
  ssize_t length = readlink("/proc/self/exe", executable, sizeof(executable) - 1);
  if (length < 1 || (size_t)length >= sizeof(executable) - 1) exit(1);
  executable[length] = 0;
  char *slash = strrchr(executable, '/');
  if (slash == NULL) exit(1);
  *slash = 0;
  slash = strrchr(executable, '/');
  if (slash == NULL) exit(1);
  *slash = 0;
  if (snprintf(output, PATH_MAX, "%s/component/lean-alpha.component.wasm", executable) >= PATH_MAX) exit(1);
}

int main(int argc, char **argv)
{
  char inferred[PATH_MAX];
  if (argc > 1) {
    if (strlen(argv[1]) >= sizeof(inferred)) return 2;
    strcpy(inferred, argv[1]);
  } else {
    default_component_path(inferred);
  }
  uint32_t input = argc > 2 ? (uint32_t)strtoul(argv[2], NULL, 10) : 42;
  size_t component_length = 0;
  uint8_t *component_bytes = read_bytes(inferred, &component_length);

  wasm_config_t *config = wasm_config_new();
  wasmtime_config_wasm_component_model_set(config, true);
  wasm_engine_t *engine = wasm_engine_new_with_config(config);
  wasmtime_component_t *component = NULL;
  wasmtime_error_t *error = wasmtime_component_new(engine, component_bytes, component_length, &component);
  free(component_bytes);
  if (error != NULL) fail_wasmtime("compile component", error);

  wasmtime_store_t *store = wasmtime_store_new(engine, NULL, NULL);
  wasmtime_context_t *context = wasmtime_store_context(store);
  wasmtime_component_linker_t *linker = wasmtime_component_linker_new(engine);
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker);
  error = wasmtime_component_linker_instance_add_func(root, "lean-read-box", 13, lean_read_box, NULL, NULL);
  wasmtime_component_linker_instance_delete(root);
  if (error != NULL) fail_wasmtime("link Lean host function", error);

  wasmtime_component_instance_t instance;
  error = wasmtime_component_linker_instantiate(linker, context, component, &instance);
  if (error != NULL) fail_wasmtime("instantiate component", error);
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(
      &instance, context, NULL, "read-box", 8);
  if (index == NULL) {
    fputs("component does not export read-box\n", stderr);
    return 1;
  }
  wasmtime_component_func_t function;
  if (!wasmtime_component_instance_get_func(&instance, context, index, &function)) return 1;
  wasmtime_component_val_t arguments[1] = {{.kind = WASMTIME_COMPONENT_U32, .of.u32 = input}};
  wasmtime_component_val_t results[1] = {0};
  error = wasmtime_component_func_call(&function, context, arguments, 1, results, 1);
  if (error != NULL) fail_wasmtime("call component", error);
  if (results[0].kind != WASMTIME_COMPONENT_U32) return 1;
  printf("%u\n", results[0].of.u32);

  wasmtime_component_val_delete(&results[0]);
  wasmtime_component_export_index_delete(index);
  wasmtime_component_linker_delete(linker);
  wasmtime_store_delete(store);
  wasmtime_component_delete(component);
  wasm_engine_delete(engine);
  return 0;
}
