/* Internal ABI, shared only by JVM components built for the same Lean runtime. */
#ifndef LB_JVM_IO_OWNER_H
#define LB_JVM_IO_OWNER_H
#ifndef LB_JVM_OWNER_PREFIX
#error "A content-addressed JVM owner prefix is required"
#endif
#define LB_JVM_JOIN_I(a, b) a##b
#define LB_JVM_JOIN(a, b) LB_JVM_JOIN_I(a, b)
#define LB_JVM_OWNER(n) LB_JVM_JOIN(LB_JVM_OWNER_PREFIX, n)
__attribute__((visibility("default"))) int LB_JVM_OWNER(current)(void);
/* Blocks until fn returns. ctx and all borrowed inputs remain caller-owned. */
__attribute__((visibility("default"))) int LB_JVM_OWNER(call)(void (*fn)(void *), void *ctx);
#endif
