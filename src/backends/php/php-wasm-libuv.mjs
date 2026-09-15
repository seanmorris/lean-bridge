/**
 * Unsupported filesystem operations for the pure PHP-Wasm runtime profile.
 *
 * @file
 */
export const phpWasmUnsupportedLibuvC = `#include <stddef.h>
#include <stdint.h>
#include <lean/lean.h>
#include <uv.h>

/*
 * Lean's pinned WebAssembly libuv build deliberately leaves part of its
 * platform layer undefined. A main Emscripten module can tolerate those
 * symbols, but a dynamically loaded side module cannot. The PHP-Wasm
 * profile does not advertise Lean file-system support, so these entry points
 * form an explicit unsupported-operation boundary instead of pulling a
 * second system runtime into the shared PHP memory.
 */

static int lean_bridge_uv_unsupported(uv_fs_t *request) {
  if (request != NULL) request->result = UV_ENOSYS;
  return UV_ENOSYS;
}

const char *uv_strerror(int error) {
  (void)error;
  return "operation is unavailable in the PHP-Wasm Lean runtime profile";
}

void uv_fs_req_cleanup(uv_fs_t *request) {
  (void)request;
}

int uv_fs_stat(uv_loop_t *loop, uv_fs_t *request, const char *path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_lstat(uv_loop_t *loop, uv_fs_t *request, const char *path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_link(uv_loop_t *loop, uv_fs_t *request, const char *path, const char *new_path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)new_path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_unlink(uv_loop_t *loop, uv_fs_t *request, const char *path, uv_fs_cb callback) {
  (void)loop; (void)path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_mkdtemp(uv_loop_t *loop, uv_fs_t *request, const char *template_path, uv_fs_cb callback) {
  (void)loop; (void)template_path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_fs_mkstemp(uv_loop_t *loop, uv_fs_t *request, const char *template_path, uv_fs_cb callback) {
  (void)loop; (void)template_path; (void)callback;
  return lean_bridge_uv_unsupported(request);
}

int uv_os_tmpdir(char *buffer, size_t *size) {
  (void)buffer; (void)size;
  return UV_ENOSYS;
}

`;
