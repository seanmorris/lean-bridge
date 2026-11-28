// Single-pass C++20 ranges over immediate Lean pulls. No eventfd, worker or coroutine.
#ifndef LEAN_BRIDGE_CPP_SYNC_ITERATOR_V1_HPP
#define LEAN_BRIDGE_CPP_SYNC_ITERATOR_V1_HPP
#include <atomic>
#include <cstdlib>
#include <iterator>
#include <memory>
#include <optional>
#include <stdexcept>
#include <utility>
#include <sys/syscall.h>
#include <unistd.h>

namespace lean_bridge::sync_v1 {
namespace detail {
struct CursorCleanup {
    const pid_t pid = ::getpid();
    CursorCleanup *next{};
    virtual ~CursorCleanup() = default;
};
inline constinit std::atomic<CursorCleanup *> pending_cursors{nullptr};
inline constinit std::atomic<pid_t> cursor_pid{0};
inline bool on_cursor_thread() noexcept { return ::syscall(SYS_gettid) == ::getpid(); }
inline void drain_cursors() noexcept {
    if (cursor_pid.load(std::memory_order_acquire) != ::getpid() || !on_cursor_thread()) return;
    auto *n = pending_cursors.exchange(nullptr, std::memory_order_acquire);
    while (n) { auto *next = n->next; delete n; n = next; }
}
template<class WrongContext> void enter_cursors() {
    if (!on_cursor_thread()) throw WrongContext{};
    const pid_t home = cursor_pid.load(std::memory_order_acquire);
    if (!home) {
        if (std::atexit(drain_cursors)) throw std::runtime_error("cannot register Lean cursor cleanup");
        cursor_pid.store(::getpid(), std::memory_order_release);
    } else if (home != ::getpid()) throw WrongContext{};
    drain_cursors();
}
struct CursorDelete {
    void operator()(CursorCleanup *p) const noexcept {
        if (p->pid != ::getpid() || on_cursor_thread()) { delete p; return; }
        // Use the cursor's preallocated link; a foreign-thread destructor
        // never allocates or calls into the Lean runtime.
        auto *head = pending_cursors.load(std::memory_order_relaxed);
        do { p->next = head; }
        while (!pending_cursors.compare_exchange_weak(head, p, std::memory_order_release, std::memory_order_relaxed));
    }
};
template<class T> struct CursorSource : CursorCleanup {
    virtual std::optional<T> pull() = 0;
};
struct CursorAccess {
    template<class R, class S> static R adopt(S s) { return R(std::move(s)); }
};
}

template<class T, class WrongContext> class Cursor {
    using Source = detail::CursorSource<T>;
    std::unique_ptr<Source, detail::CursorDelete> source_;
    friend struct detail::CursorAccess;
    explicit Cursor(std::unique_ptr<Source, detail::CursorDelete> s) noexcept : source_(std::move(s)) {}
public:
    Cursor(Cursor&&) noexcept = default;
    Cursor& operator=(Cursor&&) noexcept = default;
    Cursor(const Cursor&) = delete;
    Cursor& operator=(const Cursor&) = delete;
    std::optional<T> next() {
        if (!source_) return {};
        detail::enter_cursors<WrongContext>();
        try {
            auto item = source_->pull();
            if (!item) source_.reset();
            return item;
        } catch (...) { source_.reset(); throw; }
    }
    void close() {
        if (!source_) return;
        detail::enter_cursors<WrongContext>();
        source_.reset();
    }
    class iterator {
        Cursor *cursor_{};
        std::optional<T> current_;
    public:
        using value_type = T;
        using difference_type = std::ptrdiff_t;
        using iterator_concept = std::input_iterator_tag;
        explicit iterator(Cursor& c) : cursor_(&c), current_(c.next()) {}
        const T& operator*() const { return *current_; }
        iterator& operator++() { current_ = cursor_->next(); return *this; }
        void operator++(int) { ++*this; }
        friend bool operator==(const iterator& i, std::default_sentinel_t) { return !i.current_; }
    };
    iterator begin() { return iterator(*this); }
    std::default_sentinel_t end() const noexcept { return {}; }
};

namespace detail {
template<class T, class WrongContext, class Handle, auto Close, class Open, class Pull>
Cursor<T, WrongContext> make_cursor(Open open, Pull pull) {
    enter_cursors<WrongContext>();
    struct State final : CursorSource<T> {
        Handle handle{};
        Pull take;
        explicit State(Pull op) : take(std::move(op)) {}
        std::optional<T> pull() override { return take(&handle); }
        ~State() { if (this->pid == ::getpid() && handle.id) (void)Close(&handle); }
    };
    std::unique_ptr<State, CursorDelete> state(new State(std::move(pull)));
    open(&state->handle);
    return CursorAccess::adopt<Cursor<T, WrongContext>>(std::move(state));
}
}
}
#endif
