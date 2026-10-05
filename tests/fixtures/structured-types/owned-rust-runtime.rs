use std::ffi::c_void;
use std::rc::Rc;
use owned_runtime::{BorrowFrame, NativeOwner, State, checked, current_state};

enum TicketKind {}
type Ticket = Resource<TicketKind>;
unsafe extern "C" {
    fn owned_test_new(session: *mut c_void, value: u64, out: *mut *mut c_void, owner: *mut *mut c_void) -> u32;
    fn owned_test_retain(session: *mut c_void, value: *mut c_void, out: *mut *mut c_void, owner: *mut *mut c_void) -> u32;
    fn owned_test_serial(session: *mut c_void, value: *mut c_void, out: *mut u64, owner: *mut *mut c_void) -> u32;
    fn owned_test_live() -> usize;
    fn owned_test_identities() -> usize;
    fn owned_test_fail_after(value: isize);
    fn fork() -> i32;
    fn waitpid(pid: i32, status: *mut i32, flags: i32) -> i32;
    fn _exit(status: i32) -> !;
}
fn new_ticket(state: &Rc<State>, value: u64) -> Result<Ticket, Error> {
    let mut owner = NativeOwner::new(); let mut handle = std::ptr::null_mut();
    checked(unsafe { owned_test_new(state.require()?, value, &mut handle, &mut owner.value) })?;
    Ticket::from_owned(state.adopt(&mut owner)?, handle)
}
fn retain(state: &Rc<State>, value: &Ticket) -> Result<Ticket, Error> {
    let mut owner = NativeOwner::new(); let mut handle = std::ptr::null_mut();
    checked(unsafe { owned_test_retain(state.require()?, value.raw(state)?, &mut handle, &mut owner.value) })?;
    Ticket::from_owned(state.adopt(&mut owner)?, handle)
}
fn serial(state: &Rc<State>, value: &Ticket) -> Result<u64, Error> {
    let mut owner = NativeOwner::new(); let mut out = 0;
    checked(unsafe { owned_test_serial(state.require()?, value.raw(state)?, &mut out, &mut owner.value) })?;
    Ok(out)
}
fn main() {
    let mut checks = 0;
    macro_rules! check { ($value:expr) => { assert!($value); checks += 1; }; }
    // Verify all stable C status mappings, including unknown future statuses.
    check!(checked(0) == Ok(()));
    for (status, expected) in [(1,Error::InvalidArgument),(2,Error::Limit),(3,Error::Allocation),
        (4,Error::Closed),(5,Error::WrongThread),(6,Error::WrongProcess),(7,Error::Unavailable),
        (8,Error::CallOrder),(9,Error::MalformedResult),(10,Error::CallbackFailed),(99,Error::Native(99))] {
        check!(checked(status) == Err(expected));
    }
    {
        let state = current_state().unwrap();
        check!(Rc::ptr_eq(&state, &current_state().unwrap()));
        let mut empty = Ticket::default(); check!(empty.is_closed()); empty.close();
        check!(empty.raw(&state) == Err(Error::Closed));
        let mut first = new_ticket(&state, 41).unwrap();
        let copied = first.clone(); let retained = retain(&state, &first).unwrap();
        check!(copied == first && retained == first);
        first.close(); check!(first.is_closed());
        check!(serial(&state, &copied) == Ok(41));
        drop(copied); check!(serial(&state, &retained) == Ok(41));
        let other = State::new().unwrap();
        check!(retained.raw(&other) == Err(Error::InvalidArgument)); drop(other);
        let (escaped, kept);
        {
            let frame = BorrowFrame::new(&state).unwrap();
            let borrowed = Ticket::from_owned(Rc::clone(&frame.lease), retained.raw(&state).unwrap()).unwrap();
            escaped = borrowed.clone(); kept = retain(&state, &borrowed).unwrap();
            check!(serial(&state, &borrowed) == Ok(41));
        }
        check!(escaped.is_closed()); check!(serial(&state, &escaped) == Err(Error::Closed));
        check!(serial(&state, &kept) == Ok(41));
        let mut unwound = Ticket::default();
        let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let frame = BorrowFrame::new(&state).unwrap();
            unwound = Ticket::from_owned(Rc::clone(&frame.lease), kept.raw(&state).unwrap()).unwrap();
            let _temporary = new_ticket(&state, 99).unwrap();
            std::panic::panic_any(123_u32);
        }));
        check!(panic.unwrap_err().downcast_ref::<u32>() == Some(&123));
        check!(unwound.is_closed()); check!(serial(&state, &kept) == Ok(41));
        let pid = unsafe { fork() }; check!(pid >= 0);
        if pid == 0 {
            let valid = kept.raw(&state) == Err(Error::WrongProcess) && kept.is_closed()
                && matches!(current_state(), Err(Error::WrongProcess));
            drop(kept); drop(retained); drop(state);
            unsafe { _exit(if valid { 0 } else { 1 }); }
        }
        let mut status = 0; check!(unsafe { waitpid(pid, &mut status, 0) } == pid); check!(status == 0);
        check!(serial(&state, &kept) == Ok(41));
        for value in 0..128 {
            let item = new_ticket(&state, value).unwrap();
            let clone = item.clone(); drop(item);
            check!(serial(&state, &clone) == Ok(value));
        }
        state.close().unwrap(); state.close().unwrap();
        check!(retained.is_closed() && kept.is_closed());
        check!(serial(&state, &kept) == Err(Error::Closed));
        check!(matches!(current_state(), Err(Error::Closed)));
    }
    check!(unsafe { owned_test_live() } == 0); check!(unsafe { owned_test_identities() } == 0);
    let mut allocation_failures = 0;
    {
        let state = current_state().unwrap();
        let baseline = unsafe { owned_test_live() };
        let identities = unsafe { owned_test_identities() };
        check!(identities == 1); // The live C session owns one broker identity.
        for point in 0..128 {
            unsafe { owned_test_fail_after(point); }
            let result = new_ticket(&state, 77);
            unsafe { owned_test_fail_after(-1); }
            match result {
                Ok(value) => { check!(serial(&state, &value) == Ok(77)); break; }
                Err(error) => { check!(error == Error::Allocation); allocation_failures += 1; }
            }
            check!(unsafe { owned_test_live() } == baseline);
            check!(unsafe { owned_test_identities() } == identities);
        }
        check!(allocation_failures > 0 && allocation_failures < 128);
    }
    check!(unsafe { owned_test_live() } == 0); check!(unsafe { owned_test_identities() } == 0);
    let value = std::thread::spawn(|| {
        let state = current_state().unwrap(); let ticket = new_ticket(&state, 87).unwrap();
        serial(&state, &ticket).unwrap()
    }).join().unwrap();
    check!(value == 87);
    check!(unsafe { owned_test_live() } == 0); check!(unsafe { owned_test_identities() } == 0);
    println!("{{\"checks\":{checks},\"allocationFailures\":{allocation_failures},\"live\":0,\"identities\":0}}");
}
