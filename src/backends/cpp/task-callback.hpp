// Optional explicit revocation; passing an ordinary (including move-only) callable creates the same lease.
#ifndef LEAN_BRIDGE_CPP_TASK_CALLBACK_V2_HPP
#define LEAN_BRIDGE_CPP_TASK_CALLBACK_V2_HPP
#include "task-values.hpp"
#include <concepts>

namespace lean_bridge::async_v2 {
struct CallbackClosed : std::logic_error { CallbackClosed() : logic_error("retained callback has expired") {} };
template<class Signature> class RetainedCallback;
template<class R, class... A> class RetainedCallback<R(A...)> {
    struct Action { virtual R call(A... args) = 0; virtual ~Action() = default; };
    template<class F> struct Invoke final : Action {
        F f;
        template<class G> explicit Invoke(G&& g) : f(std::forward<G>(g)) {}
        R call(A... args) override {
            if constexpr (std::is_void_v<R>) (void)std::invoke(f, std::forward<A>(args)...);
            else return std::invoke(f, std::forward<A>(args)...);
        }
    };
    struct Cell final : detail::Deferred {
        detail::Loop &loop;
        std::shared_ptr<Action> action;
        Cell(detail::Loop &l, std::shared_ptr<Action> a) : loop(l), action(std::move(a)) {}
        void deliver() noexcept override { delete this; }
        static void dispose(Cell *p) noexcept {
            if (p->loop.local()) delete p;
            else if (p->loop.same_process()) p->loop.post(*p);
            // A forked child has neither the parent's dispatcher nor authority to destroy the parent's capture.
        }
    };
    std::shared_ptr<Cell> cell_;
public:
    template<class F> requires (!std::same_as<std::remove_cvref_t<F>, RetainedCallback> && std::is_invocable_r_v<R, std::decay_t<F>&, A...>)
    RetainedCallback(F&& f) {
        auto &l = detail::Loop::main(); l.accepting();
        cell_ = std::shared_ptr<Cell>(new Cell(l, std::make_shared<Invoke<std::decay_t<F>>>(std::forward<F>(f))), &Cell::dispose);
    }
    void close() const { if (cell_) { cell_->loop.check(); cell_->action.reset(); } }
    R operator()(A... args) const {
        if (!cell_) throw CallbackClosed{};
        cell_->loop.accepting(); auto active = cell_->action;
        if (!active) throw CallbackClosed{};
        return active->call(std::forward<A>(args)...); // Self-close only affects the next invocation.
    }
};
} // namespace lean_bridge::async_v2
#endif
