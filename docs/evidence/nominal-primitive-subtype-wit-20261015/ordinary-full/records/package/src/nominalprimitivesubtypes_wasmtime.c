#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif
#include <dlfcn.h>
#include <link.h>

#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

typedef struct {
  uint32_t words[8];
  uint64_t bytes;
  size_t used;
  unsigned char block[64];
} lb_receipt_hash;

static uint32_t lb_receipt_rotr(uint32_t x, unsigned n) {
  return (x >> n) | (x << (32u - n));
}
static void lb_receipt_block(lb_receipt_hash *hash, const unsigned char *block) {
  static const uint32_t constants[64] = {
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  };
  uint32_t w[64];
  for (size_t i = 0; i < 16; ++i)
    w[i] = ((uint32_t)block[4*i] << 24) | ((uint32_t)block[4*i+1] << 16)
      | ((uint32_t)block[4*i+2] << 8) | block[4*i+3];
  for (size_t i = 16; i < 64; ++i) {
    uint32_t x = w[i-15], y = w[i-2];
    w[i] = w[i-16] + (lb_receipt_rotr(x,7) ^ lb_receipt_rotr(x,18) ^ (x >> 3))
      + w[i-7] + (lb_receipt_rotr(y,17) ^ lb_receipt_rotr(y,19) ^ (y >> 10));
  }
  uint32_t a=hash->words[0], b=hash->words[1], c=hash->words[2], d=hash->words[3];
  uint32_t e=hash->words[4], f=hash->words[5], g=hash->words[6], h=hash->words[7];
  for (size_t i = 0; i < 64; ++i) {
    uint32_t t1 = h + (lb_receipt_rotr(e,6) ^ lb_receipt_rotr(e,11) ^ lb_receipt_rotr(e,25))
      + ((e & f) ^ (~e & g)) + constants[i] + w[i];
    uint32_t t2 = (lb_receipt_rotr(a,2) ^ lb_receipt_rotr(a,13) ^ lb_receipt_rotr(a,22))
      + ((a & b) ^ (a & c) ^ (b & c));
    h=g; g=f; f=e; e=d+t1; d=c; c=b; b=a; a=t1+t2;
  }
  hash->words[0]+=a; hash->words[1]+=b; hash->words[2]+=c; hash->words[3]+=d;
  hash->words[4]+=e; hash->words[5]+=f; hash->words[6]+=g; hash->words[7]+=h;
}
static void lb_receipt_update(lb_receipt_hash *hash, const unsigned char *bytes, size_t count) {
  hash->bytes += count;
  while (count) {
    size_t take = 64 - hash->used;
    if (take > count) take = count;
    memcpy(hash->block + hash->used, bytes, take);
    hash->used += take; bytes += take; count -= take;
    if (hash->used == 64) { lb_receipt_block(hash, hash->block); hash->used = 0; }
  }
}
static void lb_receipt_finish(lb_receipt_hash *hash, char out[65]) {
  static const char hex[] = "0123456789abcdef";
  uint64_t bits = hash->bytes * UINT64_C(8);
  unsigned char padding[128] = {0x80};
  size_t count = hash->used < 56 ? 56 - hash->used : 120 - hash->used;
  for (size_t i = 0; i < 8; ++i) padding[count+i] = (unsigned char)(bits >> (56-8*i));
  lb_receipt_update(hash, padding, count + 8);
  for (size_t i = 0; i < 32; ++i) {
    unsigned byte = (hash->words[i/4] >> (24-8*(i%4))) & 255u;
    out[2*i] = hex[byte >> 4]; out[2*i+1] = hex[byte & 15];
  }
  out[64] = 0;
}
static int lb_receipt_file_matches(const char *path, uint64_t bytes, const char *expected) {
  int fd = open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW | O_NONBLOCK);
  if (fd < 0) return 0;
  struct stat before, after;
  int valid = !fstat(fd, &before) && S_ISREG(before.st_mode) && before.st_size >= 0
    && (uint64_t)before.st_size == bytes && bytes <= UINT64_MAX/8;
  lb_receipt_hash hash = {.words = {0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19}};
  unsigned char buffer[16384];
  while (valid) {
    ssize_t count = read(fd, buffer, sizeof(buffer));
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) { valid = 0; break; }
    if (!count) break;
    if ((uint64_t)count > bytes - hash.bytes) { valid = 0; break; }
    lb_receipt_update(&hash, buffer, (size_t)count);
  }
  valid = valid && hash.bytes == bytes && !fstat(fd, &after)
    && before.st_size == after.st_size
    && before.st_mtim.tv_sec == after.st_mtim.tv_sec && before.st_mtim.tv_nsec == after.st_mtim.tv_nsec
    && before.st_ctim.tv_sec == after.st_ctim.tv_sec && before.st_ctim.tv_nsec == after.st_ctim.tv_nsec;
  if (close(fd)) valid = 0;
  char actual[65]; lb_receipt_finish(&hash, actual);
  return valid && !strcmp(actual, expected);
}


static pid_t lb_package_pid;
/* Private loader handshake, not a consumer API. Keep each host's origin local
 * even when another host exports the same handshake symbol. */
__attribute__((visibility("default"))) pid_t __lean_bridge_wit_host_process_origin_v1(void) {
  return lb_package_pid;
}
static const char *lb_package_problem = "WIT package dependencies have not been verified";
static const struct { const char *name; uint64_t bytes; const char *sha256; } lb_package_libraries[] = {
  {"libcomponent_19ad06f04a0c2d39db76.so", UINT64_C(387344), "58a916198cb50e5bb7fab57554591812a8381960749e100c43effecedd0a3672"},
  {"liblean_bridge_native.so", UINT64_C(21464), "25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7"},
  {"libleanshared.so", UINT64_C(158401256), "d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4"},
  {"libnominalprimitivesubtypes.so", UINT64_C(188288), "eb46ccf3accce434eca3d3071099d945d515ec305901040e05ec3e44264dd4f0"},
  {"libwasmtime.so", UINT64_C(22277728), "566e57cfeabafd6d44fab1b5e6660b4569a71aae4cff2e4d89563a424ee799f3"}
};
typedef struct { unsigned seen[5]; const char *failure; } lb_package_scan;
static int lb_package_process(struct dl_phdr_info *info, size_t size, void *data) {
  (void)size;
  lb_package_scan *scan = data;
  const char *path = info->dlpi_name;
  if (!path || !*path) return 0;
  const char *slash = strrchr(path, '/'), *name = slash ? slash+1 : path;
  const char suffix[] = "_wasmtime.so";
  size_t length = strlen(name);
  if (length <= 3 + sizeof(suffix)-1 || strncmp(name, "lib", 3)
      || strcmp(name+length-(sizeof(suffix)-1), suffix)) return 0;
  void *loaded = dlopen(path, RTLD_NOW | RTLD_NOLOAD);
  if (!loaded) { scan->failure = "Cannot inspect loaded WIT host"; return 1; }
  void *address = dlsym(loaded, "__lean_bridge_wit_host_process_origin_v1");
  Dl_info owner;
  /* dlsym also searches dependencies. Only use this library's own marker. */
  if (address && dladdr(address, &owner) && owner.dli_fbase == (void *)info->dlpi_addr) {
    pid_t (*origin)(void);
    _Static_assert(sizeof(origin) == sizeof(address), "POSIX function pointer");
    memcpy(&origin, &address, sizeof(origin));
    pid_t process = origin();
    /* A host whose constructor has not run yet has no Wasmtime state. */
    if (process && process != getpid())
      scan->failure = "WIT hosts cannot be used after fork; exec a fresh process";
  }
  dlclose(loaded);
  return scan->failure != NULL;
}
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
  dl_iterate_phdr(lb_package_process, &scan);
  if (!scan.failure) dl_iterate_phdr(lb_package_library, &scan);
  for (size_t i = 0; i < sizeof(scan.seen)/sizeof(scan.seen[0]); ++i)
    if (!scan.seen[i] && !scan.failure) scan.failure = "WIT package dependency is missing from the loaded libraries";
  lb_package_problem = scan.failure;
}
static const char *lb_package_failure(void) {
  if (getpid() != lb_package_pid) return "WIT hosts cannot be used after fork; exec a fresh process";
  return lb_package_problem;
}
#include "nominalprimitivesubtypes_wasmtime.h"
#include "nominalprimitivesubtypes.h"
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(sizeof(bool) == 1, "WIT bool validation requires a one-byte representation");
typedef struct lb_allocation { struct lb_allocation *next; } lb_allocation;
typedef struct { size_t remaining; lb_allocation *allocations; } lb_scope;
/* Native callers still own valid backing storage; this checks shape, alignment
 * and address arithmetic, not the allocation extent of an arbitrary pointer. */
