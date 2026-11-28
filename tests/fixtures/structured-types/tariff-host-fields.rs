/* The application's FnMut stays in Rust; the returned record holds a Lean lease. */
use tariff_quotes::{apply_tariff, apply_tariff_with_host_fields as apply, echo_tariff_with_host_fields as echo,
    make_tariff, unpack_quote_with_host_fields as unpack, Error, TariffInput};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::Arc;

pub fn scenarios(checkpoint: fn(&str)) -> Result<(), Error> {
    {
        let mut next = Box::new(40u32);
        let mut row = TariffInput { quote: move |n: u32| { let v = n + *next; *next += 1; Ok(v) } };
        assert_eq!(apply(&mut row, 2)?, 42);
        assert_eq!(apply(&mut row, 2)?, 43);
    }
    checkpoint("FnMut capture survives two calls");
    {
        let mut visits = 0;
        let mut inner = TariffInput { quote: |n: u32| { visits += 1; Ok(n + 39) } };
        let mut outer = TariffInput { quote: |n| Ok(apply(&mut inner, n)? + 1) };
        assert_eq!(apply(&mut outer, 2)?, 42);
        assert_eq!(visits, 1);
    }
    checkpoint("nested callbacks borrow local state");
    {
        let mut visits = 0;
        let (escaped, function) = {
            let mut row = TariffInput { quote: |n| { visits += 1; Ok(n) } };
            (echo(&mut row)?, unpack(&mut row)?)
        };
        for _ in 0..2 {
            assert_eq!(apply_tariff(&escaped, 2), Err(Error::CallbackFailed));
            assert_eq!(function.call(2), Err(Error::CallbackFailed));
        }
        assert_eq!(visits, 0);
    }
    checkpoint("returned record and function reject expired callback");
    {
        let mut reason = Some(String::from("host field failed"));
        let identity = reason.as_ref().unwrap().as_ptr();
        let mut row = TariffInput { quote: |n: u32| match reason.take() {
            Some(s) => Err(Error::Load(s)), None => Ok(40 + n),
        }};
        match apply(&mut row, 2) {
            Err(Error::Load(s)) => assert_eq!(s.as_ptr(), identity),
            other => panic!("lost field error: {other:?}"),
        }
        assert_eq!(apply(&mut row, 2)?, 42);
    }
    checkpoint("original returned error and healthy retry");
    {
        let identity = Arc::new(String::from("field panic"));
        let mut row = TariffInput { quote: |_| -> Result<u32, Error> {
            std::panic::resume_unwind(Box::new(identity.clone()))
        }};
        let seen = catch_unwind(AssertUnwindSafe(|| apply(&mut row, 1))).unwrap_err();
        assert!(Arc::ptr_eq(&identity, seen.downcast_ref::<Arc<String>>().unwrap()));
        assert_eq!(apply(&mut TariffInput { quote: |n| Ok(40 + n) }, 2)?, 42);
    }
    checkpoint("original panic resumes after the call");
    {
        let mut source = make_tariff(40)?;
        source.quote.close();
        assert_eq!(apply(&mut TariffInput::from(&source), 2), Err(Error::Closed));
    }
    checkpoint("closed field rejected before dispatch");
    {
        let out = {
            let source = make_tariff(40)?;
            echo(&mut TariffInput::from(&source))?
        };
        assert_eq!(out.quote.call(2)?, 42);
    }
    checkpoint("genuine Lean lease outlives its source");
    Ok(())
}

fn main() { scenarios(|s| println!("{s}")).unwrap(); }
