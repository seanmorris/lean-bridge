  {
    const unsigned edge_before = checks;
    const std::string edge_zero_error = "arg0 is not below its Fin 0 bound";
    const std::string edge_digit_error = "arg0 is not below its Fin 10 bound";
    CHECK(api::empty_array({}).empty());
    CHECK(api::empty_list({}).empty());
    CHECK(api::empty_option(std::nullopt) == std::nullopt);
    for (const Nat& value : std::vector<Nat>{0, 1, Nat(1) << 70}) {
      const std::vector<Nat> input = {value};
      const std::optional<Nat> option = value;
      CHECK(rejected([&] { api::empty_array(input); }, edge_zero_error));
      CHECK(rejected([&] { api::empty_list(input); }, edge_zero_error));
      CHECK(rejected([&] { api::empty_option(option); }, edge_zero_error));
      CHECK(input == std::vector<Nat>{value} && option == std::optional<Nat>{value});
    }
    CHECK(api::optional_digits(std::nullopt) == std::nullopt);
    CHECK(api::optional_digits(std::vector<Nat>{}) == std::optional<std::vector<Nat>>{std::vector<Nat>{}});
    CHECK(api::optional_digits(std::vector<Nat>{0, 9}) == std::optional<std::vector<Nat>>{std::vector<Nat>({0, 9})});
    for (unsigned position = 0; position < 3; ++position) {
      std::vector<Nat> input = {1, 2, 3}; input[position] = 10;
      const auto before = input;
      std::vector<std::optional<Nat>> mixed = {Nat(1), Nat(2), Nat(3)}; mixed[position] = Nat(10);
      const auto mixed_before = mixed;
      CHECK(rejected([&] { api::present(mixed); }, edge_digit_error));
      CHECK(mixed == mixed_before);
      CHECK(rejected([&] { api::optional_digits(input); }, edge_digit_error));
      CHECK(input == before);
      for (unsigned column = 0; column < 3; ++column) {
        std::vector<std::vector<Nat>> table = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
        table[position][column] = 10;
        const auto snapshot = table;
        CHECK(rejected([&] { api::flatten(table); }, edge_digit_error));
        CHECK(table == snapshot);
      }
    }
    CHECK(api::present({std::nullopt, std::nullopt, std::nullopt}).empty());
    CHECK(api::flatten({{}, {}, {}}) == std::optional<std::vector<Nat>>{std::vector<Nat>{}});
    /* C++ Nat uses signed cpp_int. Negative values must still be refused. */
    const auto edge_negative = [](auto call) {
      try { call(); }
      catch (const api::Error& failure) {
        return failure.status == FINCONTAINERS_STATUS_INVALID_ARGUMENT && failure.code == FINCONTAINERS_ERROR_INVALID_ARGUMENT
          && std::string(failure.what()) == "Nat must be nonnegative";
      }
      return false;
    };
    CHECK(edge_negative([&] { api::empty_array({Nat(-1)}); }));
    CHECK(edge_negative([&] { api::empty_list({Nat(-1)}); }));
    CHECK(edge_negative([&] { api::empty_option(Nat(-1)); }));
    for (unsigned position = 0; position < 3; ++position) {
      std::vector<Nat> input = {1, 2, 3}; input[position] = -1;
      const auto before = input;
      CHECK(edge_negative([&] { api::optional_digits(input); }));
      CHECK(input == before);
    }
    for (unsigned cycle = 0; cycle < 1000; ++cycle) {
      CHECK(rejected([&] { api::empty_array({0}); }, edge_zero_error));
      CHECK(api::empty_array({}).empty());
      CHECK(rejected([&] { api::empty_list({0}); }, edge_zero_error));
      CHECK(api::empty_list({}).empty());
      CHECK(rejected([&] { api::empty_option(Nat(0)); }, edge_zero_error));
      CHECK(api::empty_option(std::nullopt) == std::nullopt);
      CHECK(rejected([&] { api::present({Nat(1), Nat(10), std::nullopt}); }, edge_digit_error));
      CHECK(api::present({Nat(1), std::nullopt, Nat(9)}) == std::vector<Nat>({1, 9}));
      CHECK(rejected([&] { api::flatten({{1}, {10}, {9}}); }, edge_digit_error));
      CHECK(api::flatten({{1}, {}, {9}}) == std::optional<std::vector<Nat>>{std::vector<Nat>({1, 9})});
      CHECK(rejected([&] { api::optional_digits(std::vector<Nat>{1, 10, 9}); }, edge_digit_error));
      CHECK(api::optional_digits(std::vector<Nat>{1, 9}) == std::optional<std::vector<Nat>>{std::vector<Nat>({1, 9})});
    }
    CHECK(checks - edge_before == 12059);
  }