static inline bool lb_buffer(const void *data, size_t count, size_t width, size_t alignment) {
  if (!count) return true;
  if (!data || !width || !alignment || (uintptr_t)data % alignment || count > SIZE_MAX / width) return false;
  return count * width <= UINTPTR_MAX - (uintptr_t)data;
}
static inline bool lb_boolean(const void *data, bool *out) {
  uint8_t raw; memcpy(&raw, data, sizeof(raw));
  if (raw > 1) return false;
  *out = raw != 0; return true;
}
static inline bool lb_charge(lb_scope *scope, size_t count, size_t width) {
  if (count && width > scope->remaining / count) return false;
  scope->remaining -= count * width; return true;
}
static inline void *lb_alloc(lb_scope *scope, size_t count, size_t width) {
  if (!count) return NULL;
  if (width > (SIZE_MAX - sizeof(lb_allocation)) / count) return NULL;
  lb_allocation *allocation = calloc(1, sizeof(*allocation) + count * width);
  if (!allocation) return NULL;
  allocation->next = scope->allocations; scope->allocations = allocation;
  return allocation + 1;
}
static inline void lb_scope_close(lb_scope *scope) {
  while (scope->allocations) { lb_allocation *next = scope->allocations->next; free(scope->allocations); scope->allocations = next; }
}
static inline bool lb_name(const wasm_name_t *name, const char *expected) {
  size_t length = strlen(expected);
  return name->size == length && lb_buffer(name->data, length, 1, 1) && (!length || memcmp(name->data, expected, length) == 0);
}
static inline bool lb_utf8(const char *text, size_t length) {
  const uint8_t *p = (const uint8_t *)text;
  if (!lb_buffer(p, length, 1, 1)) return false;
  for (size_t i = 0; i < length;) {
    uint32_t c = p[i++]; size_t extra = 0; uint32_t minimum = 0;
    if (c < 0x80) continue;
    if (c >= 0xc2 && c <= 0xdf) { extra = 1; minimum = 0x80; c &= 0x1f; }
    else if (c >= 0xe0 && c <= 0xef) { extra = 2; minimum = 0x800; c &= 0x0f; }
    else if (c >= 0xf0 && c <= 0xf4) { extra = 3; minimum = 0x10000; c &= 7; }
    else return false;
    if (extra > length - i) return false;
    while (extra--) { uint8_t b = p[i++]; if ((b & 0xc0) != 0x80) return false; c = (c << 6) | (b & 0x3f); }
    if (c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return false;
  }
  return true;
}
static inline bool lb_limbs_in(const wasmtime_component_val_t *value, lb_scope *scope, uint32_t **out, size_t *length) {
  if (value->kind != WASMTIME_COMPONENT_LIST) return false;
  size_t count = value->of.list.size;
  if (!lb_buffer(value->of.list.data, count, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, count, sizeof(wasmtime_component_val_t) + sizeof(uint32_t))) return false;
  for (size_t i = 0; i < count; ++i) if (value->of.list.data[i].kind != WASMTIME_COMPONENT_U32) return false;
  if (count && value->of.list.data[count - 1].of.u32 == 0) return false;
  if (out) {
    *out = lb_alloc(scope, count, sizeof(uint32_t)); if (count && !*out) return false;
    for (size_t i = 0; i < count; ++i) (*out)[i] = value->of.list.data[i].of.u32;
    *length = count;
  }
  return true;
}
static inline bool lb_limbs_out(const uint32_t *data, size_t length, lb_scope *scope, wasmtime_component_val_t *out) {
  if (!lb_buffer(data, length, sizeof(uint32_t), _Alignof(uint32_t)) || !lb_charge(scope, length, sizeof(wasmtime_component_val_t))) return false;
  if (length && (!data || !data[length - 1])) return false;
  out->kind = WASMTIME_COMPONENT_LIST;
  wasmtime_component_vallist_new_uninit(&out->of.list, length);
  for (size_t i = 0; i < length; ++i) out->of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U32, .of.u32 = data[i]};
  return true;
}

static inline bool lb_in_0(const wasmtime_component_val_t *value, lb_scope *scope, uint8_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint8_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_ENUM || !lb_name(&value->of.enumeration, "unit")) return false;
  if (out) *out = 0;
  return true;
}
static inline bool lb_out_0(const uint8_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint8_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (*value) return false;
  out->kind = WASMTIME_COMPONENT_ENUM; wasm_name_new(&out->of.enumeration, 4, "unit");
  return true;
}

static inline bool lb_in_1(const wasmtime_component_val_t *value, lb_scope *scope, bool *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(bool))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_BOOL) return false;
  bool boolean; if (!lb_boolean(&value->of.boolean, &boolean)) return false;
  if (out) *out = boolean;
  return true;
}
static inline bool lb_out_1(const bool *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(bool)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  bool boolean; if (!lb_boolean(value, &boolean)) return false;
  out->kind = WASMTIME_COMPONENT_BOOL; out->of.boolean = boolean;
  return true;
}

static inline bool lb_in_2(const wasmtime_component_val_t *value, lb_scope *scope, uint8_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint8_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_U8) return false;
  if (out) *out = value->of.u8;
  return true;
}
static inline bool lb_out_2(const uint8_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint8_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_U8; out->of.u8 = *value;
  return true;
}

static inline bool lb_in_3(const wasmtime_component_val_t *value, lb_scope *scope, uint16_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint16_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_U16) return false;
  if (out) *out = value->of.u16;
  return true;
}
static inline bool lb_out_3(const uint16_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint16_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_U16; out->of.u16 = *value;
  return true;
}

static inline bool lb_in_4(const wasmtime_component_val_t *value, lb_scope *scope, uint32_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint32_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_U32) return false;
  if (out) *out = value->of.u32;
  return true;
}
static inline bool lb_out_4(const uint32_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint32_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_U32; out->of.u32 = *value;
  return true;
}

static inline bool lb_in_5(const wasmtime_component_val_t *value, lb_scope *scope, uint64_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint64_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_U64) return false;
  if (out) *out = value->of.u64;
  return true;
}
static inline bool lb_out_5(const uint64_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint64_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_U64; out->of.u64 = *value;
  return true;
}

static inline bool lb_in_6(const wasmtime_component_val_t *value, lb_scope *scope, int8_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(int8_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_S8) return false;
  if (out) *out = value->of.s8;
  return true;
}
static inline bool lb_out_6(const int8_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(int8_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_S8; out->of.s8 = *value;
  return true;
}

static inline bool lb_in_7(const wasmtime_component_val_t *value, lb_scope *scope, int16_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(int16_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_S16) return false;
  if (out) *out = value->of.s16;
  return true;
}
static inline bool lb_out_7(const int16_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(int16_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_S16; out->of.s16 = *value;
  return true;
}

static inline bool lb_in_8(const wasmtime_component_val_t *value, lb_scope *scope, int32_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(int32_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_S32) return false;
  if (out) *out = value->of.s32;
  return true;
}
static inline bool lb_out_8(const int32_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(int32_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_S32; out->of.s32 = *value;
  return true;
}

static inline bool lb_in_9(const wasmtime_component_val_t *value, lb_scope *scope, int64_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(int64_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_S64) return false;
  if (out) *out = value->of.s64;
  return true;
}
static inline bool lb_out_9(const int64_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(int64_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_S64; out->of.s64 = *value;
  return true;
}

static inline bool lb_in_10(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_nat *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_nat))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  uint32_t *limbs = NULL; size_t length = 0;
  if (!lb_limbs_in(value, scope, out ? &limbs : NULL, &length)) return false;
  if (out) *out = (nominalprimitivesubtypes_nat){.data = limbs, .length = length};
  return true;
}
static inline bool lb_out_10(const nominalprimitivesubtypes_nat *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_nat)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  return lb_limbs_out(value->data, value->length, scope, out);
  return true;
}

static inline bool lb_in_11(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_int *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_int))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 2 || !lb_buffer(value->of.record.data, 2, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t)) || !lb_name(&value->of.record.data[0].name, "negative") || !lb_name(&value->of.record.data[1].name, "limbs") || value->of.record.data[0].val.kind != WASMTIME_COMPONENT_BOOL) return false;
  bool negative; if (!lb_boolean(&value->of.record.data[0].val.of.boolean, &negative)) return false;
  value = &value->of.record.data[1].val;
  if (negative && value->kind == WASMTIME_COMPONENT_LIST && !value->of.list.size) return false;
  uint32_t *limbs = NULL; size_t length = 0;
  if (!lb_limbs_in(value, scope, out ? &limbs : NULL, &length)) return false;
  if (out) *out = (nominalprimitivesubtypes_int){.data = limbs, .length = length, .negative = negative};
  return true;
}
static inline bool lb_out_11(const nominalprimitivesubtypes_int *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_int)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  bool negative; if (!lb_boolean(&value->negative, &negative) || (negative && !value->length)) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 2);
  memset(out->of.record.data, 0, 2 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 8, "negative"); wasm_name_new(&out->of.record.data[1].name, 5, "limbs");
  out->of.record.data[0].val = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_BOOL, .of.boolean = negative};
  return lb_limbs_out(value->data, value->length, scope, &out->of.record.data[1].val);
  return true;
}

static inline bool lb_in_12(const wasmtime_component_val_t *value, lb_scope *scope, float *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(float))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_F32) return false;
  if (out) *out = value->of.f32;
  return true;
}
static inline bool lb_out_12(const float *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(float)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_F32; out->of.f32 = *value;
  return true;
}

static inline bool lb_in_13(const wasmtime_component_val_t *value, lb_scope *scope, double *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(double))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_F64) return false;
  if (out) *out = value->of.f64;
  return true;
}
static inline bool lb_out_13(const double *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(double)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_F64; out->of.f64 = *value;
  return true;
}

static inline bool lb_in_14(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_string *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_string))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_STRING || !lb_charge(scope, value->of.string.size, 1) || !lb_utf8(value->of.string.data, value->of.string.size)) return false;
  if (out) *out = (nominalprimitivesubtypes_string){.data = value->of.string.data, .length = value->of.string.size};
  return true;
}
static inline bool lb_out_14(const nominalprimitivesubtypes_string *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_string)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, value->length, 1) || !lb_utf8(value->data, value->length)) return false;
  out->kind = WASMTIME_COMPONENT_STRING; wasm_name_new(&out->of.string, value->length, value->data);
  return true;
}

static inline bool lb_in_15(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_bytes *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_bytes))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(uint8_t))) return false;
  uint8_t *items = out ? lb_alloc(scope, value->of.list.size, sizeof(uint8_t)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (value->of.list.data[i].kind != WASMTIME_COMPONENT_U8) return false;
    if (out) items[i] = value->of.list.data[i].of.u8;
  }
  if (out) *out = (nominalprimitivesubtypes_bytes){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_15(const nominalprimitivesubtypes_bytes *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_bytes)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(uint8_t), _Alignof(uint8_t)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    out->of.list.data[i] = (wasmtime_component_val_t){.kind = WASMTIME_COMPONENT_U8, .of.u8 = value->data[i]};
  }
  return true;
}

static inline bool lb_in_16(const wasmtime_component_val_t *value, lb_scope *scope, uint32_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint32_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_CHAR) return false;
  if (value->of.character > 0x10ffff || (value->of.character >= 0xd800 && value->of.character <= 0xdfff)) return false;
  if (out) *out = value->of.character;
  return true;
}
static inline bool lb_out_16(const uint32_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint32_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (*value > 0x10ffff || (*value >= 0xd800 && *value <= 0xdfff)) return false;
  out->kind = WASMTIME_COMPONENT_CHAR; out->of.character = *value;
  return true;
}

