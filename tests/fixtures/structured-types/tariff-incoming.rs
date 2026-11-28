// Downstream code: neither a raw C handle nor a manually driven session.
use tariff_quotes::{visit_quote_with, Error};

pub fn scenarios(mut checkpoint: impl FnMut()) -> Result<(), Error> {
    for keep in [false, true] {
        for fail in [false, true] {
            let mut borrowed = None;
            let mut retained = None;
            let mut original = Some(String::from("application rejected quote"));
            let address = original.as_ref().unwrap().as_ptr();
            let result = visit_quote_with(40, |q, n| {
                assert!(borrowed.is_none());
                assert_eq!(q.call(n)?, 42);
                if keep {
                    let lease = q.retain()?;
                    assert_eq!(q, lease);
                    retained = Some(lease);
                }
                borrowed = Some(q);
                if fail { return Err(Error::Load(original.take().unwrap())); }
                borrowed.as_ref().unwrap().call(n)
            }, 2);
            if fail {
                match result {
                    Err(Error::Load(message)) => assert_eq!(message.as_ptr(), address),
                    other => panic!("lost original Rust error: {other:?}"),
                }
            } else { assert_eq!(result?, 42); }
            let old = borrowed.unwrap();
            assert_eq!(old.call(5), Err(Error::Closed));
            if let Some(mut lease) = retained {
                assert_ne!(old, lease); assert_eq!(lease.call(5)?, 45);
                lease.close(); assert_eq!(lease.call(5), Err(Error::Closed));
            }
            checkpoint();
        }
    }
    let mut inner = None;
    assert_eq!(visit_quote_with(30, |outer, n| {
        let result = visit_quote_with(90, |other, m| {
            assert_ne!(outer, other); assert_eq!(other.call(m)?, 93);
            inner = Some(other); Err(Error::Load("nested refusal".to_owned()))
        }, 3);
        assert!(matches!(result, Err(Error::Load(s)) if s == "nested refusal"));
        assert_eq!(inner.as_ref().unwrap().call(1), Err(Error::Closed));
        outer.call(n)
    }, 4)?, 34);
    checkpoint();
    assert_eq!(visit_quote_with(1, |q,n| q.call(n), 5)?, 6);
    assert_eq!(visit_quote_with(60, |q,n| q.call(n), 3)?, 63);
    checkpoint();
    Ok(())
}
fn main() -> Result<(), Error> { scenarios(|| {}) }
