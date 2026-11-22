// Value and exception vocabulary shared by synchronous C++ packages. No dispatcher.
#ifndef LEAN_BRIDGE_CPP_SYNC_VALUES_V1_HPP
#define LEAN_BRIDGE_CPP_SYNC_VALUES_V1_HPP
#include <cstdint>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

namespace lean_bridge::sync_v1 {
template<class T> struct Ok { T value; friend bool operator==(const Ok&, const Ok&) = default; };
template<class E> struct Err { E value; friend bool operator==(const Err&, const Err&) = default; };
template<class T, class E> using Result = std::variant<Ok<T>, Err<E>>;
struct IOError : std::runtime_error {
    std::string declaration, message;
    IOError(std::string_view d, std::string v) : runtime_error(v), declaration(d), message(std::move(v)) {}
};
template<class E> struct DeclaredError : std::runtime_error {
    std::string declaration; E payload;
    DeclaredError(std::string_view d, E v) : runtime_error("Lean EIO call failed"), declaration(d), payload(std::move(v)) {}
};
struct WrongContext : std::logic_error { WrongContext() : logic_error("Lean call requires its original process main thread") {} };
struct Unavailable : std::runtime_error { Unavailable() : runtime_error("Lean runtime is unavailable") {} };
struct Busy : std::logic_error { Busy() : logic_error("Lean value is busy") {} };
struct Closed : std::logic_error { Closed() : logic_error("Lean resource is closed") {} };
}
#endif
