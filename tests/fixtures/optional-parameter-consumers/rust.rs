use optionalparameters::BigUint;
use std::sync::atomic::{AtomicUsize, Ordering};

static CHECKS: AtomicUsize = AtomicUsize::new(0);
macro_rules! check {
    ($value:expr) => {{
        assert!($value);
        CHECKS.fetch_add(1, Ordering::Relaxed);
    }};
}

fn main() {
    check!(optionalparameters::word!().unwrap() == 7);
    check!(optionalparameters::word(7).unwrap() == 7);
    check!(optionalparameters::word(11).unwrap() == 11);

    let large = BigUint::parse_bytes(b"184467440737095516160", 10).unwrap();
    check!(optionalparameters::natural!().unwrap() == large);
    check!(optionalparameters::natural(&large).unwrap() == large);
    check!(optionalparameters::natural(&BigUint::from(11u32)).unwrap() == BigUint::from(11u32));

    check!(optionalparameters::text!().unwrap() == "Lean\nBridge");
    check!(optionalparameters::text("Lean\nBridge").unwrap() == "Lean\nBridge");
    check!(optionalparameters::text("other").unwrap() == "other");

    check!(optionalparameters::character!().unwrap() == 'λ');
    check!(optionalparameters::character('λ').unwrap() == 'λ');
    check!(optionalparameters::character('猫').unwrap() == '猫');

    check!(optionalparameters::maybe!().unwrap() == None);
    check!(optionalparameters::maybe(&None).unwrap() == None);
    check!(optionalparameters::maybe(&Some(11)).unwrap() == Some(11));

    check!(optionalparameters::present!().unwrap() == Some(9));
    check!(optionalparameters::present(&Some(9)).unwrap() == Some(9));
    check!(optionalparameters::present(&None).unwrap() == None);
    check!(optionalparameters::present(&Some(11)).unwrap() == Some(11));

    check!(optionalparameters::unit_value!().unwrap() == ());
    check!(optionalparameters::unit_value(()).unwrap() == ());

    println!(
        "optional-parameter-rust:{}",
        CHECKS.load(Ordering::Relaxed)
    );
}
