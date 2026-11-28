// Reuse the established nominal ABI, including safe off-thread release.
// A cold, invalid synchronous call must not construct a dispatcher eventfd.
#ifndef LEAN_BRIDGE_CPP_SYNC_RESOURCE_V1_HPP
#define LEAN_BRIDGE_CPP_SYNC_RESOURCE_V1_HPP
#include <lean_bridge/async_v2/task-resource.hpp>
namespace lean_bridge::sync_v1::detail {
using Home = async_v2::detail::Loop;
inline constinit std::atomic<Home*> lease_home{nullptr};
inline void enter_leases() {
    if (auto *home = lease_home.load(std::memory_order_acquire)) home->enter();
}
struct LeaseAccess {
    template<class R> static auto adopt(R &v, async_v2::detail::LeaseOps<R> ops) {
        auto lease = async_v2::detail::LeaseAccess::adopt(v, ops);
        lease_home.store(&Home::main(), std::memory_order_release);
        return lease;
    }
    template<class R> static R view(const async_v2::Resource<R> &lease) {
        auto borrowed = async_v2::detail::LeaseAccess::view(lease);
        lease_home.store(&Home::main(), std::memory_order_release);
        return borrowed;
    }
};
}
#endif
