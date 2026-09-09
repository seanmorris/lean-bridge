#include <lean_alpha.hpp>
#include <iostream>
#include <stdexcept>

void require(bool condition) {
    if (!condition) throw std::runtime_error("Unexpected Alpha result");
}

int main() {
    try {
        using namespace lean_bridge::alpha;
        Box box{42};
        require(box.read() == 42 && &box.identity() == &box);
        const Payload input{true, 41, "Lean λ", {0, 255}, {0, UINT32_MAX}};
        const auto value = round_trip(input);
        require(!value.enabled && value.count == 42);
        require(value.label == input.label && value.bytes == input.bytes);
        require(value.values == input.values);
        require(with_callback(40, [](std::uint32_t current) { return current + 2; }) == 44);
        auto add_two = make_adder(2);
        require(add_two(40) == 42);
        add_two.close();
        box.close();
        box.close();
        require(box.closed() && add_two.closed());
        std::cout << "Box: 42; payload: 42; callback: 44; closure: 42\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
