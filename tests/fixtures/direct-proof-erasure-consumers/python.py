from lean_directprooferasure import keep

checks = 0
for value in range(1005):
    assert keep(value) == value
    checks += 1
print(f"direct-proof-python:{checks}")