static inline bool lb_in_17(const wasmtime_component_val_t *value, lb_scope *scope, uint64_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(uint64_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_U64) return false;
  if (out) *out = value->of.u64;
  return true;
}
static inline bool lb_out_17(const uint64_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(uint64_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_U64; out->of.u64 = *value;
  return true;
}

static inline bool lb_in_18(const wasmtime_component_val_t *value, lb_scope *scope, int64_t *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(int64_t))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_S64) return false;
  if (out) *out = value->of.s64;
  return true;
}
static inline bool lb_out_18(const int64_t *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(int64_t)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_S64; out->of.s64 = *value;
  return true;
}

static inline bool lb_in_19(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_packet *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_packet))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 20 || !lb_buffer(value->of.record.data, 20, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
  if (!lb_name(&value->of.record.data[0].name, "unit-value") || !lb_in_0(&value->of.record.data[0].val, scope, out ? &out->unit_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[1].name, "bool-value") || !lb_in_1(&value->of.record.data[1].val, scope, out ? &out->bool_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[2].name, "uint8-value") || !lb_in_2(&value->of.record.data[2].val, scope, out ? &out->uint8_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[3].name, "uint16-value") || !lb_in_3(&value->of.record.data[3].val, scope, out ? &out->uint16_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[4].name, "uint32-value") || !lb_in_4(&value->of.record.data[4].val, scope, out ? &out->uint32_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[5].name, "uint64-value") || !lb_in_5(&value->of.record.data[5].val, scope, out ? &out->uint64_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[6].name, "int8-value") || !lb_in_6(&value->of.record.data[6].val, scope, out ? &out->int8_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[7].name, "int16-value") || !lb_in_7(&value->of.record.data[7].val, scope, out ? &out->int16_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[8].name, "int32-value") || !lb_in_8(&value->of.record.data[8].val, scope, out ? &out->int32_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[9].name, "int64-value") || !lb_in_9(&value->of.record.data[9].val, scope, out ? &out->int64_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[10].name, "nat-value") || !lb_in_10(&value->of.record.data[10].val, scope, out ? &out->nat_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[11].name, "int-value") || !lb_in_11(&value->of.record.data[11].val, scope, out ? &out->int_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[12].name, "float32-value") || !lb_in_12(&value->of.record.data[12].val, scope, out ? &out->float32_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[13].name, "float64-value") || !lb_in_13(&value->of.record.data[13].val, scope, out ? &out->float64_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[14].name, "text-value") || !lb_in_14(&value->of.record.data[14].val, scope, out ? &out->text_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[15].name, "bytes-value") || !lb_in_15(&value->of.record.data[15].val, scope, out ? &out->bytes_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[16].name, "char-value") || !lb_in_16(&value->of.record.data[16].val, scope, out ? &out->char_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[17].name, "usize-value") || !lb_in_17(&value->of.record.data[17].val, scope, out ? &out->usize_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[18].name, "isize-value") || !lb_in_18(&value->of.record.data[18].val, scope, out ? &out->isize_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[19].name, "digit") || !lb_in_10(&value->of.record.data[19].val, scope, out ? &out->digit : NULL)) return false;
  return true;
}
static inline bool lb_out_19(const nominalprimitivesubtypes_packet *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_packet)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, 20, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 20);
  memset(out->of.record.data, 0, 20 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 10, "unit-value");
  if (!lb_out_0(&value->unit_value, scope, &out->of.record.data[0].val)) return false;
  wasm_name_new(&out->of.record.data[1].name, 10, "bool-value");
  if (!lb_out_1(&value->bool_value, scope, &out->of.record.data[1].val)) return false;
  wasm_name_new(&out->of.record.data[2].name, 11, "uint8-value");
  if (!lb_out_2(&value->uint8_value, scope, &out->of.record.data[2].val)) return false;
  wasm_name_new(&out->of.record.data[3].name, 12, "uint16-value");
  if (!lb_out_3(&value->uint16_value, scope, &out->of.record.data[3].val)) return false;
  wasm_name_new(&out->of.record.data[4].name, 12, "uint32-value");
  if (!lb_out_4(&value->uint32_value, scope, &out->of.record.data[4].val)) return false;
  wasm_name_new(&out->of.record.data[5].name, 12, "uint64-value");
  if (!lb_out_5(&value->uint64_value, scope, &out->of.record.data[5].val)) return false;
  wasm_name_new(&out->of.record.data[6].name, 10, "int8-value");
  if (!lb_out_6(&value->int8_value, scope, &out->of.record.data[6].val)) return false;
  wasm_name_new(&out->of.record.data[7].name, 11, "int16-value");
  if (!lb_out_7(&value->int16_value, scope, &out->of.record.data[7].val)) return false;
  wasm_name_new(&out->of.record.data[8].name, 11, "int32-value");
  if (!lb_out_8(&value->int32_value, scope, &out->of.record.data[8].val)) return false;
  wasm_name_new(&out->of.record.data[9].name, 11, "int64-value");
  if (!lb_out_9(&value->int64_value, scope, &out->of.record.data[9].val)) return false;
  wasm_name_new(&out->of.record.data[10].name, 9, "nat-value");
  if (!lb_out_10(&value->nat_value, scope, &out->of.record.data[10].val)) return false;
  wasm_name_new(&out->of.record.data[11].name, 9, "int-value");
  if (!lb_out_11(&value->int_value, scope, &out->of.record.data[11].val)) return false;
  wasm_name_new(&out->of.record.data[12].name, 13, "float32-value");
  if (!lb_out_12(&value->float32_value, scope, &out->of.record.data[12].val)) return false;
  wasm_name_new(&out->of.record.data[13].name, 13, "float64-value");
  if (!lb_out_13(&value->float64_value, scope, &out->of.record.data[13].val)) return false;
  wasm_name_new(&out->of.record.data[14].name, 10, "text-value");
  if (!lb_out_14(&value->text_value, scope, &out->of.record.data[14].val)) return false;
  wasm_name_new(&out->of.record.data[15].name, 11, "bytes-value");
  if (!lb_out_15(&value->bytes_value, scope, &out->of.record.data[15].val)) return false;
  wasm_name_new(&out->of.record.data[16].name, 10, "char-value");
  if (!lb_out_16(&value->char_value, scope, &out->of.record.data[16].val)) return false;
  wasm_name_new(&out->of.record.data[17].name, 11, "usize-value");
  if (!lb_out_17(&value->usize_value, scope, &out->of.record.data[17].val)) return false;
  wasm_name_new(&out->of.record.data[18].name, 11, "isize-value");
  if (!lb_out_18(&value->isize_value, scope, &out->of.record.data[18].val)) return false;
  wasm_name_new(&out->of.record.data[19].name, 5, "digit");
  if (!lb_out_10(&value->digit, scope, &out->of.record.data[19].val)) return false;
  return true;
}

static inline bool lb_in_20(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  if (out) out->has_value = value->of.option != NULL;
  if (value->of.option && !lb_in_19(value->of.option, scope, out ? &out->value : NULL)) return false;
  return true;
}
static inline bool lb_out_20(const nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION; out->of.option = NULL;
  if (value->has_value) {
    wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
    if (!lb_out_19(&value->value, scope, out->of.option)) return false;
  }
  return true;
}

static inline bool lb_in_21(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value))) return false;
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value *items = out ? lb_alloc(scope, value->of.list.size, sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_20(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_21(const nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value), _Alignof(nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_20(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
  return true;
}

static inline bool lb_in_22(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_TUPLE || value->of.tuple.size != 2 || !lb_buffer(value->of.tuple.data, 2, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t))) return false;
  if (!lb_in_19(&value->of.tuple.data[0], scope, out ? &out->fst : NULL)) return false;
  if (!lb_in_19(&value->of.tuple.data[1], scope, out ? &out->snd : NULL)) return false;
  return true;
}
static inline bool lb_out_22(const nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_TUPLE; wasmtime_component_valtuple_new_uninit(&out->of.tuple, 2);
  memset(out->of.tuple.data, 0, 2 * sizeof(*out->of.tuple.data));
  if (!lb_out_19(&value->fst, scope, &out->of.tuple.data[0])) return false;
  if (!lb_out_19(&value->snd, scope, &out->of.tuple.data[1])) return false;
  return true;
}

static inline bool lb_in_23(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RESULT || !value->of.result.val) return false;
  bool is_ok; if (!lb_boolean(&value->of.result.is_ok, &is_ok)) return false;
  if (out) out->is_ok = is_ok;
  if (is_ok) { if (!lb_in_19(value->of.result.val, scope, out ? &out->ok : NULL)) return false; }
  else if (!lb_in_19(value->of.result.val, scope, out ? &out->error : NULL)) return false;
  return true;
}
static inline bool lb_out_23(const nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->is_ok > 1) return false;
  out->kind = WASMTIME_COMPONENT_RESULT; out->of.result.is_ok = value->is_ok;
  wasmtime_component_val_t empty = {0}; out->of.result.val = wasmtime_component_val_new(&empty);
  if (value->is_ok) { if (!lb_out_19(&value->ok, scope, out->of.result.val)) return false; }
  else if (!lb_out_19(&value->error, scope, out->of.result.val)) return false;
  return true;
}

static inline bool lb_in_24(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_OPTION) return false;
  if (out) out->has_value = value->of.option != NULL;
  if (value->of.option && !lb_in_23(value->of.option, scope, out ? &out->value : NULL)) return false;
  return true;
}
static inline bool lb_out_24(const nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->has_value > 1) return false;
  out->kind = WASMTIME_COMPONENT_OPTION; out->of.option = NULL;
  if (value->has_value) {
    wasmtime_component_val_t empty = {0}; out->of.option = wasmtime_component_val_new(&empty);
    if (!lb_out_23(&value->value, scope, out->of.option)) return false;
  }
  return true;
}

