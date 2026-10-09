use genericrecords as api;
use api::BigUint;

fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    // Each alias is its own struct with the structure's fields instantiated; Nat fields are big integers.
    let input = api::NatBox { value: n(4), count: n(1) };
    let bumped = api::bump(&input).unwrap();
    check!(bumped.value == n(5) && bumped.count == n(2) && input.value == n(4));
    let again = api::again(&api::NatBoxAgain { value: n(4), count: n(1) }).unwrap();
    check!(again.value == n(8) && again.count == n(1));
    // Two aliases of one application are two distinct types with the same layout.
    let _: fn(&api::NatBox) -> Result<api::NatBox, api::Error> = api::bump;
    let _: fn(&api::NatBoxAgain) -> Result<api::NatBoxAgain, api::Error> = api::again;
    let greeting = "h\u{e9}llo \u{1F642}";
    let shouted = api::shout(&api::TextBox { value: greeting.into(), count: n(3) }).unwrap();
    check!(shouted.value == format!("{greeting}!") && shouted.count == n(3));
    let swapped = api::swap_named(&api::WordPair { first: "a".into(), second: n(1) }).unwrap();
    check!(swapped.first == "a!" && swapped.second == n(2));
    // A parameter instantiated with Option Nat and a List of a named instantiation.
    check!(api::or_zero(&api::MaybeBox { value: Some(n(5)), count: n(2) }).unwrap() == n(7));
    check!(api::or_zero(&api::MaybeBox { value: None, count: n(2) }).unwrap() == n(2));
    let boxes: api::Boxes = vec![api::NatBox { value: n(1), count: n(0) }, api::NatBox { value: n(2), count: n(0) }, api::NatBox { value: n(1) << 70usize, count: n(0) }];
    check!(api::total(&boxes).unwrap() == (n(1) << 70usize) + n(3));
    check!(api::total(&[]).unwrap() == n(0));
    let first: Option<api::Boxes> = api::first_boxes(&n(2)).unwrap();
    check!(first.as_ref().map(|items| items.len() == 2 && items[1].value == n(1) && items[1].count == n(2)) == Some(true));
    check!(api::first_boxes(&n(0)).unwrap().is_none());
    // A pair of two named instantiations.
    check!(api::unpair(&api::BoxPair { first: api::NatBox { value: n(3), count: n(0) }, second: api::TextBox { value: "abcd".into(), count: n(0) } }).unwrap() == n(7));
    // A universe-polymorphic structure instantiated at Type.
    let retagged = api::retag(&api::TaggedNat { tag: "t".into(), payload: n(1) }).unwrap();
    check!(retagged.tag == "t#" && retagged.payload == n(2));
    // A phantom argument: the instantiation names Marker, which no field carries.
    check!(api::relabel(&api::MarkerTag { label: "m".into() }).unwrap().label == "m?");
    for i in 0..1000u64 {
        let round = api::bump(&api::NatBox { value: n(i), count: n(i) }).unwrap();
        assert!(round.value == n(i + 1) && round.count == n(i + 1), "round {i} failed");
    }
    checks += 1000;
    println!("generic-records-ok:{checks}");
}
