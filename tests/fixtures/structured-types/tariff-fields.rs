/* Public Cargo consumer. The separate observer runs the same scenarios. */
use tariff_quotes::{apply_tariff, echo_tariff, make_tariff, pack_quote, unpack_quote, Error, Tariff};

pub fn scenarios(checkpoint: fn(&str)) -> Result<(), Error> {
    {
        let mut original = make_tariff(40)?;
        let copied = original.clone();
        original.quote.close();
        assert_eq!(copied.quote.call(2)?, 42);
        assert_eq!(apply_tariff(&copied, 3)?, 43);
    }
    checkpoint("clone survives explicit close of the original field");
    {
        let input = Tariff { quote: make_tariff(20)?.quote };
        let out = echo_tariff(&input)?;
        drop(input);
        assert_eq!(out.quote.call(22)?, 42);
        assert_eq!(apply_tariff(&out, 5)?, 25);
    }
    checkpoint("caller-built record survives a round trip and drop");
    {
        let value = make_tariff(8)?;
        let field = unpack_quote(&value)?;
        drop(value);
        assert_eq!(field.call(34)?, 42);
    }
    checkpoint("extracted function owns its captured price");
    {
        let mut owner = make_tariff(36)?.quote;
        let repacked = pack_quote(owner.clone())?;
        owner.close();
        assert_eq!(repacked.quote.call(6)?, 42);
    }
    checkpoint("repacked function outlives the original owner");
    {
        let mut calls = 0;
        let expired = pack_quote(|n| { calls += 1; Ok(n) })?;
        assert_eq!(expired.quote.call(1), Err(Error::CallbackFailed));
        assert_eq!(apply_tariff(&expired, 1), Err(Error::CallbackFailed));
        assert_eq!(calls, 0);
    }
    checkpoint("host FnMut borrow expires even inside a returned record");
    {
        let mut closed = make_tariff(7)?;
        closed.quote.close();
        assert!(matches!(echo_tariff(&closed), Err(Error::Closed)));
    }
    checkpoint("closed field is not a valid input");
    {
        let next = make_tariff(41)?;
        assert_eq!(next.quote.call(1)?, 42);
        assert_eq!(apply_tariff(&next, 2)?, 43);
    }
    checkpoint("a later valid record still works");
    Ok(())
}
