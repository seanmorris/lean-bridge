use cedar_api::{array_u32, echo_nat, echo_text, echo_u32, BigUint};

fn main() -> Result<(), cedar_api::Error> {
    assert_eq!(echo_u32(42)?, 42);
    let large = (BigUint::from(1u8) << 4096usize) + BigUint::from(1u8);
    assert_eq!(echo_nat(&large)?, large);
    assert_eq!(echo_text("Lean λ\0")?, "Lean λ\0");
    assert_eq!(array_u32(&[0, u32::MAX])?, vec![0, u32::MAX]);
    println!("42; exact integers and copied arrays");
    Ok(())
}
