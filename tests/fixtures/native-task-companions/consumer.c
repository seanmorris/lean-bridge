#include <lbc_companions.h>
#include <assert.h>
#include <stdint.h>
#include <poll.h>
#include <errno.h>

#define FN(x) lbc_companions_##x
int main(void) {
    uint32_t n = 0;
    assert(FN(plain_call)(41, &n) == FN(OK) && n == 42);
    assert(FN(bump_call)(3, &n) == FN(OK) && n == 3);
    FN(doubled_handle) h = {0};
    assert(FN(doubled_start)(21, &h) == FN(OK));
    int fd = -1; FN(status) s = FN(doubled_poll)(h, &fd);
    if (s == FN(PENDING)) {
        struct pollfd p = {.fd = fd, .events = POLLIN}; int r;
        do { r = poll(&p, 1, 10000); } while (r < 0 && errno == EINTR);
        assert(r == 1);
    } else assert(s == FN(OK));
    assert(FN(doubled_take)(&h, &n) == FN(OK) && n == 42);
    assert(FN(bump_call)(4, &n) == FN(OK) && n == 7);
    FN(view) path = {(const uint8_t *)"state", 5}; FN(finish_value) unit = 0;
    assert(FN(finish_call)(path, &unit, NULL) == FN(OK));
    return 0;
}
