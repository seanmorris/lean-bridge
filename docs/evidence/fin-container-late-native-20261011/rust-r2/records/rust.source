use fincontainers as api;
use api::{BigUint, Error};

fn rejected<T>(result: Result<T, Error>, parameter: &str, bound: &str) -> bool {
    match result {
        Err(Error::Native { code: 1, message }) => message == format!("{parameter} is not below its Fin {bound} bound"),
        _ => false,
    }
}

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    let huge = BigUint::from(1u8) << 70usize;
    let word = BigUint::from(1u8) << 32usize;
    let digits: Vec<BigUint> = (0..10u64).map(n).collect();
    // Array (Fin 10): every element is checked; results stay below the bound.
    check!(api::mirror_all(&digits).unwrap() == (0..10u64).map(|i| n(9 - i)).collect::<Vec<_>>());
    check!(api::mirror_all(&[]).unwrap().is_empty());
    for position in 0..3 {
        let mut bad = vec![n(1), n(2), n(3)];
        bad[position] = n(10);
        check!(rejected(api::mirror_all(&bad), &format!("arg0[{position}]"), "10"));
        check!(bad[position] == n(10));
    }
    check!(rejected(api::mirror_all(&[word.clone(), n(1), n(2)]), "arg0[0]", "10"));
    // Array (Fin 0): only the empty array has values.
    check!(api::count_none(&[]).unwrap() == n(0));
    check!(rejected(api::count_none(&[n(0)]), "arg0[0]", "0"));
    // List Huge: a 2^70 bound compared limb by limb.
    let last = &huge - 1u8;
    check!(api::sum_huge(&[word.clone(), last.clone()]).unwrap() == &word + &last);
    check!(api::sum_huge(&[]).unwrap() == n(0));
    check!(rejected(api::sum_huge(&[word.clone(), huge.clone()]), "arg0[1]", &huge.to_string()));
    // Option (Fin 1): none is valid; a present value is checked.
    check!(api::or_default(&None).unwrap() == n(7) && api::or_default(&Some(n(0))).unwrap() == n(0));
    check!(rejected(api::or_default(&Some(n(1))), "arg0?", "1"));
    // Array (Option Digit): only present elements are checked.
    let mut mixed = vec![Some(n(1)), None, Some(n(9))];
    check!(api::present(&mixed).unwrap() == vec![n(1), n(9)]);
    mixed[2] = Some(n(10));
    check!(rejected(api::present(&mixed), "arg0[2]?", "10"));
    mixed[2] = None;
    check!(api::present(&mixed).unwrap().len() == 1);
    // List (Array Digit) -> Option (List Digit): nested rows.
    let mut rows = vec![vec![n(1), n(2)], vec![n(3)]];
    check!(api::flatten(&rows).unwrap() == Some(vec![n(1), n(2), n(3)]));
    check!(api::flatten(&[]).unwrap().is_none());
    rows[1][0] = n(10);
    check!(rejected(api::flatten(&rows), "arg0[1][0]", "10"));
    // A late refined argument after an unrefined one.
    let names = ["a".to_string(), "b".to_string()];
    check!(api::label(&names, &[n(1), n(3)]).unwrap() == "a:1,b:3");
    check!(rejected(api::label(&names, &[n(1), n(4)]), "arg1[1]", "4"));
    check!(names[1] == "b");
    // A result-only container refinement projects each element after Lean returns.
    check!(api::wrap_all(&[n(100), huge.clone()]).unwrap() == vec![n(2), n(2)]);
    check!(api::wrap_all(&[]).unwrap().is_empty());
    // Repeated invalid and valid calls recover without retiring the runtime.
    for i in 0..1000u64 {
        assert!(rejected(api::mirror_all(&[n(10 + i % 5)]), "arg0[0]", "10"), "invalid call accepted at {i}");
        assert!(api::mirror_all(&[n(i % 10)]).unwrap() == vec![n(9 - i % 10)], "valid call failed at {i}");
    }
    checks += 2000;
    // VO #1454: all original checks still run before these additional cases.
    let edge_before = checks;
    check!(api::empty_array(&[]).unwrap().is_empty());
    check!(api::empty_list(&[]).unwrap().is_empty());
    check!(api::empty_option(&None).unwrap().is_none());
    for value in [n(0), n(1), n(1) << 70usize] {
        let input = vec![value.clone()];
        let option = Some(value.clone());
        check!(rejected(api::empty_array(&input), "arg0[0]", "0"));
        check!(rejected(api::empty_list(&input), "arg0[0]", "0"));
        check!(rejected(api::empty_option(&option), "arg0?", "0"));
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
        check!(rejected(api::present(&mixed), &format!("arg0[{position}]?"), "10"));
        check!(mixed == mixed_before);
        let optional = Some(values);
        check!(rejected(api::optional_digits(&optional), &format!("arg0?[{position}]"), "10"));
        check!(optional == Some(snapshot));
        // Every outer and inner position, not just the last row or member.
        for column in 0..3 {
            let mut table = vec![vec![n(1), n(2), n(3)], vec![n(4), n(5), n(6)], vec![n(7), n(8), n(9)]];
            table[position][column] = n(10);
            let before = table.clone();
            check!(rejected(api::flatten(&table), &format!("arg0[{position}][{column}]"), "10"));
            check!(table == before);
        }
    }
    check!(api::present(&[None, None, None]).unwrap().is_empty());
    check!(api::flatten(&[vec![], vec![], vec![]]).unwrap() == Some(vec![]));
    // BigUint cannot represent negative Nat values. Rust's typed Option and slices cannot represent
    // malformed tags or null/data-length pairs; raw-carrier checks belong to the separate C adapter gate.
    for _ in 0..1000 {
        check!(rejected(api::empty_array(&[n(0)]), "arg0[0]", "0"));
        check!(api::empty_array(&[]).unwrap().is_empty());
        check!(rejected(api::empty_list(&[n(0)]), "arg0[0]", "0"));
        check!(api::empty_list(&[]).unwrap().is_empty());
        check!(rejected(api::empty_option(&Some(n(0))), "arg0?", "0"));
        check!(api::empty_option(&None).unwrap().is_none());
        check!(rejected(api::present(&[Some(n(1)), Some(n(10)), None]), "arg0[1]?", "10"));
        check!(api::present(&[Some(n(1)), None, Some(n(9))]).unwrap() == vec![n(1), n(9)]);
        check!(rejected(api::flatten(&[vec![n(1)], vec![n(10)], vec![n(9)]]), "arg0[1][0]", "10"));
        check!(api::flatten(&[vec![n(1)], vec![], vec![n(9)]]).unwrap() == Some(vec![n(1), n(9)]));
        check!(rejected(api::optional_digits(&Some(vec![n(1), n(10), n(9)])), "arg0?[1]", "10"));
        check!(api::optional_digits(&Some(vec![n(1), n(9)])).unwrap() == Some(vec![n(1), n(9)]));
    }
    check!(checks - edge_before == 12050);

    {
        let late_before = checks;
        let mut late_names = vec!["alpha".to_string(), "mid\0dle".to_string(), "omega".to_string()];
        let saved_names = late_names.clone();
        let mut late_offsets = vec![n(1), n(2), n(3)];
        let mut saved_offsets = late_offsets.clone();
        for i in 0..3 {
            late_names[i].push('!'); check!(late_names != saved_names); late_names[i].pop();
            late_offsets[i] += 1u8; check!(late_offsets != saved_offsets); late_offsets[i] -= 1u8;
        }
        check!(late_names == saved_names); check!(late_offsets == saved_offsets);
        // Nine position/value combinations, then 1,000 rejection/recovery pairs.
        for cycle in 0..1009usize {
            let position = cycle % 3;
            let representation = (cycle / 3) % 3;
            late_offsets = vec![n(1), n(2), n(3)];
            late_offsets[position] = if representation == 2 { n(1) << 70usize } else { n(4 + representation as u64) };
            saved_offsets = late_offsets.clone();
            check!(rejected(api::label(&late_names, &late_offsets), &format!("arg1[{position}]"), "4"));
            check!(late_names == saved_names); check!(late_offsets == saved_offsets);
            late_offsets = vec![n(1), n(2), n(3)]; saved_offsets = late_offsets.clone();
            check!(api::label(&late_names, &late_offsets).unwrap() == "alpha:1,mid\0dle:2,omega:3");
            check!(late_names == saved_names); check!(late_offsets == saved_offsets);
        }
        check!(checks - late_before == 6062);
    }

    println!("fin-container-ok:{checks}");
}
