  /* Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field. */
  const Nat array_wide = Nat(1) << 70;
  const api::ArrayBox array_in{std::vector<Nat>{1, array_wide, 3}, 3};
  const api::ArrayBox pushed = api::push_count(array_in);
  CHECK(pushed.value == std::vector<Nat>({1, array_wide, 3, 3}) && pushed.count == 4);
  CHECK(array_in.value == std::vector<Nat>({1, array_wide, 3}) && array_in.count == 3);
  const api::ArrayBox pushed_empty = api::push_count(api::ArrayBox{std::vector<Nat>{}, 0});
  CHECK(pushed_empty.value == std::vector<Nat>({0}) && pushed_empty.count == 1);
  const api::BoxRow row{api::NatBox{2, 3}, api::NatBox{array_wide, 1}, api::NatBox{0, 5}};
  const Nat row_expected = array_wide + 6;
  CHECK(api::row_total(row) == row_expected && api::row_total(api::BoxRow{}) == 0);
  CHECK(row.size() == 3 && row[0] == (api::NatBox{2, 3}) && row[1] == (api::NatBox{array_wide, 1}) && row[2] == (api::NatBox{0, 5}));
  const api::BoxRow made = api::row_of(3);
  CHECK(made.size() == 3 && made[0] == (api::NatBox{0, 3}) && made[2] == (api::NatBox{2, 3}) && api::row_total(made) == 9);
  CHECK(api::row_of(0).empty());
  CHECK(api::row_box_sum(api::RowBox{row, 4}) == row_expected && api::row_box_sum(api::RowBox{api::BoxRow{}, 9}) == 9);
  /* A negative Nat member at the first, middle and last position is the generated API's invalid argument; the caller's input is unchanged and the next valid call succeeds. */
  const auto array_rejected = [](auto call) {
    try { call(); } catch (const api::Error& failure) { return failure.status == GENERICRECORDS_STATUS_INVALID_ARGUMENT && failure.code == GENERICRECORDS_ERROR_INVALID_ARGUMENT; }
    return false;
  };
  for (unsigned position = 0; position < 3; ++position) {
    api::ArrayBox negative = array_in; negative.value[position] = -1;
    CHECK(array_rejected([&] { (void)api::push_count(negative); }) && negative.value[position] == -1 && negative.value.size() == 3 && negative.count == 3);
    negative.value[position] = array_in.value[position];
    CHECK(api::push_count(negative) == pushed);
    for (unsigned field = 0; field < 2; ++field) {
      api::BoxRow broken = row; (field ? broken[position].count : broken[position].value) = -1;
      CHECK(array_rejected([&] { (void)api::row_total(broken); }) && (field ? broken[position].count : broken[position].value) == -1);
      const api::RowBox broken_box{broken, 4};
      CHECK(array_rejected([&] { (void)api::row_box_sum(broken_box); }) && broken_box.value == broken && broken_box.count == 4);
      CHECK(api::row_total(row) == row_expected && api::row_box_sum(api::RowBox{row, 4}) == row_expected);
    }
  }
  /* A negative count beside an Array field is refused too. */
  CHECK(array_rejected([&] { (void)api::push_count(api::ArrayBox{array_in.value, -1}); }));
  CHECK(array_rejected([&] { (void)api::row_box_sum(api::RowBox{row, -1}); }));
  /* One thousand Array rounds: a rejected member, then valid Array input and result calls. */
  for (unsigned r = 0; r < 1000; ++r) {
    const unsigned position = r % 3, size = r % 4;
    api::ArrayBox round_box{array_in.value, r};
    round_box.value[position] = -1;
    bool failed = !array_rejected([&] { (void)api::push_count(round_box); });
    round_box.value[position] = array_in.value[position];
    const api::ArrayBox round_pushed = api::push_count(round_box);
    failed = failed || round_pushed.value.size() != 4 || round_pushed.value[3] != r || round_pushed.count != r + 1;
    const api::BoxRow round_row = api::row_of(size);
    failed = failed || round_row.size() != size || api::row_total(round_row) != size * size * (size ? size - 1 : 0) / 2;
    failed = failed || api::row_box_sum(api::RowBox{round_row, r}) != r + size * (size ? size - 1 : 0) / 2;
    api::BoxRow broken = row; broken[position].value = -1;
    failed = failed || !array_rejected([&] { (void)api::row_box_sum(api::RowBox{broken, r}); });
    if (failed) { std::fprintf(stderr, "array round %u failed\n", r); return 1; }
  }
  checks += 1000;
