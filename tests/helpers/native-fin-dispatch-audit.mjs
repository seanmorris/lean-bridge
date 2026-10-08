/**
 * Test-only LD_AUDIT counter for hosts whose loaders use RTLD_DEEPBIND, where an LD_PRELOAD interposer is
 * never consulted. The audit redirects only bindings to the configured defining library inside one verified
 * directory, and each redirected binding points at a trampoline that counts the call in a mapped record and
 * tail-jumps to the original definition. The record, not a private array, carries every count.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeFinDispatchSymbols } from "./native-fin-dispatch.mjs";

/** Fixed record layout shared by the audit, the host probes and this reader; little-endian x86_64. */
export const nativeFinAuditRecord = Object.freeze({
	size: 280, magic: "LBFINAUD", version: 1
	// Ruby String#unpack spelling of the same layout, used by the Ruby probe.
	, rubyFormat: "a8L<L<a64a32q<L<L<L<L<Q<6l<6L<6Q<6"
});
const library = /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u;

/**
 * Normalize an audit configuration: the six counted columns for one component and the one library that must
 * define each of them, chosen from the verified directory's libraries.
 *
 * @param root0 - Component identity, verified library basenames and per-column defining library.
 * @param root0.componentId - Component identity that names the adapters.
 * @param root0.libraries - Basenames of every verified library in the deployment directory.
 * @param root0.definers - Defining library basename for each counted symbol.
 */
export const nativeFinAuditConfig = ({ componentId, libraries, definers }) => {
	const columns = nativeFinDispatchSymbols(componentId), names = [...libraries].sort();
	if(!names.length || names.some(name => !library.test(name)) || new Set(names).size !== names.length) throw new TypeError("Invalid audited library names");
	if(Object.keys(definers).sort().join() !== [...columns].sort().join()) throw new TypeError("Every counted column needs exactly one defining library");
	if(columns.some(column => !names.includes(definers[column]))) throw new TypeError("A defining library is outside the audited libraries");
	return { schemaVersion: 1, platform: "x86_64-linux-gnu", glibc: ">=2.35", componentId, columns, libraries: names, definers: columns.map(column => definers[column]) };
};

/**
 * Digest of the normalized configuration; the audit records it and probes require it.
 *
 * @param config - Normalized configuration.
 */
export const nativeFinAuditConfigSha256 = config => sha256(canonicalJson(config));

/**
 * The single defining library of each counted symbol, from `nm -D --defined-only` listings of the verified
 * libraries. A symbol defined nowhere or in more than one library is refused.
 *
 * @param componentId - Component identity that names the adapters.
 * @param listings - Map from library basename to its nm output.
 */
export const nativeFinAuditDefiners = (componentId, listings) => Object.fromEntries(nativeFinDispatchSymbols(componentId).map(symbol => {
	const owners = Object.entries(listings).filter(([, text]) => text.split("\n").some(line => new RegExp(`^[0-9a-f]+ [TW] ${symbol}$`, "u").test(line.trim()))).map(([name]) => name);
	if(owners.length !== 1) throw new TypeError(`${symbol} must be defined by exactly one verified library, not ${owners.length}`);
	return [symbol, owners[0]];
}));

const cString = value => JSON.stringify(value);

/**
 * C source of the audit module for one configuration. The configuration digest is embedded; the compiled
 * library's own digest is recorded outside it.
 *
 * @param config - Normalized configuration.
 */
