// One C++ type for the same compiler-verified nominal across component headers.
#ifndef LEAN_BRIDGE_CPP_TASK_RESOURCE_V2_HPP
#define LEAN_BRIDGE_CPP_TASK_RESOURCE_V2_HPP
#include "task-loop.hpp"
namespace lean_bridge::async_v2 {
template<class R> class Resource;
namespace detail {
template<class R> struct LeaseOps {
    void (*drop)(R*) noexcept;
    void (*retain)(R, R*);
    bool (*same)(R, R);
};
struct LeaseAccess {
    template<class R> static Resource<R> adopt(R &v, LeaseOps<R> ops);
    template<class R> static R view(const Resource<R> &r) { return r.live().value; }
};
}
template<class R> class Resource {
    struct Lease final : detail::Control {
        R value;
        detail::LeaseOps<R> ops;
        Lease(detail::Loop &loop, R v, detail::LeaseOps<R> o) : Control(loop), value(v), ops(o) {}
        void cancel_value() noexcept override { ops.drop(&value); }
    };
    std::shared_ptr<Lease> lease_;
    friend struct detail::LeaseAccess;
    explicit Resource(std::shared_ptr<Lease> p) noexcept : lease_(std::move(p)) {}
    const Lease &live() const {
        if (!lease_) throw Closed{};
        lease_->home.enter();
        if (!lease_->live()) throw Closed{};
        return *lease_;
    }
public:
    Resource() = default;
    Resource(const Resource&) = delete;
    Resource(Resource&&) noexcept = default;
    Resource &operator=(Resource&& other) noexcept {
        if (this != &other) { close(); lease_ = std::move(other.lease_); }
        return *this;
    }
    ~Resource() { close(); }
    void close() noexcept { if (lease_) { lease_->request_cancel(); lease_.reset(); } }
    Resource clone() const {
        auto &s = live(); R copy{};
        s.ops.retain(s.value, &copy);
        try { return detail::LeaseAccess::adopt(copy, s.ops); }
        catch (...) { s.ops.drop(&copy); throw; }
    }
    friend bool operator==(const Resource &a, const Resource &b) {
        auto &s = a.live(); return s.ops.same(s.value, b.live().value);
    }
};
namespace detail {
template<class R> Resource<R> LeaseAccess::adopt(R &v, LeaseOps<R> ops) {
    auto p = std::make_shared<typename Resource<R>::Lease>(Loop::main(), v, ops);
    v = {}; return Resource<R>(std::move(p));
}
}
}
#endif
