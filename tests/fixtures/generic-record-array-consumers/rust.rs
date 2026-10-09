    // Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
    // BigUint cannot hold a negative member, so invalid Nat members do not typecheck; the crate's type-rejection controls run separately.
    let array_wide = n(1) << 70usize;
    let array_in = api::ArrayBox { value: vec![n(1), array_wide.clone(), n(3)], count: n(3) };
    let pushed: api::ArrayBox = api::push_count(&array_in).unwrap();
    check!(pushed.value == vec![n(1), array_wide.clone(), n(3), n(3)] && pushed.count == n(4));
    check!(array_in.value == vec![n(1), array_wide.clone(), n(3)] && array_in.count == n(3));
    let pushed_empty = api::push_count(&api::ArrayBox { value: vec![], count: n(0) }).unwrap();
    check!(pushed_empty == api::ArrayBox { value: vec![n(0)], count: n(1) });
    let row: api::BoxRow = vec![api::NatBox { value: n(2), count: n(3) }, api::NatBox { value: array_wide.clone(), count: n(1) }, api::NatBox { value: n(0), count: n(5) }];
    let row_expected = array_wide.clone() + n(6);
    check!(api::row_total(&row).unwrap() == row_expected && api::row_total(&[]).unwrap() == n(0));
    check!(row.len() == 3 && row[1] == api::NatBox { value: array_wide.clone(), count: n(1) });
    let made: api::BoxRow = api::row_of(&n(3)).unwrap();
    check!(made == vec![api::NatBox { value: n(0), count: n(3) }, api::NatBox { value: n(1), count: n(3) }, api::NatBox { value: n(2), count: n(3) }] && api::row_total(&made).unwrap() == n(9));
    check!(api::row_of(&n(0)).unwrap().is_empty());
    check!(api::row_box_sum(&api::RowBox { value: row.clone(), count: n(4) }).unwrap() == row_expected);
    check!(api::row_box_sum(&api::RowBox { value: vec![], count: n(9) }).unwrap() == n(9) && api::row_box_sum(&api::RowBox { value: made, count: n(0) }).unwrap() == n(3));
    // One thousand Array rounds: valid Array input and result calls, each result owned and dropped.
    for r in 0..1000u64 {
        let size = r % 4;
        let triangle = n(size * size.saturating_sub(1) / 2);
        let round_pushed = api::push_count(&api::ArrayBox { value: vec![n(1), array_wide.clone(), n(3)], count: n(r) }).unwrap();
        let round_row = api::row_of(&n(size)).unwrap();
        let round_ok = round_pushed.value.len() == 4 && round_pushed.value[3] == n(r) && round_pushed.count == n(r + 1) && round_row.len() as u64 == size
            && api::row_total(&round_row).unwrap() == n(size) * triangle.clone() && api::row_box_sum(&api::RowBox { value: round_row, count: n(r) }).unwrap() == n(r) + triangle;
        assert!(round_ok, "array round {r} failed");
    }
    checks += 1000;
