use owned_borrows::{new_ticket, retain_ticket, serial, BigUint, Error};

fn main() -> Result<(), Error> {
    let mut owner = new_ticket(&BigUint::from(42u32), "order")?;
    let borrowed = retain_ticket(&owner)?;
    let independent = borrowed.retain()?;
    assert!(borrowed.try_equal(&owner)?);

    owner.close();
    assert_eq!(borrowed.get(), Err(Error::Closed));
    println!("{}", serial(independent.get()?)?);
    Ok(())
}
