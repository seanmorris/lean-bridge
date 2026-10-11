use checkedrecords as api;
use api::BigUint;
fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |value: u64| BigUint::from(value);
    let big = BigUint::from(1u8) << 100usize;
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
