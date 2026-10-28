use specialized as api;
use api::BigUint;

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    // Each specialization is an ordinary concrete function; no generic parameter is exposed.
    let _: fn(u32) -> Result<u32, api::Error> = api::echo_word;
    let _: fn(&str) -> Result<String, api::Error> = api::echo_text;
    let _: fn(&BigUint) -> Result<BigUint, api::Error> = api::echo_nat;
    let _: fn(bool, u32) -> Result<u32, api::Error> = api::choose_word;
    let _: fn(&str, u32) -> Result<String, api::Error> = api::first_text_word;
    let greeting = "h\u{e9}llo \u{1F642}";
    check!(api::echo_word(0).unwrap() == 0 && api::echo_word(u32::MAX).unwrap() == u32::MAX);
    check!(api::echo_text(greeting).unwrap() == greeting && api::echo_text("").unwrap().is_empty());
    let large = BigUint::from(1u8) << 200usize;
    check!(api::echo_nat(&large).unwrap() == large);
    let words: Vec<u32> = vec![0, 42, u32::MAX];
    check!(api::echo_words(&words).unwrap() == words);
    // Lean resolved each instance dictionary at build time.
    check!(api::choose_word(true, 5).unwrap() == 5 && api::choose_word(false, 5).unwrap() == 37);
    check!(api::choose_text(true, greeting).unwrap() == greeting && api::choose_text(false, greeting).unwrap().is_empty());
    check!(api::choose_words(true, &words).unwrap() == words && api::choose_words(false, &words).unwrap().is_empty());
    check!(api::double_word(2147483649).unwrap() == 2);
    check!(api::double_nat(&(BigUint::from(1u8) << 100usize)).unwrap() == BigUint::from(1u8) << 101usize);
    check!(api::first_text_word(greeting, 9).unwrap() == greeting);
    check!(api::plain(1).unwrap() == 4);
    for i in 0..1000u32 {
        check!(api::choose_word(i % 2 == 0, i).unwrap() == if i % 2 == 0 { i } else { 37 });
        check!(api::double_word(i).unwrap() == 2 * i);
    }
    println!("specialization-ok:{checks}");
}
