#include "structured.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::structured;

int main() {
    const api::Tree input = api::TreeBranch{{api::TreeLeaf{42}}};
    const auto output = api::call_recursive(input, [](api::Tree value) {
        auto &children = std::get<api::TreeBranch>(value.value).children;
        std::get<api::TreeLeaf>(children.at(0).value).value += 1;
        return value;
    });
    const api::Tree expected = api::TreeBranch{{api::TreeLeaf{43}}};
    assert(output == expected && input != output);
    auto choose = api::make_recursive(output);
    assert(choose.call(true, input) == expected);
    assert(choose.call(false, input) == input);
    std::cout << "43\n";
}
