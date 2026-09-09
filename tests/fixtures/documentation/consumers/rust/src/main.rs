use lean_bridge_alpha::{make_adder, round_trip, with_callback, Box, Payload};

fn main() -> Result<(), std::boxed::Box<dyn std::error::Error>> {
    let boxed = Box::new(42)?;
    assert_eq!(boxed.read()?, 42);
    assert!(std::ptr::eq(boxed.identity()?, &boxed));

    let value = round_trip(Payload {
        enabled: true,
        count: 41,
        label: "Lean λ".into(),
        bytes: vec![0, 255],
        values: vec![0, u32::MAX],
    })?;
    assert!(!value.enabled);
    assert_eq!(value.count, 42);
    assert_eq!(value.label, "Lean λ");
    assert_eq!(value.bytes, vec![0, 255]);
    assert_eq!(value.values, vec![0, u32::MAX]);
    assert_eq!(with_callback(40, |current| Ok(current + 2))?, 44);
    let add_two = make_adder(2)?;
    assert_eq!(add_two.call(40)?, 42);

    drop(add_two);
    drop(boxed);
    println!("Box: 42; payload: 42; callback: 44; closure: 42");
    Ok(())
}
