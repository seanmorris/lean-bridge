// Shared by generated Linux C++20 headers. Lean workers signal borrowed
// descriptors; only the process main thread runs continuations or calls Lean.
#ifndef LEAN_BRIDGE_CPP_TASK_LOOP_V2_HPP
#define LEAN_BRIDGE_CPP_TASK_LOOP_V2_HPP
#include <atomic>
#include <cerrno>
#include <coroutine>
#include <cstdint>
#include <exception>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <system_error>
#include <utility>
#include <vector>
#include <poll.h>
#include <sys/eventfd.h>
#include <sys/syscall.h>
#include <unistd.h>

namespace lean_bridge::async_v2 {
struct Cancelled : std::runtime_error { Cancelled() : runtime_error("Lean operation cancelled") {} };
struct Closed : std::logic_error { Closed() : logic_error("Lean operation has already been consumed or closed") {} };
struct Busy : std::logic_error { Busy() : logic_error("Lean operation already has a consumer") {} };
struct WrongContext : std::logic_error { WrongContext() : logic_error("Lean operation requires its original process main thread") {} };
struct Unavailable : std::runtime_error { Unavailable() : runtime_error("Lean runtime or dispatcher is unavailable") {} };
namespace detail {
struct Control;
struct Deferred {
    Deferred *queued_next{};
    virtual void deliver() noexcept = 0;
protected: ~Deferred() = default;
};
struct Watch {
    Watch *next{}; int fd = -1; bool linked = false;
    std::coroutine_handle<> continuation{};
    int callback_fd = -1;
    void *owner{}; void (*dispatch)(void *) noexcept {}; void (*unclaimed_ready)(void *) noexcept {};
    bool dispatching = false;
};
class Loop {
    const pid_t pid_ = ::getpid();
    int wake_;
    std::mutex mutex_;
    Deferred *first_{}, *last_{};
    std::atomic<bool> has_mail_{false};
    Watch *waiters_{};
    Control *owners_{};
    bool stopped_ = false, poisoned_ = false;
    friend struct Control;
    void acknowledge() noexcept {
        std::uint64_t v;
        while (::read(wake_, &v, sizeof v) < 0 && errno == EINTR) {}
    }
    void resume(Watch &w) {
        auto h = w.continuation; auto done = w.unclaimed_ready; auto owner = w.owner;
        remove(w); // Do not touch w after resuming: it may no longer exist.
        if (h) h.resume(); else if (done) done(owner);
    }
    void rotate(Watch &w) noexcept {
        if (!w.next) return;
        auto **slot = &waiters_;
        while (*slot != &w) slot = &(*slot)->next;
        *slot = w.next;
        while (*slot) slot = &(*slot)->next;
        *slot = &w; w.next = nullptr;
    }
public:
    Loop() : wake_(::eventfd(0, EFD_NONBLOCK | EFD_CLOEXEC)) {
        if (wake_ < 0) throw std::system_error(errno, std::generic_category(), "Lean dispatcher eventfd");
    }
    ~Loop();
    static Loop &main() {
        if (::syscall(SYS_gettid) != ::getpid()) throw WrongContext{};
        static Loop shared;
        shared.check(); return shared;
    }
    bool same_process() const noexcept { return ::getpid() == pid_; }
    bool local() const noexcept { return same_process() && ::syscall(SYS_gettid) == pid_; }
    void check() const { if (!local()) throw WrongContext{}; }
    void accepting() const { check(); if (stopped_) throw Unavailable{}; }
    bool poisoned() const noexcept { return poisoned_; }
    void enter() { check(); drain(); accepting(); }
    // Intrusive, one-shot nodes: worker-thread destruction needs no allocation
    // and never calls a Lean destructor or resumes a coroutine on that worker.
    void post(Deferred &d) noexcept {
        std::lock_guard guard(mutex_);
        d.queued_next = nullptr;
        if (last_) last_->queued_next = &d; else first_ = &d;
        last_ = &d;
        has_mail_.store(true, std::memory_order_release);
        const std::uint64_t one = 1;
        while (::write(wake_, &one, sizeof one) < 0 && errno == EINTR) {}
    }
    bool drain() noexcept {
        if (!has_mail_.load(std::memory_order_acquire)) return false;
        Deferred *list;
        { std::lock_guard guard(mutex_); list = first_; first_ = last_ = nullptr;
          acknowledge(); has_mail_.store(false, std::memory_order_release); }
        const bool any = list != nullptr;
        while (list) { auto *next = list->queued_next; list->deliver(); list = next; }
        return any;
    }
    void add(Watch &w, int fd, std::coroutine_handle<> h) noexcept {
        w.fd = fd; w.continuation = h;
        if (!w.linked) { w.next = waiters_; waiters_ = &w; w.linked = true; }
    }
    void remove(Watch &w) noexcept {
        if (!w.linked) return;
        auto **slot = &waiters_;
        while (*slot != &w) slot = &(*slot)->next;
        *slot = w.next; w.linked = false; w.continuation = {};
    }
    bool turn(int timeout) {
        check(); bool progress = drain();
        for (auto *w = waiters_; w; w = w->next) if (!w->dispatching && w->fd < 0) { resume(*w); return true; }
        if (!waiters_) return progress;
        std::vector<pollfd> fds{{wake_, POLLIN, 0}};
        for (auto *w = waiters_; w; w = w->next) if (!w->dispatching) {
            fds.push_back({w->fd, POLLIN, 0});
            if (w->callback_fd >= 0) fds.push_back({w->callback_fd, POLLIN, 0});
        }
        if (fds.size() == 1) return progress; // Nested run_one: never wait on the currently executing callback.
        int n;
        do { n = ::poll(fds.data(), fds.size(), progress ? 0 : timeout); } while (n < 0 && errno == EINTR);
        if (n < 0) throw std::system_error(errno, std::generic_category(), "poll Lean completion");
        if (fds[0].revents) { drain(); return true; } // Discard the snapshot before a descriptor can be reused.
        std::size_t i = 1;
        for (auto *w = waiters_; w; w = w->next) if (!w->dispatching) {
            if (fds[i++].revents) { resume(*w); return true; }
            // Dispatch may cancel, release or recursively run another owner. Discard this snapshot immediately.
            if (w->callback_fd >= 0 && fds[i++].revents) { rotate(*w); w->dispatch(w->owner); return true; }
        }
        return progress;
    }
    void shutdown() noexcept;
    void poison() noexcept { if (local()) { poisoned_ = true; shutdown(); } }
};

// The reactor only lists live owners. A queued cancellation separately pins
// the control block until the owner thread acknowledges it (including late results).
struct Control : Deferred, std::enable_shared_from_this<Control> {
    Loop &home;
private:
    Control *next_{}, **back_{};
    std::atomic_flag posted_ = ATOMIC_FLAG_INIT;
    std::shared_ptr<Control> hold_;
    friend class Loop;
    void deliver() noexcept override { auto keep = std::move(hold_); cancel_here(); }
protected:
    explicit Control(Loop &l) : home(l) {
        l.accepting(); next_ = l.owners_; back_ = &l.owners_; l.owners_ = this;
        if (next_) next_->back_ = &next_;
    }
    void unlink() noexcept {
        if (!back_) return;
        *back_ = next_; if (next_) next_->back_ = back_;
        next_ = nullptr; back_ = nullptr;
    }
    virtual void cancel_value() noexcept = 0;
public:
    virtual ~Control() { if (home.local()) unlink(); }
    bool live() const noexcept { return back_ != nullptr; } // Main thread only.
    void cancel_here() noexcept {
        if (live()) { unlink(); cancel_value(); }
    }
    void request_cancel() noexcept {
        if (!home.same_process()) return; // Never take a copied mutex after fork.
        if (home.local()) { cancel_here(); return; }
        if (!posted_.test_and_set(std::memory_order_relaxed)) {
            hold_ = shared_from_this(); home.post(*this);
        }
    }
};
inline void Loop::shutdown() noexcept {
    if (!local()) return;
    stopped_ = true; drain();
    while (owners_) { auto keep = owners_->shared_from_this(); keep->cancel_here(); }
}
inline Loop::~Loop() {
    if (local()) shutdown();
    ::close(wake_);
}
} // namespace detail

// .get() pumps automatically. Applications which already own their main loop
// can call run_one(0) or wait with a bounded timeout; no scheduler ABI is public.
inline bool run_one(int timeout_ms = -1) { return detail::Loop::main().turn(timeout_ms); }
inline void shutdown() { detail::Loop::main().shutdown(); }
} // namespace lean_bridge::async_v2
#endif
