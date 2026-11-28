#include <lbc_journal.h>
#include <assert.h>
#include <dlfcn.h>
#include <string.h>

#define P(n) lbc_journal_##n
static P(view) view(const char *s) { return (P(view)){(const uint8_t *)s, strlen(s)}; }
static int equals(P(buffer) b, const char *s) { return b.len == strlen(s) && !memcmp(b.data, s, b.len); }

/* Test-only broker observer; no runtime lookup is needed for application calls. */
struct snapshot { uint32_t abi, state, init, components, attached, live; uint64_t runtime, domain; };
static struct snapshot snapshot(void) {
    void (*read_snapshot)(struct snapshot *) = dlsym(RTLD_DEFAULT, "lean_bridge_native_snapshot_read");
    struct snapshot s = {0}; assert(read_snapshot); read_snapshot(&s); assert(s.abi == 1); return s;
}
int main(void) {
    assert(!dlsym(RTLD_DEFAULT, "lbc_journal_choose_start"));
    assert(!dlsym(RTLD_DEFAULT, "lbc_journal_choose_poll"));
    struct snapshot cold = snapshot();
    P(store_value) unit = 0; P(buffer) io = {0};
    assert(P(store_call)(view("state"), (P(view)){(const uint8_t *)"\xff", 1}, &unit, &io) == P(INVALID));
    assert(snapshot().components == cold.components);
    uint32_t n = 0;
    assert(P(count_call)(&n) == P(OK) && n == 0);
    struct snapshot warm = snapshot(); assert(warm.components == cold.components + 1 && warm.live == cold.live);
    assert(P(bump_call)(3, &n) == P(OK) && n == 3);
    assert(P(bump_call)(2, NULL) == P(INVALID));
    assert(P(count_call)(&n) == P(OK) && n == 3);
    assert(P(bump_call)(2, &n) == P(OK) && n == 5);
    assert(P(echo_call)(37, &n) == P(OK) && n == 37);
    P(view) path = view("state"); P(buffer) text = {0};
    assert(P(store_call)(path, (P(view)){(const uint8_t *)"\xff", 1}, &unit, &io) == P(INVALID));
    assert(P(read_call)(path, &text, &io) == P(OK) && equals(text, "open"));
    P(read_value_dispose)(&text);
    assert(P(read_call)(view("missing"), &text, &io) == P(IO_ERROR) && io.len && !text.data);
    P(buffer_dispose)(&io);
    for (int repeat = 0; repeat < 4; ++repeat) for (int reject = 0; reject < 2; ++reject) {
        for (int tag = 0; tag < 2; ++tag) {
            P(choose_value) v = {0}; P(choose_error) err = {0};
            assert(P(choose_call)(reject, tag, view("payload"), &v, &err) == (reject ? P(TYPED_ERROR) : P(OK)));
            P(choose_value) result = reject ? err : v;
            assert(result.ok == tag);
            if (tag) assert(equals(result.as.value, "payload"));
            else assert(result.as.error == 37);
            P(choose_value_dispose)(&v); P(choose_error_dispose)(&err);
        }
    }
    assert(P(store_call)(path, view("closed"), &unit, &io) == P(OK));
    assert(P(read_call)(path, &text, &io) == P(OK) && equals(text, "closed"));
    P(read_value_dispose)(&text);
    assert(snapshot().live == warm.live && snapshot().components == warm.components);
}
