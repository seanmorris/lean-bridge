  {
    const unsigned late_before = checks;
    std::vector<std::string> late_names = {"alpha", std::string("mid\0dle", 7), "omega"};
    const auto saved_names = late_names;
    std::vector<Nat> late_offsets = {1, 2, 3}, saved_offsets = late_offsets;
    for (unsigned i = 0; i < 3; ++i) {
      unsigned at = i == 1 ? 5 : 0;
      late_names[i][at] ^= 1; CHECK(late_names != saved_names); late_names[i][at] ^= 1;
      ++late_offsets[i]; CHECK(late_offsets != saved_offsets); --late_offsets[i];
    }
    CHECK(late_names == saved_names); CHECK(late_offsets == saved_offsets);
    // Nine position/value combinations, then 1,000 rejection/recovery pairs.
    for (unsigned cycle = 0; cycle < 1009; ++cycle) {
      unsigned position = cycle % 3, representation = (cycle / 3) % 3;
      late_offsets = {1, 2, 3};
      late_offsets[position] = representation == 2 ? Nat(1) << 70 : Nat(4 + representation);
      saved_offsets = late_offsets;
      CHECK(rejected([&] { api::label(late_names, late_offsets); }, "arg1[" + std::to_string(position) + "] is not below its Fin 4 bound"));
      CHECK(late_names == saved_names); CHECK(late_offsets == saved_offsets);
      late_offsets = {1, 2, 3}; saved_offsets = late_offsets;
      const char result[] = "alpha:1,mid\0dle:2,omega:3";
      CHECK(api::label(late_names, late_offsets) == std::string(result, sizeof(result) - 1));
      CHECK(late_names == saved_names); CHECK(late_offsets == saved_offsets);
    }
    CHECK(checks - late_before == 6062);
  }
