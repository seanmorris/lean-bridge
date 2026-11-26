use cargo_budget::{self as api, CallbackError, Error, Fault, RetainedCallback};
use std::{cell::Cell, ffi::{c_char,c_void}, rc::Rc};

// Test-only observation of the loaded broker; no second runtime is opened.
#[repr(C)] #[derive(Default)]
struct Snapshot { abi:u32, state:u32, init:u32, components:u32, attached:u32, live:u32, runtime:u64, domain:u64 }
unsafe extern "C" { fn dlsym(h:*mut c_void, s:*const c_char)->*mut c_void; }
fn zero_leases() {
    let mut s=Snapshot::default();
    unsafe {
        let p=dlsym(std::ptr::null_mut(),c"lean_bridge_native_snapshot_read".as_ptr());
        assert!(!p.is_null());
        std::mem::transmute::<*mut c_void,unsafe extern "C" fn(*mut Snapshot)>(p)(&mut s);
    }
    assert_eq!((s.abi,s.init,s.live),(1,1,0));
}

fn denied(result: Result<u32,api::CallbackTaskError>, name: &'static str) {
    assert_eq!(result.unwrap_err(),Error::Boundary(Fault::CallbackAlreadyInvoked{declaration:name}));
}
fn main() {
    let count=Rc::new(Cell::new(0)); let weak=Rc::downgrade(&count);
    let once=count.clone();
    let f=RetainedCallback::new(move |n:u32| {once.set(once.get()+1); Ok(n+1)});
    async_io::block_on(async {
        let count_many=Rc::new(Cell::new(0)); let many=count_many.clone();
        let g=move |n| {many.set(many.get()+1); Ok(n+1)};
        denied(api::probe(1,f.function(),g).unwrap().await,"Budget.probe");
        assert_eq!((count.get(),count_many.get()),(1,2));
        assert_eq!(api::pair(40,f.function(),f.function()).unwrap().await.unwrap(),42);
        let a=api::single(1,f.function()).unwrap();
        let b=api::single(41,f.function()).unwrap();
        assert_eq!(b.await.unwrap(),42); assert_eq!(a.await.unwrap(),2); assert_eq!(count.get(),5);
        let original=CallbackError::new(std::io::Error::other("callback-already-invoked"));
        let failed=Rc::new(Cell::new(0));
        let fault=original.clone(); let calls=failed.clone();
        let boom=RetainedCallback::new(move |_| {calls.set(calls.get()+1); Err(fault.clone())});
        denied(api::retry(1,boom.function()).unwrap().await,"Budget.retry");
        assert_eq!(failed.get(),1);
        match api::single(1,boom.function()).unwrap().await {
            Err(Error::Callback{declaration:"Budget.single",error})=>assert!(error.same_error(&original)),
            other=>panic!("original Rust error lost: {other:?}"),
        }
        denied(api::during_start(1,f.function()).unwrap().await,"Racing.duringStart");
        let replaced=api::replace(1,f.function()).unwrap().await;
        assert!(matches!(replaced,Err(Error::Boundary(Fault::TaskIo{declaration:"Racing.replace",message})) if message.contains("callback-already-invoked")));
        let before=count.get();
        assert_eq!(api::checked(0,f.function()).unwrap().await,Err(Error::Start(73)));
        assert_eq!(count.get(),before);
        assert_eq!(api::checked(1,f.function()).unwrap().await,
                   Err(Error::Boundary(Fault::CallbackAlreadyInvoked{declaration:"TypedBudget.checked"})));
        assert_eq!(count.get(),before+1);
        for n in 0..16 {
            let before=count.get();
            denied(api::race(n,f.function()).unwrap().await,"Racing.race");
            assert_eq!(count.get(),before+1);
        }
    });
    drop(count); assert!(weak.upgrade().is_some());
    f.close(); assert!(weak.upgrade().is_none());
    zero_leases();
    println!("Rust: one-call admission; 16 worker races; original and replacement errors distinguished; capture released; zero leases");
}
