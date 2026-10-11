use checkedrecords as api;
use api::BigUint;
// BEGIN CHECKED INPUT HELPERS
fn rejected<T>(result: Result<T, api::Error>, message: &str) -> bool {
    matches!(result, Err(api::Error::Native { code: 1, message: actual }) if actual == message)
}
// END CHECKED INPUT HELPERS
fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    let big = BigUint::from(1u8) << 100usize;
    // BEGIN CHECKED INPUT CASES
    let good = api::Interval { lo: n(3), hi: n(10) };
    let bad = api::Interval { lo: n(9), hi: n(3) };
    let triple = api::Triple { data: vec![n(9), n(2), n(4)] };
    check!(api::width(&good).unwrap() == n(7));
    check!(api::width(&api::Interval { lo: n(1), hi: n(1) }).unwrap() == n(0));
    check!(api::width(&api::Interval { lo: big.clone(), hi: &big + n(9) }).unwrap() == n(9));
    check!(api::span(&good, &api::Interval { lo: n(5), hi: n(20) }).unwrap() == n(17));
    check!(rejected(api::width(&bad), "arg0 was rejected by CheckedRecords.mkInterval"));
    check!(rejected(api::span(&bad, &good), "arg0 was rejected by CheckedRecords.mkInterval"));
    check!(rejected(api::span(&good, &bad), "arg1 was rejected by CheckedRecords.mkInterval"));
    check!(api::total(&triple).unwrap() == n(15));
    check!(api::first_of(&triple).unwrap() == n(9));
    check!(api::smallest(&triple).unwrap() == n(2));
    check!(triple.data == vec![n(9), n(2), n(4)]);
    check!(api::scale(&n(3), &triple).unwrap().data == vec![n(27), n(6), n(12)]);
    check!(triple.data == vec![n(9), n(2), n(4)]);
    check!(rejected(api::total(&api::Triple { data: vec![] }), "arg0 was rejected by CheckedRecords.mkTriple"));
    check!(rejected(api::first_of(&api::Triple { data: vec![n(1), n(2)] }), "arg0 was rejected by CheckedRecords.mkTriple"));
    check!(rejected(api::smallest(&api::Triple { data: vec![n(4), n(3), n(2), n(1)] }), "arg0 was rejected by CheckedRecords.sortedTriple"));
    check!(rejected(api::scale(&n(3), &api::Triple { data: vec![n(1), n(2)] }), "arg1 was rejected by CheckedRecords.mkTriple"));
    check!(api::complement(&api::Percent { value: n(0) }).unwrap() == n(100));
    check!(api::complement(&api::Percent { value: n(100) }).unwrap() == n(0));
    check!(rejected(api::complement(&api::Percent { value: n(101) }), "arg0 was rejected by CheckedRecords.mkPercent"));
    check!(rejected(api::complement(&api::Percent { value: big.clone() }), "arg0 was rejected by CheckedRecords.mkPercent"));
    for i in 0..1000u64 {
        check!(rejected(api::width(&api::Interval { lo: n(i + 1), hi: n(i) }), "arg0 was rejected by CheckedRecords.mkInterval"));
        check!(api::width(&api::Interval { lo: n(i), hi: n(i + 7) }).unwrap() == n(7));
        check!(rejected(api::total(&api::Triple { data: vec![n(1), n(2)] }), "arg0 was rejected by CheckedRecords.mkTriple"));
        check!(api::total(&triple).unwrap() == n(15));
        check!(rejected(api::smallest(&api::Triple { data: vec![n(4), n(3), n(2), n(1)] }), "arg0 was rejected by CheckedRecords.sortedTriple"));
        check!(api::smallest(&triple).unwrap() == n(2));
        check!(rejected(api::complement(&api::Percent { value: n(101) }), "arg0 was rejected by CheckedRecords.mkPercent"));
        check!(api::complement(&api::Percent { value: n(100) }).unwrap() == n(0));
    }
    check!(triple.data == vec![n(9), n(2), n(4)] && good.lo == n(3) && good.hi == n(10) && bad.lo == n(9) && bad.hi == n(3));
    // END CHECKED INPUT CASES
    check!(api::repeated(&big).unwrap().data == vec![big.clone(), big.clone(), big.clone()]);
    let mut first = api::repeated(&n(7)).unwrap();
    let second = api::repeated(&n(7)).unwrap();
    first.data[0] = n(99);
    check!(second.data == vec![n(7), n(7), n(7)]);
    for i in 0..1000u64 {
        check!(api::repeated(&n(i)).unwrap().data == vec![n(i), n(i), n(i)]);
    }
    println!("checked-record-ok:{checks}");
}
