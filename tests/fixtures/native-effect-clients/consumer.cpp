#include <lbc_effects.hpp>
#include <cassert>

int main() {
    namespace api = lean_bridge::lbc_effects;
    assert(api::read_boot() == "from-app");
    assert(api::observe("state") == 37 && api::worker("state").get() == 37);
    auto cursor = api::walk("state");
    assert(cursor.next().get() == 37);
    cursor.close();
    assert(api::observe("state") == 0);
}
