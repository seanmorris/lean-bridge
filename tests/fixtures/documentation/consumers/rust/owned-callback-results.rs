use owned_callback_results::{
    echo_record, make_record, new_ticket, serial, BigInt, BigUint,
    Bundle, Error, Payload,
};

fn main() -> Result<(), Error> {
    let ticket = new_ticket(&BigUint::from(42u32), "order")?;
    let input = Bundle {
        primary: ticket.get()?.clone(), spare: None, peers: vec![], history: vec![],
        payload: Payload { count: BigInt::from(42), bytes: vec![] },
    };
    let mut owner = echo_record(&input)?;
    let choose = make_record(owner.get()?)?;
    let borrowed = choose.call(false, &owner)?;
    let independent = borrowed.retain()?;
    owner.close();
    assert_eq!(borrowed.get(), Err(Error::Closed));
    println!("{}", serial(&independent.get()?.primary)?);
    Ok(())
}
