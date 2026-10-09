    // VO #1454: all original checks still run before these additional cases.
    let edge_before = checks;
    check!(api::empty_array(&[]).unwrap().is_empty());
    check!(api::empty_list(&[]).unwrap().is_empty());
    check!(api::empty_option(&None).unwrap().is_none());
    for value in [n(0), n(1), n(1) << 70usize] {
        let input = vec![value.clone()];
        let option = Some(value.clone());
        check!(rejected(api::empty_array(&input), "arg0", "0"));
        check!(rejected(api::empty_list(&input), "arg0", "0"));
        check!(rejected(api::empty_option(&option), "arg0", "0"));
        check!(input == vec![value.clone()] && option == Some(value));
    }
    // A present empty list remains distinct from an absent option.
    check!(api::optional_digits(&None).unwrap().is_none());
    check!(api::optional_digits(&Some(vec![])).unwrap() == Some(vec![]));
    check!(api::optional_digits(&Some(vec![n(0), n(9)])).unwrap() == Some(vec![n(0), n(9)]));
    for position in 0..3 {
        let mut values = vec![n(1), n(2), n(3)];
        values[position] = n(10);
        let snapshot = values.clone();
        let mixed: Vec<Option<BigUint>> = values.iter().cloned().map(Some).collect();
        let mixed_before = mixed.clone();
        check!(rejected(api::present(&mixed), "arg0", "10"));
        check!(mixed == mixed_before);
        let optional = Some(values);
        check!(rejected(api::optional_digits(&optional), "arg0", "10"));
        check!(optional == Some(snapshot));
        // Every outer and inner position, not just the last row or member.
        for column in 0..3 {
            let mut table = vec![vec![n(1), n(2), n(3)], vec![n(4), n(5), n(6)], vec![n(7), n(8), n(9)]];
            table[position][column] = n(10);
            let before = table.clone();
            check!(rejected(api::flatten(&table), "arg0", "10"));
            check!(table == before);
        }
    }
    check!(api::present(&[None, None, None]).unwrap().is_empty());
    check!(api::flatten(&[vec![], vec![], vec![]]).unwrap() == Some(vec![]));
    // BigUint cannot represent negative Nat values. Rust's typed Option and slices cannot represent
    // malformed tags or null/data-length pairs; raw-carrier checks belong to the separate C adapter gate.
    for _ in 0..1000 {
        check!(rejected(api::empty_array(&[n(0)]), "arg0", "0"));
        check!(api::empty_array(&[]).unwrap().is_empty());
        check!(rejected(api::empty_list(&[n(0)]), "arg0", "0"));
        check!(api::empty_list(&[]).unwrap().is_empty());
        check!(rejected(api::empty_option(&Some(n(0))), "arg0", "0"));
        check!(api::empty_option(&None).unwrap().is_none());
        check!(rejected(api::present(&[Some(n(1)), Some(n(10)), None]), "arg0", "10"));
        check!(api::present(&[Some(n(1)), None, Some(n(9))]).unwrap() == vec![n(1), n(9)]);
        check!(rejected(api::flatten(&[vec![n(1)], vec![n(10)], vec![n(9)]]), "arg0", "10"));
        check!(api::flatten(&[vec![n(1)], vec![], vec![n(9)]]).unwrap() == Some(vec![n(1), n(9)]));
        check!(rejected(api::optional_digits(&Some(vec![n(1), n(10), n(9)])), "arg0", "10"));
        check!(api::optional_digits(&Some(vec![n(1), n(9)])).unwrap() == Some(vec![n(1), n(9)]));
    }
    check!(checks - edge_before == 12050);
