// Public C++20 task/stream types, independent of the private C handle layout.
#ifndef LEAN_BRIDGE_CPP_TASK_VALUES_V1_HPP
#define LEAN_BRIDGE_CPP_TASK_VALUES_V1_HPP
#include "task-loop.hpp"
#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <type_traits>
#include <variant>

namespace lean_bridge::async_v1 {
template<class T> struct Ok { T value; friend bool operator==(const Ok&, const Ok&) = default; };
template<class E> struct Err { E value; friend bool operator==(const Err&, const Err&) = default; };
template<class T, class E> using Result = std::variant<Ok<T>, Err<E>>;
struct IOError : std::runtime_error {
    std::string declaration, message;
    IOError(std::string_view d, std::string v) : runtime_error(v), declaration(d), message(std::move(v)) {}
};
template<class E> struct StartError : std::runtime_error {
    std::string declaration; E payload;
    StartError(std::string_view d, E v) : runtime_error("Lean EIO start failure"), declaration(d), payload(std::move(v)) {}
};
template<class E> struct StepError : std::runtime_error {
    std::string declaration; E payload;
    StepError(std::string_view d, E v) : runtime_error("Lean stream pull failure"), declaration(d), payload(std::move(v)) {}
};

namespace detail {
template<class T> using Stored = std::conditional_t<std::is_void_v<T>, std::monostate, T>;
template<class T> struct Pending final : Control {
    using V = Stored<T>;
    std::function<int()> interest;
    std::function<V()> take;
    std::function<void()> close;
    Watch watch;
    bool claimed = false, cancelled = false;
    Pending(Loop &l, std::function<int()> p, std::function<V()> t, std::function<void()> c)
        : Control(l), interest(std::move(p)), take(std::move(t)), close(std::move(c)) {}
    void claim() {
        home.check();
        if (cancelled) throw Cancelled{};
        if (!live()) throw Closed{};
        if (claimed) throw Busy{};
        claimed = true;
    }
    void clear() noexcept { interest = {}; take = {}; close = {}; }
    void cancel_value() noexcept override {
        cancelled = true; watch.fd = -1;
        close(); clear();
    }
    int ready_fd() {
        home.check(); home.drain();
        if (cancelled) return -1;
        if (!live()) throw Closed{};
        try { return interest(); } catch (...) { cancel_here(); throw; }
    }
    V finish() {
        home.check(); home.drain();
        if (cancelled) throw Cancelled{};
        if (!live()) throw Closed{};
        try { V v = take(); unlink(); clear(); return v; }
        catch (...) { cancel_here(); throw; }
    }
};
template<class T> class Awaiter {
    std::shared_ptr<Pending<T>> op_;
    int fd_ = -1;
public:
    explicit Awaiter(std::shared_ptr<Pending<T>> &owner, bool transfer = false) : op_(owner) {
        if (!op_) throw Closed{};
        op_->claim();
        // A rejected claim (wrong thread or existing waiter) must not steal
        // the last owner or bypass its main-thread cancellation path.
        if (transfer) owner.reset();
    }
    Awaiter(const Awaiter&) = delete;
    ~Awaiter() {
        // As with any externally owned coroutine, resume/destroy its suspended
        // frame on the dispatcher thread. Public Future/Stream owners can move
        // off-thread; their destruction uses the separate cancellation queue.
        if (op_ && op_->home.local()) { op_->home.remove(op_->watch); op_->cancel_here(); }
    }
    bool await_ready() { fd_ = op_->ready_fd(); return fd_ < 0; }
    void await_suspend(std::coroutine_handle<> h) { op_->home.add(op_->watch, fd_, h); }
    T await_resume() {
        if constexpr (std::is_void_v<T>) { op_->finish(); return; }
        else return op_->finish();
    }
    T get() {
        if (!await_ready()) {
            await_suspend({});
            while (op_->watch.linked) op_->home.turn(-1);
        }
        return await_resume();
    }
};
} // namespace detail

template<class T> class Future {
    std::shared_ptr<detail::Pending<T>> state_;
public:
    explicit Future(std::shared_ptr<detail::Pending<T>> p) noexcept : state_(std::move(p)) {}
    Future(const Future&) = delete;
    Future(Future&&) noexcept = default;
    Future &operator=(Future&& v) noexcept {
        if (this != &v) { cancel(); state_ = std::move(v.state_); }
        return *this;
    }
    ~Future() { cancel(); }
    void cancel() noexcept { if (state_) state_->request_cancel(); }
    bool ready() const { if (!state_) throw Closed{}; return state_->ready_fd() < 0; }
    T get() { return detail::Awaiter<T>(state_).get(); }
    auto operator co_await() & { return detail::Awaiter<T>(state_); }
    auto operator co_await() && { return detail::Awaiter<T>(state_, true); }
};

namespace detail {
template<class T, class P, class F, class C>
Future<T> future(Loop &l, P &&poll, F &&take, C &&close) {
    return Future<T>(std::make_shared<Pending<T>>(l, std::forward<P>(poll), std::forward<F>(take), std::forward<C>(close)));
}
template<class T> struct Cursor final : Control {
    using Item = std::optional<T>;
    std::function<void()> pull, close;
    std::function<int()> poll;
    std::function<Item()> take;
    std::weak_ptr<Pending<Item>> active;
    bool exhausted = false;
    Cursor(Loop &l, std::function<void()> p, std::function<int()> w, std::function<Item()> t, std::function<void()> c)
        : Control(l), pull(std::move(p)), close(std::move(c)), poll(std::move(w)), take(std::move(t)) {}
    void cancel_value() noexcept override {
        close();
        if (auto pending = active.lock()) pending->cancel_here();
        active.reset();
    }
    Future<Item> next() {
        home.check(); home.drain();
        if (exhausted) return future<Item>(home, [] { return -1; }, [] { return Item{}; }, [] {});
        if (!live()) throw Closed{};
        if (auto pending = active.lock(); pending && pending->live()) throw Busy{};
        // Allocate and construct everything before advancing the producer.
        auto self = std::static_pointer_cast<Cursor>(shared_from_this());
        auto pending = std::make_shared<Pending<Item>>(home,
            [self] { return self->poll(); },
            [self] {
                auto item = self->take();
                if (!item) { self->exhausted = true; self->unlink(); }
                return item;
            }, [self] { self->cancel_here(); });
        active = pending;
        try { pull(); } catch (...) { pending->cancel_here(); throw; }
        return Future<Item>(std::move(pending));
    }
};
} // namespace detail
template<class T> class Stream {
    std::shared_ptr<detail::Cursor<T>> state_;
public:
    explicit Stream(std::shared_ptr<detail::Cursor<T>> c) noexcept : state_(std::move(c)) {}
    Stream(const Stream&) = delete;
    Stream(Stream&&) noexcept = default;
    Stream &operator=(Stream&& v) noexcept {
        if (this != &v) { close(); state_ = std::move(v.state_); }
        return *this;
    }
    ~Stream() { close(); }
    void close() noexcept { if (state_) state_->request_cancel(); }
    Future<std::optional<T>> next() { if (!state_) throw Closed{}; return state_->next(); }
};
} // namespace lean_bridge::async_v1
#endif
