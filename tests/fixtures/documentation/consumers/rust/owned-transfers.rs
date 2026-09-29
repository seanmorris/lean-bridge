use owned_transfers::{new_ticket, retain_ticket, serial, BigUint};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut ticket = new_ticket(&BigUint::from(17u32), "order")?;
    let alias = ticket.clone();
    let independent = ticket.retain()?;

    let received = retain_ticket(&mut ticket)?;
    assert!(ticket.is_closed() && alias.is_closed());
    assert_eq!(serial(&received)?, BigUint::from(17u32));
    assert_eq!(serial(&independent)?, BigUint::from(17u32));
    println!("transferred");
    Ok(())
}
