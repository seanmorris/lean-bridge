#include <lbc_companions.hpp>
#include <cassert>
int main() {
    namespace api = lean_bridge::lbc_companions;
    assert(api::plain(41) == 42 && api::bump(3) == 3);
    assert(api::doubled(21).get() == 42);
    assert(api::bump(4) == 7);
    api::finish("state");
}
