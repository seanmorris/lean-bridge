// A small owning coroutine root for applications without a coroutine framework.
#ifndef LEAN_BRIDGE_CPP_TASK_ROUTINE_V2_HPP
#define LEAN_BRIDGE_CPP_TASK_ROUTINE_V2_HPP
#include "task-values.hpp"
namespace lean_bridge::async_v2 {
namespace detail {
template<class T> struct Return {
    std::optional<T> value;
    template<class U> void return_value(U&& v) { value.emplace(std::forward<U>(v)); }
    T result() { return std::move(value).value(); }
};
template<> struct Return<void> { void return_void() noexcept {} void result() noexcept {} };
} // namespace detail
template<class T = void> class Routine {
public:
    struct promise_type : detail::Return<T> {
        std::exception_ptr error;
        std::coroutine_handle<> parent = std::noop_coroutine();
        Routine get_return_object() { return Routine(Handle::from_promise(*this)); }
        std::suspend_always initial_suspend() const noexcept { return {}; }
        struct Final {
            bool await_ready() const noexcept { return false; }
            std::coroutine_handle<> await_suspend(std::coroutine_handle<promise_type> h) const noexcept {
                return h.promise().parent;
            }
            void await_resume() const noexcept {}
        };
        Final final_suspend() const noexcept { return {}; }
        void unhandled_exception() noexcept { error = std::current_exception(); }
    };
private:
    using Handle = std::coroutine_handle<promise_type>;
    Handle handle_{};
    explicit Routine(Handle h) noexcept : handle_(h) {}
    struct Frame {
        Handle h;
        explicit Frame(Handle v) : h(v) { if (!h) throw Closed{}; }
        Frame(const Frame&) = delete;
        ~Frame() { h.destroy(); }
        T result() {
            if (h.promise().error) std::rethrow_exception(h.promise().error);
            return h.promise().result();
        }
        bool await_ready() const noexcept { return false; }
        Handle await_suspend(std::coroutine_handle<> parent) { h.promise().parent = parent; return h; }
        T await_resume() { return result(); }
    };
public:
    Routine(const Routine&) = delete;
    Routine(Routine&& v) noexcept : handle_(std::exchange(v.handle_, {})) {}
    ~Routine() { if (handle_) handle_.destroy(); } // Only an unstarted frame is still owned here.
    auto operator co_await() && {
        detail::Loop::main();
        return Frame(std::exchange(handle_, {}));
    }
    T get() {
        auto &loop = detail::Loop::main(); Frame frame(std::exchange(handle_, {}));
        frame.h.resume();
        while (!frame.h.done()) if (!loop.turn(-1)) throw std::logic_error("no dispatcher work can resume this routine");
        return frame.result();
    }
};
} // namespace lean_bridge::async_v2
#endif
