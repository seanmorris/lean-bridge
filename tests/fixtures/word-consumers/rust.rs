use platform_words as api;
fn main() {
    let us: Vec<u64> = vec![0, 1, u32::MAX as u64, 9007199254740993, u64::MAX];
    let ss: Vec<i64> = vec![i64::MIN, -9007199254740993, -1, 0, i64::MAX];
    let mut checks = 0;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let _: fn(u64) -> Result<u64, api::Error> = api::keep_unsigned;
    let _: fn(i64) -> Result<i64, api::Error> = api::keep_signed;
    check!(api::word_bits().unwrap() == 64);
    for (&u, &s) in us.iter().zip(ss.iter()) {
        check!(api::keep_unsigned(u).unwrap() == u);
        check!(api::keep_signed(s).unwrap() == s);
        check!(api::unsigned_text(u).unwrap() == u.to_string());
        check!(api::signed_text(s).unwrap() == s.to_string());
        check!(api::advance_unsigned(u).unwrap() == u.wrapping_add(1));
        check!(api::advance_signed(s).unwrap() == s.wrapping_add(1));
    }
    for _ in 0..1000 {
        let out = api::keep_sample(&api::Sample { natural: u64::MAX, integer: i64::MIN, unsigned_values: us.clone(), signed_values: ss.clone() }).unwrap();
        check!(out.natural == u64::MAX && out.integer == i64::MIN);
        check!(out.unsigned_values == us && out.signed_values == ss);
        check!(api::keep_unsigned_values(&us).unwrap() == us);
        check!(api::keep_signed_values(&ss).unwrap() == ss);
        check!(api::keep_unsigned_rows(&[us.clone(), vec![]]).unwrap() == vec![us.clone(), vec![]]);
        check!(api::keep_signed_rows(&[ss.clone(), vec![]]).unwrap() == vec![ss.clone(), vec![]]);
    }
    println!("word-ok:{checks}");
}