static inline bool lb_in_25(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_LIST || !lb_buffer(value->of.list.data, value->of.list.size, sizeof(wasmtime_component_val_t), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, value->of.list.size, sizeof(wasmtime_component_val_t) + sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value))) return false;
  nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value *items = out ? lb_alloc(scope, value->of.list.size, sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value)) : NULL;
  if (out && value->of.list.size && !items) return false;
  for (size_t i = 0; i < value->of.list.size; ++i) {
    if (!lb_in_24(&value->of.list.data[i], scope, out ? &items[i] : NULL)) return false;
  }
  if (out) *out = (nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span){.data = items, .length = value->of.list.size};
  return true;
}
static inline bool lb_out_25(const nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_array_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_span)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_buffer(value->data, value->length, sizeof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value), _Alignof(nominalprimitivesubtypes_option_result_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value)) || !lb_charge(scope, value->length, sizeof(wasmtime_component_val_t))) return false;
  out->kind = WASMTIME_COMPONENT_LIST; wasmtime_component_vallist_new_uninit(&out->of.list, value->length);
  if (value->length) memset(out->of.list.data, 0, value->length * sizeof(*out->of.list.data));
  for (size_t i = 0; i < value->length; ++i) {
    if (!lb_out_24(&value->data[i], scope, &out->of.list.data[i])) return false;
  }
  return true;
}

static inline bool lb_in_26(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_event *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_event))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_VARIANT) return false;
  if (lb_name(&value->of.variant.discriminant, "empty")) {
    if (value->of.variant.val) return false;
    if (out) out->kind = 0;
  }
  else if (lb_name(&value->of.variant.discriminant, "box")) {
    const wasmtime_component_val_t *payload = value->of.variant.val;
    if (!lb_buffer(payload, 1, sizeof(*payload), _Alignof(wasmtime_component_val_t)) || payload->kind != WASMTIME_COMPONENT_RECORD || payload->of.record.size != 1 || !lb_buffer(payload->of.record.data, 1, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    if (out) out->kind = 1;
    if (!lb_name(&payload->of.record.data[0].name, "value") || !lb_in_19(&payload->of.record.data[0].val, scope, out ? &out->cases.box.value : NULL)) return false;
  }
  else if (lb_name(&value->of.variant.discriminant, "choices")) {
    const wasmtime_component_val_t *payload = value->of.variant.val;
    if (!lb_buffer(payload, 1, sizeof(*payload), _Alignof(wasmtime_component_val_t)) || payload->kind != WASMTIME_COMPONENT_RECORD || payload->of.record.size != 1 || !lb_buffer(payload->of.record.data, 1, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    if (out) out->kind = 2;
    if (!lb_name(&payload->of.record.data[0].name, "values") || !lb_in_25(&payload->of.record.data[0].val, scope, out ? &out->cases.choices.values : NULL)) return false;
  }
  else return false;
  return true;
}
static inline bool lb_out_26(const nominalprimitivesubtypes_event *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_event)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind >= 3) return false;
  out->kind = WASMTIME_COMPONENT_VARIANT; out->of.variant = (wasmtime_component_valvariant_t){0};
  switch (value->kind) {
  case 0: {
    wasm_name_new(&out->of.variant.discriminant, 5, "empty");
    break;
  }
  case 1: {
    wasm_name_new(&out->of.variant.discriminant, 3, "box");
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);
    wasmtime_component_val_t *payload = out->of.variant.val; payload->kind = WASMTIME_COMPONENT_RECORD;
    wasmtime_component_valrecord_new_uninit(&payload->of.record, 1);
    memset(payload->of.record.data, 0, 1 * sizeof(*payload->of.record.data));
    wasm_name_new(&payload->of.record.data[0].name, 5, "value");
    if (!lb_out_19(&value->cases.box.value, scope, &payload->of.record.data[0].val)) return false;
    break;
  }
  case 2: {
    wasm_name_new(&out->of.variant.discriminant, 7, "choices");
    if (!lb_charge(scope, 1, sizeof(wasmtime_component_valrecord_entry_t))) return false;
    wasmtime_component_val_t empty = {0}; out->of.variant.val = wasmtime_component_val_new(&empty);
    wasmtime_component_val_t *payload = out->of.variant.val; payload->kind = WASMTIME_COMPONENT_RECORD;
    wasmtime_component_valrecord_new_uninit(&payload->of.record, 1);
    memset(payload->of.record.data, 0, 1 * sizeof(*payload->of.record.data));
    wasm_name_new(&payload->of.record.data[0].name, 6, "values");
    if (!lb_out_25(&value->cases.choices.values, scope, &payload->of.record.data[0].val)) return false;
    break;
  }
  }
  return true;
}

static inline bool lb_in_27(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_pair *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_pair))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 2 || !lb_buffer(value->of.record.data, 2, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
  if (!lb_name(&value->of.record.data[0].name, "left") || !lb_in_21(&value->of.record.data[0].val, scope, out ? &out->left : NULL)) return false;
  if (!lb_name(&value->of.record.data[1].name, "right") || !lb_in_21(&value->of.record.data[1].val, scope, out ? &out->right : NULL)) return false;
  return true;
}
static inline bool lb_out_27(const nominalprimitivesubtypes_pair *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_pair)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, 2, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 2);
  memset(out->of.record.data, 0, 2 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 4, "left");
  if (!lb_out_21(&value->left, scope, &out->of.record.data[0].val)) return false;
  wasm_name_new(&out->of.record.data[1].name, 5, "right");
  if (!lb_out_21(&value->right, scope, &out->of.record.data[1].val)) return false;
  return true;
}

