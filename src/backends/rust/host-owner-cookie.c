/* Cargo normally resolves one shared Rust owner crate. Detect a second
 * compiled instance before interpreting even one of its integer tickets. */
#define _GNU_SOURCE
#include "host-domain.h"
#include <unistd.h>
#include <sys/syscall.h>
static uintptr_t registered;
static pid_t process;
LB_DND_API int LB_DND(rust_owner)(uintptr_t cookie) {
    pid_t pid=getpid();
    if(!cookie || pid!=(pid_t)syscall(SYS_gettid) || (process && process!=pid)) return 0;
    if(registered && registered!=cookie) return 0;
    process=pid;registered=cookie;return 1;
}
