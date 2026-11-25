use dials::{checked, counts, sequence, units, CallError, Cursor, Fault};

fn main() {
    // Ambiguous type inference if Cursor ever becomes Send or Sync.
    trait NoSend<A> { fn probe() {} }
    impl<T> NoSend<()> for T {} impl<T: Send> NoSend<u8> for T {}
    trait NoSync<A> { fn probe() {} }
    impl<T> NoSync<()> for T {} impl<T: Sync> NoSync<u8> for T {}
    let _ = <Cursor<u32> as NoSend<_>>::probe;
    let _ = <Cursor<u32> as NoSync<_>>::probe;
    assert_eq!(counts(), Ok(0));
    assert!(std::thread::spawn(|| matches!(sequence(2), Err(CallError::Boundary(Fault::WrongContext)))).join().unwrap());
    {
        let mut iter = sequence(3).unwrap();
        assert_eq!(counts(), Ok(10000));
        assert_eq!(iter.next(), Some(Ok(0)));
        assert_eq!(counts(), Ok(10100));
    }
    assert_eq!(counts(), Ok(10101));
    let mut iter = sequence(2).unwrap();
    assert_eq!(iter.by_ref().collect::<Result<Vec<_>,_>>(), Ok(vec![0, 1]));
    assert_eq!(iter.next(), None);
    iter.close().unwrap();
    assert_eq!(counts(), Ok(20402));
    assert!(matches!(checked(0), Err(CallError::Declared {declaration: "Dials.checked", payload}) if payload == "factory"));
    let mut typed = checked(1).unwrap();
    assert_eq!(typed.next(), Some(Ok(0)));
    assert!(matches!(typed.next(), Some(Err(CallError::Declared {declaration: "Dials.checkedNext", payload})) if payload == "step"));
    assert_eq!(typed.next(), None);
    assert_eq!(counts(), Ok(30603));
    let mut bytes = units(1).unwrap();
    assert_eq!(bytes.next(), Some(Ok(())));
    assert!(matches!(bytes.next(), Some(Err(CallError::Io {declaration: "Dials.nextUnit", message})) if message == "unit step"));
    assert_eq!(bytes.next(), None);
    assert_eq!(counts(), Ok(40804));
    let all = units(4).unwrap().collect::<Result<Vec<_>,_>>();
    assert_eq!(all, Ok(vec![(), ()]));
    assert_eq!(counts(), Ok(51105));
}
