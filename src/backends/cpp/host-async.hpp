// Per-binding ownership for the existing C++ task dispatcher. A future never
// keeps its originating Binding alive just because nobody has awaited it yet.
#ifndef LEAN_BRIDGE_CPP_HOST_ASYNC_V1_HPP
#define LEAN_BRIDGE_CPP_HOST_ASYNC_V1_HPP
#include <lean_bridge/async_v2/task-routine.hpp>
#include <lean_bridge/async_v2/task-callback.hpp>
#include <algorithm>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <utility>
#include <vector>

namespace lean_bridge::host_async_v1 {
namespace av = ::lean_bridge::async_v2;
struct StepIOError : av::IOError { using av::IOError::IOError; };
inline bool utf8(const unsigned char *p, std::size_t n) noexcept {
    for (std::size_t i=0; i<n;) {
        unsigned a=p[i++]; if (a<128) continue;
        unsigned count=a<224?1:a<240?2:3;
        if (a<194 || a>244 || count>n-i) return false;
        unsigned b=p[i];
        if ((a==224 && b<160)||(a==237 && b>=160)||(a==240 && b<144)||(a==244 && b>=144)) return false;
        while (count--) if ((p[i++]&192)!=128) return false;
    }
    return true;
}
template<class D> void remember(D& out, const std::exception& e) {
    const char *msg=e.what(); std::size_t len=0;
    if (msg) while (len<4096 && msg[len]) ++len;
    if (!msg || len==4096 || !utf8(reinterpret_cast<const unsigned char*>(msg),len)) {
        msg="C++ callback exception"; len=std::strlen(msg);
    }
    auto exception=std::make_unique<std::exception_ptr>(std::current_exception());
    auto *text=len?static_cast<std::uint8_t*>(std::malloc(len)):nullptr;
    if (len && !text) throw std::bad_alloc{};
    if (len) std::memcpy(text,msg,len);
    out.message={text,len}; out.payload=exception.release();
    out.dispose_payload=[](void *v){delete static_cast<std::exception_ptr*>(v);};
}
template<class F> struct Callback {
    F fn; std::shared_ptr<bool> trapped;
    static void dispose(void *p) noexcept { delete static_cast<Callback*>(p); }
};
class Group {
    std::vector<std::weak_ptr<av::detail::Control>> jobs_;
    bool closed_ = false;
    void track(const std::shared_ptr<av::detail::Control>& job) {
        if (closed_) throw av::Closed{};
        jobs_.erase(std::remove_if(jobs_.begin(), jobs_.end(), [](auto& ref) {
            auto p = ref.lock(); return !p || !p->live();
        }), jobs_.end());
        jobs_.emplace_back(job);
    }
public:
    Group() = default;
    Group(const Group&) = delete;
    void close() noexcept {
        if (std::exchange(closed_, true)) return;
        // Reentrant cancellation may destroy another handle or a callback.
        // Detach the weak list before running any application code.
        auto pending = std::move(jobs_);
        for (auto& ref : pending) if (auto job = ref.lock()) job->cancel_here();
    }
    template<class T, class Poll, class Take, class Close>
    av::Future<T> future(Poll poll, Take take, Close close_job,
                         int callback_fd = -1, std::function<void()> service = {}) {
        auto p = std::make_shared<av::detail::Pending<T>>(av::detail::Loop::main(),
            std::move(poll), std::move(take), std::move(close_job), callback_fd, std::move(service));
        try { track(p); p->arm(); }
        catch (...) { p->cancel_here(); throw; }
        return av::Future<T>(std::move(p));
    }
    template<class T, class Pull, class Poll, class Take, class Close>
    av::Stream<T> stream(Pull pull, Poll poll, Take take, Close close_job) {
        auto p = std::make_shared<av::detail::Cursor<T>>(av::detail::Loop::main(),
            std::move(pull), std::move(poll), std::move(take), std::move(close_job));
        try { track(p); }
        catch (...) { p->cancel_here(); throw; }
        return av::Stream<T>(std::move(p));
    }
};
// Used only inside generated wrappers. Allocation/registration failure after
// a successful start closes that exact native handle on the owner thread.
template<class H, auto Close> struct Port {
    H handle{};
    Port() = default;
    Port(const Port&) = delete;
    void close() noexcept { (void)Close(&handle); }
    ~Port() { close(); }
};
}
#endif
