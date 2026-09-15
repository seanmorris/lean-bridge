from lean_iris import array_u32, echo_nat, echo_text, echo_u32

assert echo_u32(42) == 42
assert echo_nat(2**4096 + 1) == 2**4096 + 1
assert echo_text("Lean λ\0") == "Lean λ\0"
assert array_u32([0, 2**32 - 1]) == (0, 2**32 - 1)

print("42; exact integers and copied arrays")
