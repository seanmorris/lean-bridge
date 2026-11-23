/* One epoll wait for any number of Java waiters. Only a task's owner closes
   its completion fd, after removing the registration. Tokens never use fd
   numbers: a queued event cannot complete a later task that reused that fd. */
#include <sys/epoll.h>
#include <sys/eventfd.h>
#include <errno.h>
#include <unistd.h>
int64_t __WATCH__(int op, int ep, int fd, int64_t key) {
    if (!lean_bridge_native_process_valid()) return -1;
    struct epoll_event e = {.events = EPOLLIN, .data.u64 = (uint64_t)key};
    switch (op) {
    case 0: {
        int retired = lean_bridge_native_retirement_watch();
        if (retired < 0) return -1;
        ep = epoll_create1(EPOLL_CLOEXEC); fd = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
        e.data.u64 = 0;
        if (ep >= 0 && fd >= 0 && epoll_ctl(ep, EPOLL_CTL_ADD, fd, &e) == 0) {
            e.data.u64 = (uint64_t)-2;
            if (epoll_ctl(ep, EPOLL_CTL_ADD, retired, &e) == 0)
                return ((int64_t)ep << 32) | (unsigned)fd;
        }
        if (ep >= 0) close(ep);
        if (fd >= 0) close(fd);
        lean_bridge_native_retirement_unwatch(); return -1;
    }
    case 1: e.events |= EPOLLONESHOT; return epoll_ctl(ep, EPOLL_CTL_ADD, fd, &e);
    case 2: return epoll_ctl(ep, EPOLL_CTL_DEL, fd, NULL);
    case 3: {
        int n; do { n = epoll_wait(ep, &e, 1, -1); } while (n < 0 && errno == EINTR);
        if (n != 1) return -1;
        if (e.data.u64 == 0) { uint64_t count; while (read(fd, &count, 8) < 0 && errno == EINTR) {} }
        return (int64_t)e.data.u64;
    }
    case 4: { uint64_t one = 1; while (write(fd, &one, 8) < 0 && errno == EINTR) {} return 0; }
    case 5: close(ep); close(fd); lean_bridge_native_retirement_unwatch(); return 0;
    default: return -1;
    }
}