export const nativeFinAuditSource = config => {
	const count = config.columns.length;
	const trampolines = config.columns.map((_, k) => `".p2align 4\\n.globl lb_fin_audit_trampoline${k}\\n.hidden lb_fin_audit_trampoline${k}\\n.type lb_fin_audit_trampoline${k},@function\\n"
  "lb_fin_audit_trampoline${k}:\\n"
  "  movq lb_fin_audit_entries(%rip), %r11\\n"
  "  lock incq ${8 * k}(%r11)\\n"
  "  jmp *lb_fin_audit_targets+${8 * k}(%rip)\\n"`).join("\n  ");
	return `#define _GNU_SOURCE
#include <fcntl.h>
#include <gnu/libc-version.h>
#include <limits.h>
#include <link.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>
#if !defined(__x86_64__) || !defined(__linux__) || !defined(__GLIBC__)
#error "The Fin dispatch audit supports only x86_64 Linux with glibc"
#endif

enum { COLUMNS = ${count}, LIBRARIES = ${config.libraries.length} };
struct record {
  char magic[8];
  uint32_t version, columns;
  char config[64], nonce[32];
  int64_t pid;
  uint32_t attached, redirected, conflicts, foreign;
  uint64_t bindings[COLUMNS];
  int32_t definer[COLUMNS];
  uint32_t callers[COLUMNS];
  uint64_t entries[COLUMNS];
};
_Static_assert(sizeof(struct record) == ${nativeFinAuditRecord.size}, "record size");
_Static_assert(offsetof(struct record, entries) == ${nativeFinAuditRecord.size - 48}, "entry offset");
_Static_assert(LIBRARIES <= 32, "caller masks");

static const char config_sha256[] = ${cString(nativeFinAuditConfigSha256(config))};
static const char *const names[COLUMNS] = {${config.columns.map(cString).join(", ")}};
static const char *const libraries[LIBRARIES] = {${config.libraries.map(cString).join(", ")}};
static const int definers[COLUMNS] = {${config.definers.map(name => config.libraries.indexOf(name)).join(", ")}};
__attribute__((visibility("hidden"))) uint64_t *lb_fin_audit_entries;
__attribute__((visibility("hidden"))) void *lb_fin_audit_targets[COLUMNS];
${config.columns.map((_, k) => `__attribute__((visibility("hidden"))) void lb_fin_audit_trampoline${k}(void);`).join("\n")}
static void (*const trampolines[COLUMNS])(void) = {${config.columns.map((_, k) => `lb_fin_audit_trampoline${k}`).join(", ")}};
static struct record *record;
static char root[PATH_MAX];
static size_t root_length;

/* Count one entry in the mapped record, then tail-jump to the captured definition. Only %r11, which no
   x86_64 SysV call passes arguments in, and the flags change; argument registers, %al for variadic calls,
   the stack and the callee's returns are untouched. */
__asm__(".text\\n"
  ${trampolines}
);

unsigned int la_version(unsigned int version) {
  int major = 0, minor = 0;
  const char *path = getenv("LEAN_BRIDGE_FIN_AUDIT_RECORD"), *nonce = getenv("LEAN_BRIDGE_FIN_AUDIT_NONCE"), *where = getenv("LEAN_BRIDGE_FIN_AUDIT_ROOT");
  /* glibc 2.35 began calling la_symbind64 for BIND_NOW and RTLD_NOW bindings. */
  if (version < 1 || sscanf(gnu_get_libc_version(), "%d.%d", &major, &minor) != 2 || major != 2 || minor < 35) return 0;
  if (!path || !nonce || !where || strlen(nonce) != 32 || strspn(nonce, "0123456789abcdef") != 32 || !realpath(where, root)) return 0;
  root_length = strlen(root);
  /* A fresh record only: an existing file, stale or forged, is never adopted. */
  int fd = open(path, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (fd < 0) return 0;
  void *mapped = ftruncate(fd, sizeof *record) == 0 ? mmap(NULL, sizeof *record, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0) : MAP_FAILED;
  close(fd);
  if (mapped == MAP_FAILED) return 0;
  record = mapped;
  memcpy(record->magic, "${nativeFinAuditRecord.magic}", 8);
  record->version = ${nativeFinAuditRecord.version}; record->columns = COLUMNS;
  memcpy(record->config, config_sha256, 64); memcpy(record->nonce, nonce, 32);
  record->pid = (int64_t)getpid();
  for (int k = 0; k < COLUMNS; ++k) record->definer[k] = -1;
  lb_fin_audit_entries = record->entries;
  __atomic_store_n(&record->attached, 1, __ATOMIC_RELEASE);
  return version < LAV_CURRENT ? version : LAV_CURRENT;
}

/* Audit only the configured libraries directly inside the verified directory; the cookie is the index + 1. */
unsigned int la_objopen(struct link_map *map, Lmid_t lmid, uintptr_t *cookie) {
  char path[PATH_MAX];
  if (!record || lmid != LM_ID_BASE || !map->l_name || !map->l_name[0] || !realpath(map->l_name, path)) return 0;
  const char *slash = strrchr(path, '/');
  if (!slash || (size_t)(slash - path) != root_length || strncmp(path, root, root_length) != 0) return 0;
  for (int i = 0; i < LIBRARIES; ++i)
    if (strcmp(slash + 1, libraries[i]) == 0) { *cookie = (uintptr_t)i + 1; return LA_FLG_BINDTO | LA_FLG_BINDFROM; }
  return 0;
}

uintptr_t la_symbind64(Elf64_Sym *sym, unsigned int index, uintptr_t *refcook, uintptr_t *defcook, unsigned int *flags, const char *name) {
  (void)index; (void)flags;
  int k = 0;
  while (k < COLUMNS && (!name || strcmp(name, names[k]) != 0)) ++k;
  if (!record || k == COLUMNS) return sym->st_value;
  uintptr_t from = *refcook, to = *defcook;
  /* A counted name bound to any other library is reported, never redirected. */
  if (from < 1 || from > LIBRARIES || to < 1 || to > LIBRARIES || (int)to - 1 != definers[k]) {
    __atomic_add_fetch(&record->foreign, 1, __ATOMIC_SEQ_CST);
    return sym->st_value;
  }
  void *target = (void *)sym->st_value, *previous = NULL;
  /* One target per column: a different definition is a conflict and is left uncounted. */
  if (!__atomic_compare_exchange_n(&lb_fin_audit_targets[k], &previous, target, 0, __ATOMIC_SEQ_CST, __ATOMIC_SEQ_CST) && previous != target) {
    __atomic_add_fetch(&record->conflicts, 1, __ATOMIC_SEQ_CST);
    return sym->st_value;
  }
  record->definer[k] = (int32_t)to - 1;
  record->callers[k] |= 1u << (from - 1);
  __atomic_add_fetch(&record->bindings[k], 1, __ATOMIC_SEQ_CST);
  __atomic_or_fetch(&record->redirected, 1u << k, __ATOMIC_SEQ_CST);
  return (uintptr_t)trampolines[k];
}
`;
};

/**
 * Parse a mapped record's exact bytes.
 *
 * @param bytes - The complete record file.
 */
export const readNativeFinAuditRecord = bytes => {
	if(!Buffer.isBuffer(bytes) || bytes.length !== nativeFinAuditRecord.size) throw new TypeError("audit record has the wrong size");
	const ascii = (start, length) => bytes.toString("latin1", start, start + length);
	const words = (start, size, read) => Array.from({ length: 6 }, (_, k) => read(start + size * k));
	const u32 = offset => bytes.readUInt32LE(offset), u64 = offset => Number(bytes.readBigUInt64LE(offset));
	return {
		magic: ascii(0, 8)
		, version: u32(8)
		, columns: u32(12)
		, config: ascii(16, 64)
		, nonce: ascii(80, 32)
		, pid: Number(bytes.readBigInt64LE(112))
		, attached: u32(120)
		, redirected: u32(124)
		, conflicts: u32(128)
		, foreign: u32(132)
		, bindings: words(136, 8, u64)
		, definers: words(184, 4, offset => bytes.readInt32LE(offset))
		, callers: words(208, 4, u32)
		, entries: words(232, 8, u64)
	};
};
