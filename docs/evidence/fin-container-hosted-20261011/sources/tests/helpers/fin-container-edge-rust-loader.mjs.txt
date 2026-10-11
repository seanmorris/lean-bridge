/**
 * Receipt-bound test instrumentation for Rust's extracted-and-unlinked native libraries.
 * Compare actual files before dlopen, capture owning link-map addresses while files still exist, then
 * compare every counter target with those addresses after the unmodified Rust loader removes files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { basename, dirname, isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeWireSymbols } from "./fin-container-edge-dispatch.mjs";
import { finContainerEntryInitializer } from "./fin-container-entry-dispatch.mjs";

/**
 * Render only instrumentation, preserving the actual dlopen arguments and generated loader behavior.
 *
 * @param model - Receipt-verified model.
 * @param component - Receipt component.
 * @param identity - Verified library files and all dynamic symbol owners.
 * @param identity.libraries - Absolute receipt-verified library paths in one directory.
 * @param identity.definitions - Exact eight columns, two initializers and six wire symbol paths.
 */
export const finContainerEdgeRustInterposer = (model, component, { libraries, definitions }) => {
	const columns = finContainerEdgeColumns(model, component);
	const symbols = [...columns, "lean_bridge_native_component_initialize", finContainerEntryInitializer(component.id), ...finContainerEdgeWireSymbols];
	assert.deepEqual(Object.keys(definitions).sort(), [...symbols].sort());
	assert.ok(Array.isArray(libraries) && libraries.length > 0);
	for(const path of libraries) assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0") && /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u.test(basename(path)));
	assert.equal(new Set(libraries.map(dirname)).size, 1);
	assert.equal(new Set(libraries.map(path => basename(path))).size, libraries.length);
	for(const path of Object.values(definitions)) assert.ok(libraries.includes(path));
	const definitionsC = symbols.map(symbol => `  {${JSON.stringify(symbol)}, ${libraries.indexOf(definitions[symbol])}, NULL}`).join(",\n");
	const wrappers = columns.map((symbol, index) => `void *${symbol}(void *argument) {
  static void *(*next)(void *);
  if (!next) {
    *(void **)&next = dlsym(RTLD_NEXT, "${symbol}");
    if (!next || (void *)next != definitions[${index}].address) { fputs("unexpected Rust edge target: ${symbol}\\n", stderr); exit(6); }
  }
  ++counts[${index}];
  return next(argument);
}`).join("\n");
	return `#define _GNU_SOURCE
#include <dlfcn.h>
#include <fcntl.h>
#include <link.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
static unsigned long counts[8];
static int failed;
static const char *libraries[] = {${libraries.map(path => JSON.stringify(path)).join(", ")}};
static unsigned char loaded[${libraries.length}];
static struct { const char *name; unsigned owner; void *address; } definitions[] = {
${definitionsC}
};
unsigned long fin_container_edge_count(unsigned index) { if (index >= 8) abort(); return counts[index]; }
int fin_container_edge_ready(void) {
  if (failed) return 0;
  for (unsigned i = 0; i < ${libraries.length}; ++i) if (!loaded[i]) return 0;
  for (unsigned i = 0; i < ${symbols.length}; ++i) if (!definitions[i].address) return 0;
  return 1;
}
static const char *filename(const char *path) { const char *slash = strrchr(path, '/'); return slash ? slash + 1 : path; }
static int equal_files(const char *actual, const char *expected) {
  int a = open(actual, O_RDONLY | O_NOFOLLOW), b = open(expected, O_RDONLY | O_NOFOLLOW);
  struct stat sa, sb; int valid = a >= 0 && b >= 0 && !fstat(a, &sa) && !fstat(b, &sb)
    && S_ISREG(sa.st_mode) && S_ISREG(sb.st_mode) && sa.st_size == sb.st_size;
  unsigned char left[65536], right[65536];
  while (valid) {
    ssize_t x = read(a, left, sizeof left), y = read(b, right, sizeof right);
    if (x < 0 || y < 0 || x != y) { valid = 0; break; }
    if (!x) break;
    if (memcmp(left, right, (size_t)x)) { valid = 0; break; }
  }
  if (a >= 0) close(a);
  if (b >= 0) close(b);
  return valid;
}
static void *refuse(void) { failed = 1; fputs("Rust edge library identity refused\\n", stderr); return NULL; }
void *dlopen(const char *path, int flags) {
  static void *(*real_open)(const char *, int);
  if (!real_open) { *(void **)&real_open = dlsym(RTLD_NEXT, "dlopen"); if (!real_open) abort(); }
  if (!path || (flags & RTLD_NOLOAD)) return real_open(path, flags);
  int owner = -1;
  for (unsigned i = 0; i < ${libraries.length}; ++i) if (!strcmp(filename(path), filename(libraries[i]))) owner = (int)i;
  if (owner < 0) return real_open(path, flags);
  char *canonical = realpath(path, NULL);
  static const char prefix[] = "/tmp/lean-bridge-rust-assets-";
  int private_path = canonical && !strcmp(canonical, path) && !strncmp(path, prefix, sizeof prefix - 1)
    && strlen(path) > sizeof prefix + 5 && path[sizeof prefix + 5] == '/';
  free(canonical);
  if (!private_path || loaded[owner] || failed || !equal_files(path, libraries[owner])) return refuse();
  void *handle = real_open(path, flags);
  struct link_map *map = NULL;
  if (!handle || dlinfo(handle, RTLD_DI_LINKMAP, &map) || !map || strcmp(map->l_name, path) || !equal_files(path, libraries[owner])) return refuse();
  for (unsigned i = 0; i < ${symbols.length}; ++i) if (definitions[i].owner == (unsigned)owner) {
    void *address = dlsym(handle, definitions[i].name); Dl_info info;
    if (!address || !dladdr(address, &info) || (void *)map->l_addr != info.dli_fbase || strcmp(info.dli_fname, path)) return refuse();
    definitions[i].address = address;
  }
  loaded[owner] = 1;
  return handle;
}
${wrappers}
`;
};