static inline bool lb_in_28(const wasmtime_component_val_t *value, lb_scope *scope, nominalprimitivesubtypes_raw_packet *out) {
  (void)out;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(wasmtime_component_val_t)) || (out && !lb_buffer(out, 1, sizeof(*out), _Alignof(nominalprimitivesubtypes_raw_packet))) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (value->kind != WASMTIME_COMPONENT_RECORD || value->of.record.size != 20 || !lb_buffer(value->of.record.data, 20, sizeof(wasmtime_component_valrecord_entry_t), _Alignof(wasmtime_component_valrecord_entry_t))) return false;
  if (!lb_name(&value->of.record.data[0].name, "unit-value") || !lb_in_0(&value->of.record.data[0].val, scope, out ? &out->unit_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[1].name, "bool-value") || !lb_in_1(&value->of.record.data[1].val, scope, out ? &out->bool_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[2].name, "uint8-value") || !lb_in_2(&value->of.record.data[2].val, scope, out ? &out->uint8_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[3].name, "uint16-value") || !lb_in_3(&value->of.record.data[3].val, scope, out ? &out->uint16_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[4].name, "uint32-value") || !lb_in_4(&value->of.record.data[4].val, scope, out ? &out->uint32_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[5].name, "uint64-value") || !lb_in_5(&value->of.record.data[5].val, scope, out ? &out->uint64_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[6].name, "int8-value") || !lb_in_6(&value->of.record.data[6].val, scope, out ? &out->int8_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[7].name, "int16-value") || !lb_in_7(&value->of.record.data[7].val, scope, out ? &out->int16_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[8].name, "int32-value") || !lb_in_8(&value->of.record.data[8].val, scope, out ? &out->int32_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[9].name, "int64-value") || !lb_in_9(&value->of.record.data[9].val, scope, out ? &out->int64_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[10].name, "nat-value") || !lb_in_10(&value->of.record.data[10].val, scope, out ? &out->nat_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[11].name, "int-value") || !lb_in_11(&value->of.record.data[11].val, scope, out ? &out->int_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[12].name, "float32-value") || !lb_in_12(&value->of.record.data[12].val, scope, out ? &out->float32_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[13].name, "float64-value") || !lb_in_13(&value->of.record.data[13].val, scope, out ? &out->float64_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[14].name, "text-value") || !lb_in_14(&value->of.record.data[14].val, scope, out ? &out->text_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[15].name, "bytes-value") || !lb_in_15(&value->of.record.data[15].val, scope, out ? &out->bytes_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[16].name, "char-value") || !lb_in_16(&value->of.record.data[16].val, scope, out ? &out->char_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[17].name, "usize-value") || !lb_in_17(&value->of.record.data[17].val, scope, out ? &out->usize_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[18].name, "isize-value") || !lb_in_18(&value->of.record.data[18].val, scope, out ? &out->isize_value : NULL)) return false;
  if (!lb_name(&value->of.record.data[19].name, "digit") || !lb_in_10(&value->of.record.data[19].val, scope, out ? &out->digit : NULL)) return false;
  return true;
}
static inline bool lb_out_28(const nominalprimitivesubtypes_raw_packet *value, lb_scope *scope, wasmtime_component_val_t *out) {
  (void)value;
  if (!lb_buffer(value, 1, sizeof(*value), _Alignof(nominalprimitivesubtypes_raw_packet)) || !lb_buffer(out, 1, sizeof(*out), _Alignof(wasmtime_component_val_t)) || !lb_charge(scope, 1, sizeof(wasmtime_component_val_t))) return false;
  if (!lb_charge(scope, 20, sizeof(wasmtime_component_valrecord_entry_t))) return false;
  out->kind = WASMTIME_COMPONENT_RECORD; wasmtime_component_valrecord_new_uninit(&out->of.record, 20);
  memset(out->of.record.data, 0, 20 * sizeof(*out->of.record.data));
  wasm_name_new(&out->of.record.data[0].name, 10, "unit-value");
  if (!lb_out_0(&value->unit_value, scope, &out->of.record.data[0].val)) return false;
  wasm_name_new(&out->of.record.data[1].name, 10, "bool-value");
  if (!lb_out_1(&value->bool_value, scope, &out->of.record.data[1].val)) return false;
  wasm_name_new(&out->of.record.data[2].name, 11, "uint8-value");
  if (!lb_out_2(&value->uint8_value, scope, &out->of.record.data[2].val)) return false;
  wasm_name_new(&out->of.record.data[3].name, 12, "uint16-value");
  if (!lb_out_3(&value->uint16_value, scope, &out->of.record.data[3].val)) return false;
  wasm_name_new(&out->of.record.data[4].name, 12, "uint32-value");
  if (!lb_out_4(&value->uint32_value, scope, &out->of.record.data[4].val)) return false;
  wasm_name_new(&out->of.record.data[5].name, 12, "uint64-value");
  if (!lb_out_5(&value->uint64_value, scope, &out->of.record.data[5].val)) return false;
  wasm_name_new(&out->of.record.data[6].name, 10, "int8-value");
  if (!lb_out_6(&value->int8_value, scope, &out->of.record.data[6].val)) return false;
  wasm_name_new(&out->of.record.data[7].name, 11, "int16-value");
  if (!lb_out_7(&value->int16_value, scope, &out->of.record.data[7].val)) return false;
  wasm_name_new(&out->of.record.data[8].name, 11, "int32-value");
  if (!lb_out_8(&value->int32_value, scope, &out->of.record.data[8].val)) return false;
  wasm_name_new(&out->of.record.data[9].name, 11, "int64-value");
  if (!lb_out_9(&value->int64_value, scope, &out->of.record.data[9].val)) return false;
  wasm_name_new(&out->of.record.data[10].name, 9, "nat-value");
  if (!lb_out_10(&value->nat_value, scope, &out->of.record.data[10].val)) return false;
  wasm_name_new(&out->of.record.data[11].name, 9, "int-value");
  if (!lb_out_11(&value->int_value, scope, &out->of.record.data[11].val)) return false;
  wasm_name_new(&out->of.record.data[12].name, 13, "float32-value");
  if (!lb_out_12(&value->float32_value, scope, &out->of.record.data[12].val)) return false;
  wasm_name_new(&out->of.record.data[13].name, 13, "float64-value");
  if (!lb_out_13(&value->float64_value, scope, &out->of.record.data[13].val)) return false;
  wasm_name_new(&out->of.record.data[14].name, 10, "text-value");
  if (!lb_out_14(&value->text_value, scope, &out->of.record.data[14].val)) return false;
  wasm_name_new(&out->of.record.data[15].name, 11, "bytes-value");
  if (!lb_out_15(&value->bytes_value, scope, &out->of.record.data[15].val)) return false;
  wasm_name_new(&out->of.record.data[16].name, 10, "char-value");
  if (!lb_out_16(&value->char_value, scope, &out->of.record.data[16].val)) return false;
  wasm_name_new(&out->of.record.data[17].name, 11, "usize-value");
  if (!lb_out_17(&value->usize_value, scope, &out->of.record.data[17].val)) return false;
  wasm_name_new(&out->of.record.data[18].name, 11, "isize-value");
  if (!lb_out_18(&value->isize_value, scope, &out->of.record.data[18].val)) return false;
  wasm_name_new(&out->of.record.data[19].name, 5, "digit");
  if (!lb_out_10(&value->digit, scope, &out->of.record.data[19].val)) return false;
  return true;
}
static wasmtime_error_t *lb_call_0(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 2 || result_count != 1 || (2 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span arg0 = {0};
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span arg1 = {0};
  if (!lb_in_21(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (!lb_in_21(&args[1], &scope, &arg1)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_aliases(&arg0, &arg1, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_21(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_1(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 2 || result_count != 1 || (2 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_packet arg0 = {0};
  nominalprimitivesubtypes_packet arg1 = {0};
  if (!lb_in_19(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (!lb_in_19(&args[1], &scope, &arg1)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_combine(&arg0, &arg1, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_22(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_tuple_lean_nominal_primitive_subtypes_packet_lean_nominal_primitive_subtypes_packet_value_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_2(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_packet value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_packet arg0 = {0};
  if (!lb_in_19(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_echo_a(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_19(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_packet_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_3(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_packet value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_packet arg0 = {0};
  if (!lb_in_19(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_echo_b(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_19(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_packet_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_4(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_event arg0 = {0};
  if (!lb_in_26(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_echo_event_a(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_26(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_5(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_event arg0 = {0};
  if (!lb_in_26(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_echo_event_b(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_26(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_6(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_pair value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_pair arg0 = {0};
  if (!lb_in_27(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_echo_pair(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_27(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_pair_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_7(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_raw_packet arg0 = {0};
  if (!lb_in_28(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_produce(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_20(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_option_lean_nominal_primitive_subtypes_packet_value_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_8(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_raw_packet arg0 = {0};
  if (!lb_in_28(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_produce_choices(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_26(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_9(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_event value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_raw_packet arg0 = {0};
  if (!lb_in_28(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_produce_event(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_26(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_event_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_10(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_raw_packet arg0 = {0};
  if (!lb_in_28(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_produce_group(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_21(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_array_option_lean_nominal_primitive_subtypes_packet_span_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_11(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_pair value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_raw_packet arg0 = {0};
  if (!lb_in_28(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_produce_pair(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_27(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_pair_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_12(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 1 || result_count != 1 || (1 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  nominalprimitivesubtypes_packet value = {0};
  wasmtime_component_val_t converted = {0};
  nominalprimitivesubtypes_packet arg0 = {0};
  if (!lb_in_19(&args[0], &scope, &arg0)) { failure = wasmtime_error_new("Invalid copied WIT input, allocation failure or 16 MiB conversion limit"); goto done; }
  if (nominalprimitivesubtypes_refuse_unit(&arg0, &value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_19(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  nominalprimitivesubtypes_packet_clear(&value);
  lb_scope_close(&scope);
  return failure;
}

static wasmtime_error_t *lb_call_13(void *data, wasmtime_context_t *context,
    const wasmtime_component_func_type_t *type, wasmtime_component_val_t *args, size_t count,
    wasmtime_component_val_t *results, size_t result_count) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  (void)data; (void)context; (void)type;
  if (count != 0 || result_count != 1 || (0 && !args) || !results)
    return wasmtime_error_new("WIT import signature mismatch");
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  wasmtime_error_t *failure = NULL;
  nominalprimitivesubtypes_error native_error = {0};
  uint32_t value = {0};
  wasmtime_component_val_t converted = {0};


  if (nominalprimitivesubtypes_word_bits(&value, &native_error) != NOMINALPRIMITIVESUBTYPES_STATUS_OK) {
    failure = wasmtime_error_new(native_error.message ? native_error.message : "Native Lean call failed"); goto done;
  }
  if (!lb_out_4(&value, &scope, &converted)) { failure = wasmtime_error_new("16 MiB WIT result conversion limit"); goto done; }
  results[0] = converted; converted = (wasmtime_component_val_t){0};
done:
  wasmtime_component_val_delete(&converted);
  
  lb_scope_close(&scope);
  return failure;
}

static const uint8_t lb_component[] = {0,97,115,109,13,0,1,0,7,240,10,1,66,66,1,112,121,1,109,1,4,117,110,105,116,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,0,1,1,112,121,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,0,3,1,114,2,8,110,101,103,97,116,105,118,101,127,5,108,105,109,98,115,0,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,49,3,0,5,1,112,125,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,53,3,0,7,1,114,20,10,117,110,105,116,45,118,97,108,117,101,2,10,98,111,111,108,45,118,97,108,117,101,127,11,117,105,110,116,56,45,118,97,108,117,101,125,12,117,105,110,116,49,54,45,118,97,108,117,101,123,12,117,105,110,116,51,50,45,118,97,108,117,101,121,12,117,105,110,116,54,52,45,118,97,108,117,101,119,10,105,110,116,56,45,118,97,108,117,101,126,11,105,110,116,49,54,45,118,97,108,117,101,124,11,105,110,116,51,50,45,118,97,108,117,101,122,11,105,110,116,54,52,45,118,97,108,117,101,120,9,110,97,116,45,118,97,108,117,101,4,9,105,110,116,45,118,97,108,117,101,6,13,102,108,111,97,116,51,50,45,118,97,108,117,101,118,13,102,108,111,97,116,54,52,45,118,97,108,117,101,117,10,116,101,120,116,45,118,97,108,117,101,115,11,98,121,116,101,115,45,118,97,108,117,101,8,10,99,104,97,114,45,118,97,108,117,101,116,11,117,115,105,122,101,45,118,97,108,117,101,119,11,105,115,105,122,101,45,118,97,108,117,101,120,5,100,105,103,105,116,4,4,0,6,112,97,99,107,101,116,3,0,9,1,107,10,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,48,3,0,11,1,112,12,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,49,3,0,13,1,111,2,10,10,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,50,3,0,15,1,106,1,10,1,10,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,51,3,0,17,1,107,18,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,52,3,0,19,1,112,20,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,53,3,0,21,1,114,1,5,118,97,108,117,101,10,4,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,0,23,1,114,1,6,118,97,108,117,101,115,22,4,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,0,25,1,113,3,5,101,109,112,116,121,0,0,3,98,111,120,1,24,0,7,99,104,111,105,99,101,115,1,26,0,4,0,5,101,118,101,110,116,3,0,27,4,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,0,10,1,107,29,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,48,3,0,30,1,112,31,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,49,3,0,32,1,114,2,4,108,101,102,116,33,5,114,105,103,104,116,33,4,0,4,112,97,105,114,3,0,34,1,114,20,10,117,110,105,116,45,118,97,108,117,101,2,10,98,111,111,108,45,118,97,108,117,101,127,11,117,105,110,116,56,45,118,97,108,117,101,125,12,117,105,110,116,49,54,45,118,97,108,117,101,123,12,117,105,110,116,51,50,45,118,97,108,117,101,121,12,117,105,110,116,54,52,45,118,97,108,117,101,119,10,105,110,116,56,45,118,97,108,117,101,126,11,105,110,116,49,54,45,118,97,108,117,101,124,11,105,110,116,51,50,45,118,97,108,117,101,122,11,105,110,116,54,52,45,118,97,108,117,101,120,9,110,97,116,45,118,97,108,117,101,4,9,105,110,116,45,118,97,108,117,101,6,13,102,108,111,97,116,51,50,45,118,97,108,117,101,118,13,102,108,111,97,116,54,52,45,118,97,108,117,101,117,10,116,101,120,116,45,118,97,108,117,101,115,11,98,121,116,101,115,45,118,97,108,117,101,8,10,99,104,97,114,45,118,97,108,117,101,116,11,117,115,105,122,101,45,118,97,108,117,101,119,11,105,115,105,122,101,45,118,97,108,117,101,120,5,100,105,103,105,116,4,4,0,10,114,97,119,45,112,97,99,107,101,116,3,0,36,1,64,2,4,97,114,103,48,33,4,97,114,103,49,33,0,33,4,0,7,97,108,105,97,115,101,115,1,38,1,64,2,4,97,114,103,48,10,4,97,114,103,49,10,0,16,4,0,7,99,111,109,98,105,110,101,1,39,1,64,1,4,97,114,103,48,10,0,10,4,0,6,101,99,104,111,45,97,1,40,1,64,1,4,97,114,103,48,10,0,10,4,0,6,101,99,104,111,45,98,1,41,1,64,1,4,97,114,103,48,28,0,28,4,0,12,101,99,104,111,45,101,118,101,110,116,45,97,1,42,1,64,1,4,97,114,103,48,28,0,28,4,0,12,101,99,104,111,45,101,118,101,110,116,45,98,1,43,1,64,1,4,97,114,103,48,35,0,35,4,0,9,101,99,104,111,45,112,97,105,114,1,44,1,64,1,4,97,114,103,48,37,0,12,4,0,7,112,114,111,100,117,99,101,1,45,1,64,1,4,97,114,103,48,37,0,28,4,0,15,112,114,111,100,117,99,101,45,99,104,111,105,99,101,115,1,46,1,64,1,4,97,114,103,48,37,0,28,4,0,13,112,114,111,100,117,99,101,45,101,118,101,110,116,1,47,1,64,1,4,97,114,103,48,37,0,33,4,0,13,112,114,111,100,117,99,101,45,103,114,111,117,112,1,48,1,64,1,4,97,114,103,48,37,0,35,4,0,12,112,114,111,100,117,99,101,45,112,97,105,114,1,49,1,64,1,4,97,114,103,48,10,0,10,4,0,11,114,101,102,117,115,101,45,117,110,105,116,1,50,1,64,0,0,121,4,0,9,119,111,114,100,45,98,105,116,115,1,51,10,54,1,0,49,108,101,97,110,45,98,114,105,100,103,101,58,110,111,109,105,110,97,108,112,114,105,109,105,116,105,118,101,115,117,98,116,121,112,101,115,47,110,97,116,105,118,101,64,49,46,48,46,48,5,0,6,152,4,33,3,0,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,49,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,53,3,0,0,6,112,97,99,107,101,116,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,48,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,49,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,50,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,51,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,52,3,0,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,53,3,0,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,0,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,0,0,5,101,118,101,110,116,3,0,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,0,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,48,3,0,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,49,3,0,0,4,112,97,105,114,3,0,0,10,114,97,119,45,112,97,99,107,101,116,1,0,0,7,97,108,105,97,115,101,115,1,0,0,7,99,111,109,98,105,110,101,1,0,0,6,101,99,104,111,45,97,1,0,0,6,101,99,104,111,45,98,1,0,0,12,101,99,104,111,45,101,118,101,110,116,45,97,1,0,0,12,101,99,104,111,45,101,118,101,110,116,45,98,1,0,0,9,101,99,104,111,45,112,97,105,114,1,0,0,7,112,114,111,100,117,99,101,1,0,0,15,112,114,111,100,117,99,101,45,99,104,111,105,99,101,115,1,0,0,13,112,114,111,100,117,99,101,45,101,118,101,110,116,1,0,0,13,112,114,111,100,117,99,101,45,103,114,111,117,112,1,0,0,12,112,114,111,100,117,99,101,45,112,97,105,114,1,0,0,11,114,101,102,117,115,101,45,117,110,105,116,1,0,0,9,119,111,114,100,45,98,105,116,115,1,230,2,0,97,115,109,1,0,0,0,1,25,5,96,4,127,127,127,127,1,127,96,1,127,0,96,1,126,0,96,1,125,0,96,1,124,0,3,6,5,0,1,2,3,4,5,5,1,1,1,128,8,6,6,1,127,1,65,16,11,7,64,6,6,109,101,109,111,114,121,2,0,7,114,101,97,108,108,111,99,0,0,8,112,111,115,116,45,105,51,50,0,1,8,112,111,115,116,45,105,54,52,0,2,8,112,111,115,116,45,102,51,50,0,3,8,112,111,115,116,45,102,54,52,0,4,10,147,1,5,117,1,3,127,32,3,69,4,64,65,0,15,11,35,0,32,2,65,1,107,106,65,0,32,2,107,113,33,4,32,4,32,3,106,33,5,32,5,32,4,73,32,5,65,128,128,128,32,75,114,4,64,0,11,32,5,65,255,255,3,106,65,16,118,33,6,32,6,63,0,75,4,64,32,6,63,0,107,64,0,65,127,70,4,64,0,11,11,32,0,4,64,32,4,32,0,32,1,32,3,32,1,32,3,73,27,252,10,0,0,11,32,5,36,0,32,4,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,6,0,65,16,36,0,11,0,82,4,110,97,109,101,0,10,9,97,108,108,111,99,97,116,111,114,2,54,1,0,7,0,3,111,108,100,1,8,111,108,100,45,115,105,122,101,2,9,97,108,105,103,110,109,101,110,116,3,4,115,105,122,101,4,5,115,116,97,114,116,5,3,101,110,100,6,5,112,97,103,101,115,7,7,1,0,4,104,101,97,112,2,4,1,0,0,0,6,76,6,0,2,1,0,6,109,101,109,111,114,121,0,0,1,0,7,114,101,97,108,108,111,99,0,0,1,0,8,112,111,115,116,45,105,51,50,0,0,1,0,8,112,111,115,116,45,105,54,52,0,0,1,0,8,112,111,115,116,45,102,51,50,0,0,1,0,8,112,111,115,116,45,102,54,52,8,113,14,1,0,0,2,3,0,4,0,1,0,1,2,3,0,4,0,1,0,2,2,3,0,4,0,1,0,3,2,3,0,4,0,1,0,4,2,3,0,4,0,1,0,5,2,3,0,4,0,1,0,6,2,3,0,4,0,1,0,7,2,3,0,4,0,1,0,8,2,3,0,4,0,1,0,9,2,3,0,4,0,1,0,10,2,3,0,4,0,1,0,11,2,3,0,4,0,1,0,12,2,3,0,4,0,1,0,13,2,3,0,4,0,1,244,6,0,97,115,109,1,0,0,0,1,31,5,96,4,127,127,127,127,1,127,96,5,127,127,127,127,127,0,96,2,127,127,0,96,0,1,127,96,1,127,1,127,2,166,1,15,10,97,108,108,111,99,97,116,105,111,110,7,114,101,97,108,108,111,99,0,0,4,104,111,115,116,2,102,48,0,1,4,104,111,115,116,2,102,49,0,2,4,104,111,115,116,2,102,50,0,2,4,104,111,115,116,2,102,51,0,2,4,104,111,115,116,2,102,52,0,2,4,104,111,115,116,2,102,53,0,2,4,104,111,115,116,2,102,54,0,1,4,104,111,115,116,2,102,55,0,2,4,104,111,115,116,2,102,56,0,2,4,104,111,115,116,2,102,57,0,2,4,104,111,115,116,3,102,49,48,0,2,4,104,111,115,116,3,102,49,49,0,2,4,104,111,115,116,3,102,49,50,0,2,4,104,111,115,116,3,102,49,51,0,3,3,15,14,0,4,4,4,4,4,0,4,4,4,4,4,4,3,7,75,14,2,102,48,0,15,2,102,49,0,16,2,102,50,0,17,2,102,51,0,18,2,102,52,0,19,2,102,53,0,20,2,102,54,0,21,2,102,55,0,22,2,102,56,0,23,2,102,57,0,24,3,102,49,48,0,25,3,102,49,49,0,26,3,102,49,50,0,27,3,102,49,51,0,28,10,224,2,14,30,1,1,127,65,0,65,0,65,4,65,8,16,0,33,4,32,0,32,1,32,2,32,3,32,4,16,1,32,4,11,25,1,1,127,65,0,65,0,65,8,65,240,1,16,0,33,1,32,0,32,1,16,2,32,1,11,25,1,1,127,65,0,65,0,65,8,65,248,0,16,0,33,1,32,0,32,1,16,3,32,1,11,25,1,1,127,65,0,65,0,65,8,65,248,0,16,0,33,1,32,0,32,1,16,4,32,1,11,25,1,1,127,65,0,65,0,65,8,65,128,1,16,0,33,1,32,0,32,1,16,5,32,1,11,25,1,1,127,65,0,65,0,65,8,65,128,1,16,0,33,1,32,0,32,1,16,6,32,1,11,30,1,1,127,65,0,65,0,65,4,65,16,16,0,33,4,32,0,32,1,32,2,32,3,32,4,16,7,32,4,11,25,1,1,127,65,0,65,0,65,8,65,128,1,16,0,33,1,32,0,32,1,16,8,32,1,11,25,1,1,127,65,0,65,0,65,8,65,128,1,16,0,33,1,32,0,32,1,16,9,32,1,11,25,1,1,127,65,0,65,0,65,8,65,128,1,16,0,33,1,32,0,32,1,16,10,32,1,11,24,1,1,127,65,0,65,0,65,4,65,8,16,0,33,1,32,0,32,1,16,11,32,1,11,24,1,1,127,65,0,65,0,65,4,65,16,16,0,33,1,32,0,32,1,16,12,32,1,11,25,1,1,127,65,0,65,0,65,8,65,248,0,16,0,33,1,32,0,32,1,16,13,32,1,11,4,0,16,14,11,0,222,1,4,110,97,109,101,0,8,7,102,111,114,119,97,114,100,1,71,15,0,8,97,108,108,111,99,97,116,101,1,2,102,48,2,2,102,49,3,2,102,50,4,2,102,51,5,2,102,52,6,2,102,53,7,2,102,54,8,2,102,55,9,2,102,56,10,2,102,57,11,3,102,49,48,12,3,102,49,49,13,3,102,49,50,14,3,102,49,51,2,131,1,13,15,1,4,6,114,101,115,117,108,116,16,1,1,6,114,101,115,117,108,116,17,1,1,6,114,101,115,117,108,116,18,1,1,6,114,101,115,117,108,116,19,1,1,6,114,101,115,117,108,116,20,1,1,6,114,101,115,117,108,116,21,1,4,6,114,101,115,117,108,116,22,1,1,6,114,101,115,117,108,116,23,1,1,6,114,101,115,117,108,116,24,1,1,6,114,101,115,117,108,116,25,1,1,6,114,101,115,117,108,116,26,1,1,6,114,101,115,117,108,116,27,1,1,6,114,101,115,117,108,116,2,100,2,1,14,2,102,48,0,5,2,102,49,0,6,2,102,50,0,7,2,102,51,0,8,2,102,52,0,9,2,102,53,0,10,2,102,54,0,11,2,102,55,0,12,2,102,56,0,13,2,102,57,0,14,3,102,49,48,0,15,3,102,49,49,0,16,3,102,49,50,0,17,3,102,49,51,0,18,0,1,2,10,97,108,108,111,99,97,116,105,111,110,18,0,4,104,111,115,116,18,1,6,103,14,0,0,1,2,2,102,48,0,0,1,2,2,102,49,0,0,1,2,2,102,50,0,0,1,2,2,102,51,0,0,1,2,2,102,52,0,0,1,2,2,102,53,0,0,1,2,2,102,54,0,0,1,2,2,102,55,0,0,1,2,2,102,56,0,0,1,2,2,102,57,0,0,1,2,3,102,49,48,0,0,1,2,3,102,49,49,0,0,1,2,3,102,49,50,0,0,1,2,3,102,49,51,7,17,1,64,2,4,97,114,103,48,17,4,97,114,103,49,17,0,17,8,12,1,0,0,19,3,3,0,4,0,5,1,20,7,17,1,64,2,4,97,114,103,48,5,4,97,114,103,49,5,0,8,8,12,1,0,0,20,3,3,0,4,0,5,1,21,7,11,1,64,1,4,97,114,103,48,5,0,5,8,12,1,0,0,21,3,3,0,4,0,5,1,22,7,11,1,64,1,4,97,114,103,48,5,0,5,8,12,1,0,0,22,3,3,0,4,0,5,1,23,7,11,1,64,1,4,97,114,103,48,14,0,14,8,12,1,0,0,23,3,3,0,4,0,5,1,24,7,11,1,64,1,4,97,114,103,48,14,0,14,8,12,1,0,0,24,3,3,0,4,0,5,1,25,7,11,1,64,1,4,97,114,103,48,18,0,18,8,12,1,0,0,25,3,3,0,4,0,5,1,26,7,11,1,64,1,4,97,114,103,48,19,0,6,8,12,1,0,0,26,3,3,0,4,0,5,1,27,7,11,1,64,1,4,97,114,103,48,19,0,14,8,12,1,0,0,27,3,3,0,4,0,5,1,28,7,11,1,64,1,4,97,114,103,48,19,0,14,8,12,1,0,0,28,3,3,0,4,0,5,1,29,7,11,1,64,1,4,97,114,103,48,19,0,17,8,12,1,0,0,29,3,3,0,4,0,5,1,30,7,11,1,64,1,4,97,114,103,48,19,0,18,8,12,1,0,0,30,3,3,0,4,0,5,1,31,7,11,1,64,1,4,97,114,103,48,5,0,5,8,12,1,0,0,31,3,3,0,4,0,5,1,32,7,5,1,64,0,0,121,8,12,1,0,0,32,3,3,0,4,0,5,1,33,7,205,6,1,66,66,2,3,2,1,1,4,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,0,0,2,3,2,1,2,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,0,2,2,3,2,1,3,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,49,3,0,4,2,3,2,1,4,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,53,3,0,6,2,3,2,1,5,4,0,6,112,97,99,107,101,116,3,0,8,2,3,2,1,6,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,48,3,0,10,2,3,2,1,7,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,49,3,0,12,2,3,2,1,8,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,50,3,0,14,2,3,2,1,9,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,51,3,0,16,2,3,2,1,10,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,52,3,0,18,2,3,2,1,11,4,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,53,3,0,20,2,3,2,1,12,4,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,0,22,2,3,2,1,13,4,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,0,24,2,3,2,1,14,4,0,5,101,118,101,110,116,3,0,26,2,3,2,1,15,4,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,0,28,2,3,2,1,16,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,48,3,0,30,2,3,2,1,17,4,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,49,3,0,32,2,3,2,1,18,4,0,4,112,97,105,114,3,0,34,2,3,2,1,19,4,0,10,114,97,119,45,112,97,99,107,101,116,3,0,36,1,64,2,4,97,114,103,48,33,4,97,114,103,49,33,0,33,4,0,7,97,108,105,97,115,101,115,1,38,1,64,2,4,97,114,103,48,9,4,97,114,103,49,9,0,15,4,0,7,99,111,109,98,105,110,101,1,39,1,64,1,4,97,114,103,48,9,0,9,4,0,6,101,99,104,111,45,97,1,40,1,64,1,4,97,114,103,48,9,0,9,4,0,6,101,99,104,111,45,98,1,41,1,64,1,4,97,114,103,48,27,0,27,4,0,12,101,99,104,111,45,101,118,101,110,116,45,97,1,42,1,64,1,4,97,114,103,48,27,0,27,4,0,12,101,99,104,111,45,101,118,101,110,116,45,98,1,43,1,64,1,4,97,114,103,48,35,0,35,4,0,9,101,99,104,111,45,112,97,105,114,1,44,1,64,1,4,97,114,103,48,37,0,11,4,0,7,112,114,111,100,117,99,101,1,45,1,64,1,4,97,114,103,48,37,0,27,4,0,15,112,114,111,100,117,99,101,45,99,104,111,105,99,101,115,1,46,1,64,1,4,97,114,103,48,37,0,27,4,0,13,112,114,111,100,117,99,101,45,101,118,101,110,116,1,47,1,64,1,4,97,114,103,48,37,0,33,4,0,13,112,114,111,100,117,99,101,45,103,114,111,117,112,1,48,1,64,1,4,97,114,103,48,37,0,35,4,0,12,112,114,111,100,117,99,101,45,112,97,105,114,1,49,1,64,1,4,97,114,103,48,9,0,9,4,0,11,114,101,102,117,115,101,45,117,110,105,116,1,50,1,64,0,0,121,4,0,9,119,111,114,100,45,98,105,116,115,1,51,5,154,4,1,1,33,0,14,98,114,105,100,103,101,45,118,97,108,117,101,45,48,3,1,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,48,3,2,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,49,3,3,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,49,53,3,4,0,6,112,97,99,107,101,116,3,5,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,48,3,6,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,49,3,7,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,50,3,8,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,51,3,9,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,52,3,10,0,15,98,114,105,100,103,101,45,118,97,108,117,101,45,50,53,3,11,0,16,101,118,101,110,116,45,98,111,120,45,102,105,101,108,100,115,3,12,0,20,101,118,101,110,116,45,99,104,111,105,99,101,115,45,102,105,101,108,100,115,3,13,0,5,101,118,101,110,116,3,14,0,12,112,97,99,107,101,116,45,97,108,105,97,115,3,15,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,48,3,16,0,21,98,114,105,100,103,101,45,97,108,105,97,115,45,118,97,108,117,101,45,51,49,3,17,0,4,112,97,105,114,3,18,0,10,114,97,119,45,112,97,99,107,101,116,3,19,0,7,97,108,105,97,115,101,115,1,14,0,7,99,111,109,98,105,110,101,1,15,0,6,101,99,104,111,45,97,1,16,0,6,101,99,104,111,45,98,1,17,0,12,101,99,104,111,45,101,118,101,110,116,45,97,1,18,0,12,101,99,104,111,45,101,118,101,110,116,45,98,1,19,0,9,101,99,104,111,45,112,97,105,114,1,20,0,7,112,114,111,100,117,99,101,1,21,0,15,112,114,111,100,117,99,101,45,99,104,111,105,99,101,115,1,22,0,13,112,114,111,100,117,99,101,45,101,118,101,110,116,1,23,0,13,112,114,111,100,117,99,101,45,103,114,111,117,112,1,24,0,12,112,114,111,100,117,99,101,45,112,97,105,114,1,25,0,11,114,101,102,117,115,101,45,117,110,105,116,1,26,0,9,119,111,114,100,45,98,105,116,115,1,27,11,54,1,0,46,108,101,97,110,45,98,114,105,100,103,101,58,110,111,109,105,110,97,108,112,114,105,109,105,116,105,118,101,115,117,98,116,121,112,101,115,47,97,112,105,64,49,46,48,46,48,5,1,1,5,34,0,161,6,14,99,111,109,112,111,110,101,110,116,45,110,97,109,101,1,184,2,0,0,33,0,7,114,101,97,108,108,111,99,1,8,112,111,115,116,45,105,51,50,2,8,112,111,115,116,45,105,54,52,3,8,112,111,115,116,45,102,51,50,4,8,112,111,115,116,45,102,54,52,5,6,108,111,119,101,114,48,6,6,108,111,119,101,114,49,7,6,108,111,119,101,114,50,8,6,108,111,119,101,114,51,9,6,108,111,119,101,114,52,10,6,108,111,119,101,114,53,11,6,108,111,119,101,114,54,12,6,108,111,119,101,114,55,13,6,108,111,119,101,114,56,14,6,108,111,119,101,114,57,15,7,108,111,119,101,114,49,48,16,7,108,111,119,101,114,49,49,17,7,108,111,119,101,114,49,50,18,7,108,111,119,101,114,49,51,19,8,102,111,114,119,97,114,100,48,20,8,102,111,114,119,97,114,100,49,21,8,102,111,114,119,97,114,100,50,22,8,102,111,114,119,97,114,100,51,23,8,102,111,114,119,97,114,100,52,24,8,102,111,114,119,97,114,100,53,25,8,102,111,114,119,97,114,100,54,26,8,102,111,114,119,97,114,100,55,27,8,102,111,114,119,97,114,100,56,28,8,102,111,114,119,97,114,100,57,29,9,102,111,114,119,97,114,100,49,48,30,9,102,111,114,119,97,114,100,49,49,31,9,102,111,114,119,97,114,100,49,50,32,9,102,111,114,119,97,114,100,49,51,1,11,0,2,1,0,6,109,101,109,111,114,121,1,23,0,17,2,0,9,97,108,108,111,99,97,116,111,114,1,7,102,111,114,119,97,114,100,1,35,0,18,3,0,10,97,108,108,111,99,97,116,105,111,110,1,7,105,109,112,111,114,116,115,2,9,102,111,114,119,97,114,100,101,100,1,164,1,1,28,0,5,104,111,115,116,48,1,5,104,111,115,116,49,2,5,104,111,115,116,50,3,5,104,111,115,116,51,4,5,104,111,115,116,52,5,5,104,111,115,116,53,6,5,104,111,115,116,54,7,5,104,111,115,116,55,8,5,104,111,115,116,56,9,5,104,111,115,116,57,10,6,104,111,115,116,49,48,11,6,104,111,115,116,49,49,12,6,104,111,115,116,49,50,13,6,104,111,115,116,49,51,14,2,102,48,15,2,102,49,16,2,102,50,17,2,102,51,18,2,102,52,19,2,102,53,20,2,102,54,21,2,102,55,22,2,102,56,23,2,102,57,24,3,102,49,48,25,3,102,49,49,26,3,102,49,50,27,3,102,49,51,1,208,1,3,21,0,3,97,112,105,1,7,112,117,98,108,105,99,48,2,8,112,117,98,108,105,99,49,48,3,8,112,117,98,108,105,99,49,49,4,8,112,117,98,108,105,99,49,53,5,8,112,117,98,108,105,99,49,57,6,8,112,117,98,108,105,99,50,48,7,8,112,117,98,108,105,99,50,49,8,8,112,117,98,108,105,99,50,50,9,8,112,117,98,108,105,99,50,51,10,8,112,117,98,108,105,99,50,52,11,8,112,117,98,108,105,99,50,53,12,8,112,117,98,108,105,99,51,50,13,8,112,117,98,108,105,99,51,51,14,8,112,117,98,108,105,99,50,54,15,8,112,117,98,108,105,99,50,57,16,8,112,117,98,108,105,99,51,48,17,8,112,117,98,108,105,99,51,49,18,8,112,117,98,108,105,99,50,55,19,8,112,117,98,108,105,99,50,56,34,10,112,117,98,108,105,99,45,97,112,105,1,16,5,2,0,4,104,111,115,116,1,6,112,117,98,108,105,99};
struct nominalprimitivesubtypes_wasmtime {
  wasm_engine_t *engine;
  wasmtime_component_t *component;
  wasmtime_store_t *store;
  wasmtime_component_linker_t *linker;
  wasmtime_component_instance_t instance;
};
wasmtime_error_t *nominalprimitivesubtypes_wasmtime_link(wasmtime_component_linker_t *linker) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!linker) return wasmtime_error_new("Missing Wasmtime linker");
  wasmtime_component_linker_instance_t *root = wasmtime_component_linker_root(linker), *host = NULL;
  wasmtime_error_t *error = wasmtime_component_linker_instance_add_instance(root, "lean-bridge:nominalprimitivesubtypes/native@1.0.0", 49, &host);
  if (!error) {
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "aliases", 7, lb_call_0, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "combine", 7, lb_call_1, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo-a", 6, lb_call_2, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo-b", 6, lb_call_3, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo-event-a", 12, lb_call_4, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo-event-b", 12, lb_call_5, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "echo-pair", 9, lb_call_6, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce", 7, lb_call_7, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-choices", 15, lb_call_8, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-event", 13, lb_call_9, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-group", 13, lb_call_10, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "produce-pair", 12, lb_call_11, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "refuse-unit", 11, lb_call_12, NULL, NULL);
    if (!error) error = wasmtime_component_linker_instance_add_func(host, "word-bits", 9, lb_call_13, NULL, NULL);
    wasmtime_component_linker_instance_delete(host);
  }
  wasmtime_component_linker_instance_delete(root);
  return error;
}
static wasmtime_error_t *lb_refresh(nominalprimitivesubtypes_wasmtime *session) {
  if (session->store) wasmtime_store_delete(session->store);
  session->store = wasmtime_store_new(session->engine, NULL, NULL);
  wasmtime_error_t *error = wasmtime_component_linker_instantiate(session->linker, wasmtime_store_context(session->store), session->component, &session->instance);
  if (error) { wasmtime_store_delete(session->store); session->store = NULL; }
  return error;
}
void nominalprimitivesubtypes_wasmtime_close(nominalprimitivesubtypes_wasmtime *session) {
  if (getpid() != lb_package_pid) return;
  if (!session) return;
  if (session->linker) wasmtime_component_linker_delete(session->linker);
  if (session->store) wasmtime_store_delete(session->store);
  if (session->component) wasmtime_component_delete(session->component);
  if (session->engine) wasm_engine_delete(session->engine);
  free(session);
}
wasmtime_error_t *nominalprimitivesubtypes_wasmtime_open(nominalprimitivesubtypes_wasmtime **out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!out) return wasmtime_error_new("Missing session output");
  nominalprimitivesubtypes_wasmtime *session = calloc(1, sizeof(*session));
  if (!session) return wasmtime_error_new("Cannot allocate Wasmtime session");
  wasm_config_t *config = wasm_config_new();
  if (!config) { free(session); return wasmtime_error_new("Cannot allocate Wasmtime configuration"); }
  wasmtime_config_wasm_component_model_set(config, true);
  session->engine = wasm_engine_new_with_config(config);
  wasmtime_error_t *error = wasmtime_component_new(session->engine, lb_component, sizeof(lb_component), &session->component);
  if (!error) {
    session->linker = wasmtime_component_linker_new(session->engine);
    error = nominalprimitivesubtypes_wasmtime_link(session->linker);
    if (!error) error = lb_refresh(session);
  }
  if (error) { nominalprimitivesubtypes_wasmtime_close(session); return error; }
  *out = session; return NULL;
}
wasmtime_error_t *nominalprimitivesubtypes_wasmtime_call(nominalprimitivesubtypes_wasmtime *session, const char *name,
    const wasmtime_component_val_t *args, size_t count, wasmtime_component_val_t *out) {
  const char *package_failure = lb_package_failure();
  if (package_failure) return wasmtime_error_new(package_failure);
  if (!session || !session->store || !name || !out || (count && !args)) return wasmtime_error_new("Invalid WIT call arguments or unavailable session");
  /* Validate before Wasmtime copies caller buffers, including allocation bounds. */
  lb_scope scope = {.remaining = 16u * 1024u * 1024u};
  (void)scope; /* A package may contain only zero-argument exports. */
  bool valid = false;
  if (strcmp(name, "aliases") == 0) valid = count == 2 && lb_in_21(&args[0], &scope, NULL) && lb_in_21(&args[1], &scope, NULL);
  if (strcmp(name, "combine") == 0) valid = count == 2 && lb_in_19(&args[0], &scope, NULL) && lb_in_19(&args[1], &scope, NULL);
  if (strcmp(name, "echo-a") == 0) valid = count == 1 && lb_in_19(&args[0], &scope, NULL);
  if (strcmp(name, "echo-b") == 0) valid = count == 1 && lb_in_19(&args[0], &scope, NULL);
  if (strcmp(name, "echo-event-a") == 0) valid = count == 1 && lb_in_26(&args[0], &scope, NULL);
  if (strcmp(name, "echo-event-b") == 0) valid = count == 1 && lb_in_26(&args[0], &scope, NULL);
  if (strcmp(name, "echo-pair") == 0) valid = count == 1 && lb_in_27(&args[0], &scope, NULL);
  if (strcmp(name, "produce") == 0) valid = count == 1 && lb_in_28(&args[0], &scope, NULL);
  if (strcmp(name, "produce-choices") == 0) valid = count == 1 && lb_in_28(&args[0], &scope, NULL);
  if (strcmp(name, "produce-event") == 0) valid = count == 1 && lb_in_28(&args[0], &scope, NULL);
  if (strcmp(name, "produce-group") == 0) valid = count == 1 && lb_in_28(&args[0], &scope, NULL);
  if (strcmp(name, "produce-pair") == 0) valid = count == 1 && lb_in_28(&args[0], &scope, NULL);
  if (strcmp(name, "refuse-unit") == 0) valid = count == 1 && lb_in_19(&args[0], &scope, NULL);
  if (strcmp(name, "word-bits") == 0) valid = count == 0;
  if (!valid) return wasmtime_error_new("Unknown export, invalid WIT input or 16 MiB conversion limit");
  wasmtime_context_t *context = wasmtime_store_context(session->store);
  wasmtime_component_export_index_t *api = wasmtime_component_instance_get_export_index(&session->instance, context, NULL, "lean-bridge:nominalprimitivesubtypes/api@1.0.0", 46);
  if (!api) return wasmtime_error_new("Component API export is missing");
  wasmtime_component_export_index_t *index = wasmtime_component_instance_get_export_index(&session->instance, context, api, name, strlen(name));
  wasmtime_component_export_index_delete(api);
  if (!index) return wasmtime_error_new("Component function export is missing");
  wasmtime_component_func_t function;
  bool found = wasmtime_component_instance_get_func(&session->instance, context, index, &function);
  wasmtime_component_export_index_delete(index);
  if (!found) return wasmtime_error_new("Component export is not a function");
  wasmtime_component_val_t result = {0};
  wasmtime_error_t *error = wasmtime_component_func_call(&function, context, args, count, &result, 1);
  if (error) {
    wasmtime_component_val_delete(&result);
    /* A trap bypasses canonical post-return. Dispose its store and scratch memory. */
    wasmtime_error_t *reset_error = lb_refresh(session);
    if (reset_error) wasmtime_error_delete(reset_error);
    return error;
  }
  *out = result; return NULL;
}

