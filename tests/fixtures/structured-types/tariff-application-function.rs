// Downstream Rust application. No private runtime, foreign handles or ABI calls.
use std::cell::RefCell;
use tariff_quotes::{make_tariff, pass_application_quote, staged_quote,
                   visit_application_quote_with as visit, with_recovery, Error};

pub fn scenarios(mut checkpoint: impl FnMut()) -> Result<(), Error> {
    let calls = RefCell::new(Vec::new());
    let price = |n: u32| { calls.borrow_mut().push(n); Ok(40 + n) };
    {
        let expired = pass_application_quote(price)?;
        assert_eq!(expired.call(900), Err(Error::CallbackFailed));
        assert!(calls.borrow().is_empty());
    }
    checkpoint();
    {
        let mut saved = None;
        assert_eq!(visit(price, |q, n| {
            assert_eq!(q.call(0)?, 40);
            let forwarded = pass_application_quote(&q)?;
            let kept = q.retain()?;
            saved = Some((q, kept));
            forwarded.call(n)
        }, 2)?, 42);
        let (borrow, kept) = saved.unwrap();
        assert_eq!(borrow.call(900), Err(Error::Closed));
        assert_eq!(kept.call(900), Err(Error::CallbackFailed));
        assert_eq!(*calls.borrow(), [0, 2]);
    }
    checkpoint();
    assert_eq!(visit(price, |q, n| {
        let forwarded = pass_application_quote(&q)?;
        staged_quote(with_recovery(|_| Ok(forwarded.clone()), make_tariff(800)?.quote), 99, n)
    }, 3)?, 43);
    assert_eq!(*calls.borrow(), [0, 2, 3]);
    checkpoint();
    assert_eq!(visit(price, |outer, n| {
        let mut held = None;
        let result = visit(|m: u32| Ok(100 + m), |inner, m| {
            held = Some(inner.retain()?);
            Ok(outer.call(n)? + inner.call(m)?)
        }, 1)?;
        assert_eq!(result, 145);
        assert_eq!(held.unwrap().call(900), Err(Error::CallbackFailed));
        outer.call(n + 1)
    }, 4)?, 45);
    assert_eq!(*calls.borrow(), [0, 2, 3, 4, 5]);
    checkpoint();
    {
        let mut original = Some(String::from("pricing callback failed"));
        let allocation = original.as_ref().unwrap().as_ptr();
        let failed = visit(|_: u32| Err(Error::Load(original.take().unwrap())), |q, n| {
            let forward = pass_application_quote(&q)?;
            staged_quote(with_recovery(|_| Ok(forward.clone()), make_tariff(800)?.quote), 0, n)
        }, 1);
        match failed {
            Err(Error::Load(reason)) => assert_eq!(reason.as_ptr(), allocation),
            other => panic!("lost application error: {other:?}"),
        }
    }
    checkpoint();
    {
        let mut genuine = make_tariff(900)?.quote;
        let kept = pass_application_quote(&genuine)?;
        genuine.close(); assert_eq!(kept.call(6)?, 906);
        assert_eq!(visit(price, |q, n| q.call(n), 7)?, 47);
        assert_eq!(*calls.borrow(), [0, 2, 3, 4, 5, 7]);
    }
    checkpoint();
    Ok(())
}

fn main() -> Result<(), Error> { scenarios(|| {}) }
