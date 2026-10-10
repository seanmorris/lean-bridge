use finrecordzero as api;
use api::{BigUint, Error, Fields, Zero};
fn fields(member: &str, digit: BigUint) -> Fields {
    Fields { label: "kept".to_string(), payload: vec![BigUint::from(7u32), BigUint::from(1u32) << 100usize],
        array: if member == "array" { vec![digit.clone()] } else { vec![] },
        list: if member == "list" { vec![digit] } else { vec![] } }
}
fn rejected<T>(result: Result<T, Error>, path: &str) -> bool {
    matches!(result, Err(Error::Native { code: 1, message }) if message == format!("{path} is not below its Fin 0 bound"))
}
fn main() {
    let mut checks = 0usize;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    let n = |x: u64| BigUint::from(x);
    let fresh = || fields("", n(0));
    type Records = fn(&[Zero]) -> Result<Vec<Zero>, Error>;
    for call in [api::array_records as Records, api::list_records as Records] {
        check!(call(&[]).unwrap().is_empty());
        for digit in [n(0), n(1), n(1) << 100usize] {
            let value = vec![Zero { digit: digit.clone() }];
            let before = vec![Zero { digit }];
            check!(rejected(call(&value), "arg0[0].digit") && value == before);
        }
        check!(call(&[]).unwrap().is_empty());
    }
    check!(api::field_collections(&fresh()).unwrap() == fresh());
    for member in ["array", "list"] { for digit in [n(0), n(1), n(1) << 100usize] {
        let value = fields(member, digit.clone()); let before = fields(member, digit);
        check!(rejected(api::field_collections(&value), &format!("arg0.{member}[0]")) && value == before);
    } }
    check!(api::field_collections(&fresh()).unwrap() == fresh());
    type Rows = fn(&[Fields]) -> Result<Vec<Fields>, Error>;
    for call in [api::array_fields as Rows, api::list_fields as Rows] {
        let row = || vec![fresh(), fresh(), fresh()];
        check!(call(&[]).unwrap().is_empty());
        check!(call(&row()).unwrap() == row());
        for index in 0..3 { for member in ["array", "list"] {
            let mut value = row(); value[index] = fields(member, n(0));
            let mut before = row(); before[index] = fields(member, n(0));
            check!(rejected(call(&value), &format!("arg0[{index}].{member}[0]")) && value == before);
            check!(call(&row()).unwrap() == row());
        } }
    }
    for index in 0..1000u64 {
        check!(api::field_collections(&fresh()).unwrap() == fresh());
        let member = if index % 2 == 0 { "array" } else { "list" };
        let value = fields(member, n(index)); let before = fields(member, n(index));
        check!(rejected(api::field_collections(&value), &format!("arg0.{member}[0]")) && value == before);
    }
    println!("fin-record-zero-ok:{checks}");
}
