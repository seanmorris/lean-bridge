use task_lab as lab;
use task_lab_peer as peer;
mod pulse_checks;
mod callback_checks;
mod callback_example {
    include!("callback_example.rs");
    pub fn run(){super::pulse_checks::block(repeat()).unwrap();}
}
use pulse_checks::{block,until};
use std::{collections::BTreeSet,ffi::{c_char,c_void},fs,path::Path};
use lab::{BigInt,BigUint,Error,Fault};

// Test-only independent observers, not bridge glue in the consumer API.
#[repr(C)] #[derive(Default)] struct Snapshot{abi:u32,state:u32,init:u32,components:u32,attached:u32,live:u32,runtime:u64,domain:u64}
unsafe extern "C"{fn dlsym(h:*mut c_void,s:*const c_char)->*mut c_void;fn fork()->i32;fn _exit(n:i32)->!;fn waitpid(p:i32,s:*mut i32,flags:i32)->i32;}
fn snapshot()->Snapshot {
    let mut s=Snapshot::default();unsafe{
        let v=dlsym(std::ptr::null_mut(),c"lean_bridge_native_snapshot_read".as_ptr());assert!(!v.is_null());
        std::mem::transmute::<*mut c_void,unsafe extern "C" fn(*mut Snapshot)>(v)(&mut s);
    };assert_eq!(s.abi,1);s
}
fn files()->usize{
    fs::read_dir("/proc/self/fd").unwrap().flatten().filter_map(|e|fs::read_link(e.path()).ok())
        .filter(|p|p==Path::new("/dev/null")).count()
}
fn runtime_libraries(){
    let maps=fs::read_to_string("/proc/self/maps").unwrap();
    let paths=maps.lines().filter_map(|l|l.split_once('/').map(|(_,p)|p.trim_end_matches(" (deleted)")))
        .collect::<BTreeSet<_>>();
    for name in ["liblean_bridge_native.so","libleanshared.so","liblbc_task_lab.so","liblbc_task_lab_peer.so"] {
        assert_eq!(paths.iter().filter(|s|s.rsplit('/').next()==Some(name)).count(),1,"{name}");
    }
    assert_eq!(paths.iter().filter(|s|s.contains("/liblb_task_resources_")).count(),1);
    assert_eq!(snapshot().components,2);
}
fn integers(){
    let n=(BigUint::from(1u8)<<4095usize)+BigUint::from(123u8);
    let z= -BigInt::from(&n+BigUint::from(7u8));
    assert_eq!(block(lab::sum(&n,&z).unwrap()).unwrap(),BigInt::from(-7));
    assert!(matches!(peer::wide_checked(true,false,&n,&z),Err(Error::Start(e)) if e==z));
    assert_eq!(block(lab::wide_checked(false,true,&n,&z).unwrap()).unwrap(),Err(z.clone()));
    assert_eq!(block(peer::wide_checked(false,false,&n,&z).unwrap()).unwrap(),Ok(Err(n.clone())));
    assert!(matches!(lab::wide_series(true,false,&n,&z),Err(Error::Start(e)) if e==n));
    let mut stream=peer::wide_series(false,true,&n,&z).unwrap();
    assert_eq!(block(stream.next()),Some(Ok(Err(n))));assert_eq!(block(stream.next()),Some(Err(Error::Step(z))));
    assert_eq!(block(stream.next()),None);
}
fn leases(){
    let base=snapshot().live;let descriptors=files();
    lab::depot_reset().unwrap();let mut a=lab::make(10,"a").unwrap();
    let b:peer::Ticket=peer::alias(&a).unwrap();let other=peer::make(10,"a").unwrap();
    assert!(b.same_object(&a).unwrap());assert!(!other.same_object(&a).unwrap());drop(other);
    let copy=a.try_clone().unwrap();peer::add(&copy,2).unwrap();drop(copy);assert_eq!(lab::count(&b).unwrap(),12);
    let f=lab::pending(&a,false).unwrap();until(||lab::depot_phase().unwrap()==1);
    a.close().unwrap();a.close().unwrap();assert!(matches!(peer::count(&a),Err(Error::Boundary(Fault::Closed))));
    drop(b);assert_eq!(files(),descriptors+1);lab::depot_release().unwrap();
    let r:peer::Ticket=block(f).unwrap();assert_eq!(peer::count(&r).unwrap(),13);
    assert!(matches!(peer::lease_checked(true,&r),Err(Error::Start(e)) if e.same_object(&r).unwrap()));
    let q=block(peer::lease_checked(false,&r).unwrap()).unwrap();assert!(q.same_object(&r).unwrap());drop(q);
    let mut it=peer::tickets(&r,true).unwrap();let item=block(it.next()).unwrap().unwrap();
    assert!(item.same_object(&r).unwrap());drop(item);
    assert!(matches!(block(it.next()),Some(Err(Error::Step(e))) if e.same_object(&r).unwrap()));assert!(block(it.next()).is_none());
    drop(it);let badge=peer::badge(2).unwrap();drop(badge);
    lab::depot_reset().unwrap();let f=lab::pending(&r,false).unwrap();until(||lab::depot_phase().unwrap()==1);
    drop(r);drop(f);assert_eq!(files(),descriptors+1);lab::depot_release().unwrap();until(||lab::depot_phase().unwrap()==3);
    until(||files()==descriptors&&snapshot().live==base);
}
fn child_isolation(){
    lab::reset().unwrap();let mut f=lab::gated(false,9).unwrap();until(||lab::phase().unwrap()==1);
    // Register with the reactor before fork. Child disposal must not touch
    // either inherited reactor locks or Lean state; the parent keeps working.
    use std::{future::Future,pin::Pin,task::{Context,Waker}};
    assert!(Pin::new(&mut f).poll(&mut Context::from_waker(Waker::noop())).is_pending());
    let pid=unsafe{fork()};assert!(pid>=0);
    if pid==0 {let ok=matches!(lab::phase(),Err(Error::Boundary(Fault::WrongContext)));
        drop(f);unsafe{_exit(if ok{0}else{77})}}
    let mut status=0;assert_eq!(unsafe{waitpid(pid,&mut status,0)},pid);assert_eq!(status,0);
    lab::release().unwrap();assert_eq!(block(f).unwrap(),9);
}
fn main(){
    if let Some(mode)=std::env::args().nth(1){callback_checks::isolated(&mode);return;}
    pulse_checks::run();integers();leases();child_isolation();runtime_libraries();
    callback_example::run();
    callback_checks::run();
    println!("Rust: parked executor, waker replacement, cancellation, fused streams, typed errors, exact integers and cross-crate resource cleanup passed");
}
