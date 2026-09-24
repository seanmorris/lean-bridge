/**
 * Bind prepared WIT hosts to the dependency bytes in their compiler receipts.
 * Linux may reuse a previously loaded SONAME from another package directory.
 * Validate the loaded files before any native Lean or Wasmtime session work.
 *
 * @file
 */
import { witHostLibraryHash } from "./host-library-hash.mjs";

/**
 * Collect only authenticated dynamic libraries, with no build-machine paths.
 *
 * @param evidence - Verified native component, adapter and runtime receipts.
 * @param wasmtimeFiles - Verified pinned Wasmtime C API file identities.
 */
export const witHostDependencies = (evidence, wasmtimeFiles) => {
	const { receipt, adapter, runtime } = evidence;
	const libraries = [
		[adapter.library, adapter.files[`lib/${adapter.library}`]]
		, [receipt.library, receipt.nativeLibrary]
		, ...Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, identity]) => [path.slice(4), identity])
		, ["libwasmtime.so", wasmtimeFiles["lib/libwasmtime.so"]]
	].map(([name, identity]) => ({ name, bytes: identity?.bytes, sha256: identity?.sha256 }));
	if(libraries.length !== 5 || new Set(libraries.map(item => item.name)).size !== libraries.length
		|| libraries.some(item => !/^lib[A-Za-z0-9_]+\.so$/.test(item.name) || !Number.isSafeInteger(item.bytes) || item.bytes < 1 || !/^[a-f0-9]{64}$/.test(item.sha256)))
		throw new Error("WIT host requires exact identities for its five native dependencies");
	return libraries.sort((a, b) => a.name.localeCompare(b.name, "en"));
};

/**
 * Guard every public entry and custom-linker import, failing on template drift.
 * Generated hosts use local function binding and eager relocations at link time.
 * Dependency files must remain installed and immutable while loading a host.
 *
 * @param source - Generated copied, callable or recursive WIT C host.
 * @param prefix - Validated public C prefix.
 * @param dependencies - Authenticated file identities from witHostDependencies.
 */
export const guardWitHostSource = (source, prefix, dependencies) => {
	if(!/^[a-z][a-z0-9_]*$/.test(prefix)) throw new Error("Invalid WIT host symbol prefix");
	const names = new Set();
	const guarded = source.replace(new RegExp(`((?:static )?wasmtime_error_t \\*(${prefix}_wasmtime_[a-z0-9_]+|lb_call_[0-9]+)\\([^;{}]*\\) \\{)`, "g"), (match, signature, name) => {
		if(names.has(name)) throw new Error(`Duplicate WIT host entry: ${name}`);
		names.add(name);
		return `${signature}\n  const char *package_failure = lb_package_failure();\n  if (package_failure) return wasmtime_error_new(package_failure);`;
	});
	for(const name of ["open", "link", "call"])
		if(!names.has(`${prefix}_wasmtime_${name}`)) throw new Error(`Missing guarded WIT host entry: ${name}`);
	if(!names.has("lb_call_0")) throw new Error("Missing guarded WIT import");
	const close = `void ${prefix}_wasmtime_close(${prefix}_wasmtime *session) {`;
	if(guarded.split(close).length !== 2) throw new Error("Missing unique WIT host close entry");
	return `#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <dlfcn.h>
#include <link.h>
${witHostLibraryHash}

static pid_t lb_package_pid;
static const char *lb_package_problem = "WIT package dependencies have not been verified";
static const struct { const char *name; uint64_t bytes; const char *sha256; } lb_package_libraries[] = {
${dependencies.map(item => `  {${JSON.stringify(item.name)}, UINT64_C(${item.bytes}), ${JSON.stringify(item.sha256)}}`).join(",\n")}
};
typedef struct { unsigned seen[${dependencies.length}]; const char *failure; } lb_package_scan;
static int lb_package_library(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size;
  lb_package_scan *scan = data;
  const char *path = info->dlpi_name;
  if (!path || !*path) return 0;
  const char *slash = strrchr(path, '/'), *name = slash ? slash+1 : path;
  for (size_t i = 0; i < sizeof(lb_package_libraries)/sizeof(lb_package_libraries[0]); ++i) {
    if (strcmp(name, lb_package_libraries[i].name)) continue;
    if (!lb_receipt_file_matches(path, lb_package_libraries[i].bytes, lb_package_libraries[i].sha256)) {
      scan->failure = "WIT package dependency conflict: loaded library differs from its receipt";
      return 1;
    }
    /* Resolve lazy dependency relocations before another host is loaded. */
    void *loaded = dlopen(path, RTLD_NOW | RTLD_NOLOAD);
    if (!loaded) { scan->failure = "Cannot bind verified WIT dependency"; return 1; }
    dlclose(loaded);
    scan->seen[i] = 1;
  }
  return 0;
}
__attribute__((constructor)) static void lb_package_verify(void) {
  lb_package_pid = getpid();
  lb_package_scan scan = {0};
  dl_iterate_phdr(lb_package_library, &scan);
  for (size_t i = 0; i < sizeof(scan.seen)/sizeof(scan.seen[0]); ++i)
    if (!scan.seen[i] && !scan.failure) scan.failure = "WIT package dependency is missing from the loaded libraries";
  lb_package_problem = scan.failure;
}
static const char *lb_package_failure(void) {
  if (getpid() != lb_package_pid) return "WIT hosts cannot be used after fork; exec a fresh process";
  return lb_package_problem;
}
${guarded.replace(close, `${close}\n  if (getpid() != lb_package_pid) return;`)}
`;
};
