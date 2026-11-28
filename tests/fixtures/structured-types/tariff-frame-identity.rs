use tariff_quotes::{exchange_tariff, make_tariff, with_recovery, Error, Tariff};

fn main() -> Result<(), Error> {
    let other = make_tariff(900)?;
    let mut saved = None;
    let revise = |value: Tariff| {
        let borrowed = value.quote.clone();
        let retained = borrowed.retain()?;
        assert_eq!(borrowed, retained);
        assert_eq!(retained, borrowed);
        assert_ne!(borrowed, other.quote);
        saved = Some((borrowed, retained));
        Ok(value)
    };
    assert_eq!(exchange_tariff(with_recovery(revise, other.clone()), 30, 3)?, 33);
    let (borrowed, retained) = saved.unwrap();
    assert_eq!(borrowed.call(5), Err(Error::Closed));
    assert_ne!(borrowed, retained);
    assert_eq!(retained.call(5)?, 35);
    Ok(())
}
