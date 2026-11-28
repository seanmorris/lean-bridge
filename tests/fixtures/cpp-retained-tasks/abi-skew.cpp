// Exercise both header search orders and both include orders against real, independent releases.
#ifdef OLDER_FIRST
#include <lbc_pulse.hpp>
#include <lbc_cpp_retained.hpp>
#else
#include <lbc_cpp_retained.hpp>
#include <lbc_pulse.hpp>
#endif
#include <type_traits>
namespace older = lean_bridge::lbc_pulse;
namespace current = lean_bridge::lbc_cpp_retained;
static_assert(!std::is_same_v<older::Future<void>, current::Future<void>>);
int main() {
    older::io_task(false).get();
    return current::repeat_call("x", [](std::string s) {
        older::io_task(false).get(); return s + "!";
    }).get() == "x!!" ? 0 : 1;
}
