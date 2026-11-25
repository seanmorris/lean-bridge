// Shared, header-only ownership and exception support for synchronous C++ members.
#ifndef LEAN_BRIDGE_CPP_HOST_BINDING_V1_HPP
#define LEAN_BRIDGE_CPP_HOST_BINDING_V1_HPP
#include <lean_bridge/sync_v1/sync-values.hpp>
#include <atomic>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <limits>
#include <memory>
#include <typeinfo>
#include <type_traits>
#include <sys/syscall.h>
#include <unistd.h>

namespace lean_bridge::sync_v1::host_detail {
template<class F> struct Finally {
    F f; Finally(F action):f(std::move(action)) {} Finally(const Finally&)=delete;
    ~Finally() noexcept { f(); }
};
struct Pending {
    Pending *next=nullptr; pid_t pid=getpid(); void (*dispose)(Pending*) noexcept=nullptr;
};
inline constinit std::atomic<Pending*> pending{nullptr};
inline bool owner() noexcept { return getpid()==static_cast<pid_t>(syscall(SYS_gettid)); }
inline void retire(Pending *p) noexcept {
    if(p->pid!=getpid()) return; // Never run the parent's Lean/C++ destructors in a forked child.
    if(owner()) { p->dispose(p); return; }
    p->next=pending.load(std::memory_order_relaxed);
    while(!pending.compare_exchange_weak(p->next,p,std::memory_order_release,std::memory_order_relaxed)) {}
}
inline void drain() {
    if(!owner()) throw WrongContext{};
    for(auto *p=pending.exchange(nullptr,std::memory_order_acquire);p;) {
        auto *next=p->next; if(p->pid==getpid()) p->dispose(p); p=next;
    }
}
struct Frame {
    Frame *&slot,*parent; std::vector<std::exception_ptr> faults;
    std::exception_ptr overflow;
    explicit Frame(Frame *&s) : slot(s),parent(s) {slot=this;}
    ~Frame() {slot=parent;}
    uint32_t remember() noexcept {
        auto p=std::current_exception();
        try {
            if(faults.size()>=UINT32_MAX-1) throw std::length_error("too many nested member failures");
            faults.push_back(std::move(p)); return static_cast<uint32_t>(faults.size());
        } catch(...) {overflow=std::current_exception(); return UINT32_MAX;}
    }
    [[noreturn]] void rethrow(uint32_t id) const {
        if(id==UINT32_MAX && overflow) std::rethrow_exception(overflow);
        if(!id || id>faults.size()) throw Unavailable{};
        std::rethrow_exception(faults[id-1]);
    }
};
inline void registry(int rc) {
    if(!rc) return;
    if(rc==1) throw std::invalid_argument("incompatible C++ host type, object or ownership");
    if(rc==2) throw Closed{};
    if(rc==3) throw std::length_error("C++ host owner budget exceeded");
    throw Unavailable{};
}
template<class V> std::string text(const V& v) {
    return v.len?std::string(reinterpret_cast<const char*>(v.data),v.len):std::string{};
}
template<class V> std::vector<uint8_t> bytes(const V& v) {
    return v.len?std::vector<uint8_t>(v.data,v.data+v.len):std::vector<uint8_t>{};
}
template<class Dest,class Src> void copy_to(Dest &out,const Src &v) {
    using Elem=std::remove_pointer_t<decltype(out.data)>;
    if(v.size()>16u*1024u*1024u/sizeof(Elem)) throw std::length_error("C++ host copy budget exceeded");
    out.data=v.empty()?nullptr:static_cast<Elem*>(std::malloc(v.size()*sizeof(Elem)));
    if(!v.empty() && !out.data) throw std::bad_alloc{};
    if(!v.empty()) std::memcpy(out.data,v.data(),v.size()*sizeof(Elem));
    out.len=v.size();
}
}
namespace lean_bridge::sync_v1 {
// Off-thread destruction is deferred; any later owner entry also drains it.
inline void drain_host_closes() {host_detail::drain();}
}
#endif
