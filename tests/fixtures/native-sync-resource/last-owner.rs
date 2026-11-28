use lease_sync as desk;
use lease_task as peer;
use std::{ffi::{c_char,c_void}, future::Future, sync::Arc, task::{Context,Poll,Wake,Waker}, thread};

struct Signal(thread::Thread);
impl Wake for Signal { fn wake(self: Arc<Self>) { self.0.unpark(); } }
fn wait<F: Future>(f: F) -> F::Output {
    let waker = Waker::from(Arc::new(Signal(thread::current())));
    let mut cx = Context::from_waker(&waker);
    let mut f = Box::pin(f);
    loop { match f.as_mut().poll(&mut cx) { Poll::Ready(v) => return v, Poll::Pending => thread::park() } }
}

// Test-only observation, independent of the API calls below.
unsafe extern "C" { fn dlsym(lib: *mut c_void, name: *const c_char) -> *mut c_void; }
fn live() -> u32 { unsafe {
    #[repr(C)] #[derive(Default)]
    struct Snapshot { abi:u32, state:u32, init:u32, components:u32, attached:u32, live:u32, runtime:u64, domain:u64 }
    let f = dlsym(std::ptr::null_mut(), c"lean_bridge_native_snapshot_read".as_ptr()); assert!(!f.is_null());
    let mut s = Snapshot::default(); std::mem::transmute::<_, unsafe extern "C" fn(*mut Snapshot)>(f)(&mut s);
    assert_eq!(s.abi, 1); s.live
} }
fn main() {
    let mut original = desk::fresh(41).unwrap(); assert_eq!(live(), 1);
    let payload = match desk::checked(true, &original) {
        Err(desk::CallError::Declared { declaration: "Owned.checked", payload }) => payload,
        other => panic!("expected a declared resource error: {other:?}"),
    };
    assert!(payload.same_object(&original).unwrap());
    original.close().unwrap();
    assert_eq!(desk::read(&original), Err(desk::CallError::Boundary(desk::Fault::Closed)));
    let delivered: peer::Badge = wait(peer::later(&payload).unwrap()).unwrap();
    assert!(delivered.same_object(&payload).unwrap()); drop(delivered);
    assert_eq!(desk::read(&payload), Ok(42)); assert_eq!(live(), 1);
    drop(payload); assert_eq!(live(), 0);
    { let fresh = desk::fresh(7).unwrap(); assert_eq!(desk::read(&fresh), Ok(7)); }
    assert_eq!(live(), 0);
    println!("typed synchronous failure owned the badge through the peer task; zero identities after payload release");
}
