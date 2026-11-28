/* A downstream Rust program; only the second test binary supplies an observer. */
use std::sync::Arc;
use tariff_quotes::{flat_quote, make_tariff, staged_quote, with_recovery, Error};

pub fn scenarios(checkpoint: fn(&str)) -> Result<(), Error> {
    let quote = |base| make_tariff(base).map(|value| value.quote);
    assert_eq!(flat_quote(|a, b| Ok(a * b), 9, 3)?, 27);
    checkpoint("flat scalar reply");
    {
        let recovery = quote(900)?;
        assert_eq!(staged_quote(with_recovery(|base| quote(base * 10), recovery.clone()), 9, 3)?, 93);
        assert_eq!(recovery.call(1)?, 901);
    }
    checkpoint("fresh Lean function reply");
    {
        let saved = quote(700)?;
        assert_eq!(staged_quote(with_recovery(|_| Ok(saved.clone()), quote(900)?), 9, 3)?, 703);
        assert_eq!(saved.call(2)?, 702);
    }
    checkpoint("independent caller still owns reply");
    {
        let mut closed = quote(900)?;
        closed.close();
        let mut entries = 0;
        let call = staged_quote(with_recovery(|base| { entries += 1; quote(base) }, closed), 9, 3);
        assert_eq!(call, Err(Error::Closed));
        assert_eq!(entries, 0);
    }
    checkpoint("closed recovery refused before host entry");
    {
        let recovery = quote(900)?;
        let mut reason = Some(String::from("unavailable price"));
        let original_allocation = reason.as_ref().unwrap().as_ptr();
        let call = staged_quote(with_recovery(|base| {
            let temporary = quote(base)?;
            assert_eq!(temporary.call(2)?, 11);
            Err(Error::Load(reason.take().unwrap()))
        }, recovery.clone()), 9, 3);
        match call {
            Err(Error::Load(s)) => {
                assert_eq!(s, "unavailable price");
                assert_eq!(s.as_ptr(), original_allocation);
            }
            other => panic!("lost original host error: {other:?}"),
        }
        assert!(reason.is_none());
        assert_eq!(recovery.call(2)?, 902);
    }
    checkpoint("original Rust error after allocation");
    {
        let original = Arc::new(String::from("pricing panic"));
        let recovery = quote(900)?;
        let raised = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            staged_quote(with_recovery(|base| {
                let temporary = quote(base)?;
                assert_eq!(temporary.call(2)?, 11);
                std::panic::resume_unwind(Box::new(original.clone()))
            }, recovery.clone()), 9, 3)
        })).unwrap_err();
        assert!(Arc::ptr_eq(&original, raised.downcast_ref::<Arc<String>>().unwrap()));
        assert_eq!(recovery.call(3)?, 903);
    }
    checkpoint("original panic resumes in Rust");
    {
        let recovery = quote(900)?;
        let mut entries = 0;
        let call = staged_quote(with_recovery(|base| {
            entries += 1;
            let mut expired = quote(base)?;
            expired.close();
            Ok(expired)
        }, recovery.clone()), 9, 3);
        assert_eq!(call, Err(Error::Closed));
        assert_eq!(entries, 1);
        assert_eq!(staged_quote(with_recovery(quote, recovery), 4, 1)?, 5);
    }
    checkpoint("closed reply refused and binding reusable");
    Ok(())
}

fn main() { scenarios(|case| println!("{case}")).unwrap(); }
