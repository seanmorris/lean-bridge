use lease_sync as direct;
use lease_task as worker;
use std::{ffi::{c_char,c_void}, future::Future, sync::Arc, task::{Context,Poll,Wake,Waker}, thread};

struct Signal(thread::Thread);
impl Wake for Signal { fn wake(self:Arc<Self>) { self.0.unpark(); } }
fn finish<F:Future>(f:F)->F::Output {
    let wake=Waker::from(Arc::new(Signal(thread::current())));
    let mut f=Box::pin(f); let mut cx=Context::from_waker(&wake);
    loop { match f.as_mut().poll(&mut cx) {
        Poll::Ready(v)=>return v, Poll::Pending=>thread::park(),
    } }
}
unsafe extern "C" { fn dlsym(lib:*mut c_void, name:*const c_char)->*mut c_void; }
fn live()->u32 { unsafe {
    #[repr(C)] #[derive(Default)] struct Snapshot { abi:u32,state:u32,init:u32,components:u32,attached:u32,live:u32,runtime:u64,domain:u64 }
    let f=dlsym(std::ptr::null_mut(),c"lean_bridge_native_snapshot_read".as_ptr());assert!(!f.is_null());
    let mut s=Snapshot::default();std::mem::transmute::<_,unsafe extern "C" fn(*mut Snapshot)>(f)(&mut s);
    assert_eq!(s.abi,1);s.live
} }
fn main() {
    let mut a:direct::Badge=direct::fresh(40).unwrap();
    let one=live();
    {
        let alias:worker::Badge=direct::checked(false,&a).unwrap();
        assert!(a.same_object(&alias).unwrap());
        let pending=worker::later(&alias).unwrap(); drop(alias);
        let from_task:direct::Badge=finish(pending).unwrap();
        assert!(from_task.same_object(&a).unwrap()); assert_eq!(direct::read(&from_task),Ok(41));
        let keep=match direct::checked(true,&from_task) {
            Err(direct::CallError::Declared{declaration:"Owned.checked",payload})=>{
                assert!(payload.same_object(&a).unwrap()); direct::increment(&payload,3).unwrap();
                payload.try_clone().unwrap()
            }
            other=>panic!("lost typed resource error: {other:?}"),
        };
        a.close().unwrap(); assert_eq!(direct::read(&keep),Ok(44));
        assert_eq!(direct::read(&a),Err(direct::CallError::Boundary(direct::Fault::Closed)));
    }
    assert_eq!(live()+1,one);
}
