use owned_receivers::{new_ticket, BigUint, Error};

fn main() -> Result<(), Error> {
    let mut owner = new_ticket(&BigUint::from(42u32), "order")?;
    let borrowed = owner.retain_ticket()?;
    let independent = borrowed.retain()?;
    println!("{}", borrowed.serial()?);
    owner.close();
    assert_eq!(borrowed.serial(), Err(Error::Closed));
    println!("{}", independent.serial()?);
    Ok(())
}
