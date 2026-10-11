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
