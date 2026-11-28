use owner::{Borrowed,HostRef,Kind,OwnerError,Session};
use std::{cell::Cell,rc::Rc};
struct Parent { drops:Rc<Cell<u32>> }
impl Drop for Parent {
    fn drop(&mut self) {
        // The last drop runs arbitrary application code, including re-entry.
        drop(Session::new("domain",vec![Kind::of::<u8>("reentrant")]).unwrap());
        self.drops.set(self.drops.get()+1);
    }
}
fn session()->Session {Session::new("domain",vec![Kind::of::<Parent>("parent"),Kind::of::<u32>("dial")]).unwrap()}
extern "C" {fn fork()->i32;fn waitpid(pid:i32,s:*mut i32,options:i32)->i32;fn _exit(code:i32)->!;}
fn main(){
    let a=session();let b=session();
    let other=Session::new("other",vec![Kind::of::<Parent>("parent")]).unwrap();
    let incompatible=||Session::new("domain",vec![Kind::of::<u8>("parent")]);
    assert!(matches!(incompatible(),Err(OwnerError::Invalid)));
    let drops=Rc::new(Cell::new(0));
    let parent=HostRef::from(Rc::new(Parent{drops:drops.clone()})); let weak=Rc::downgrade(parent.as_rc());
    let p=a.pin(0,&parent).unwrap();let second=b.pin(0,&parent).unwrap();
    assert_eq!(a.refop(-5,p.id(),second.id()),Ok(1));
    assert!(matches!(other.get::<Parent>(0,p.id()),Err(OwnerError::Closed)));
    assert!(matches!(a.get::<u32>(1,p.id()),Err(OwnerError::Invalid)));
    let alias=Session::new("domain",vec![Kind::of::<Parent>("another")]).unwrap();
    assert!(matches!(alias.pin(0,&parent),Err(OwnerError::Invalid)));drop(alias);
    let unrelated=HostRef::from(Rc::new(Parent{drops:drops.clone()}));
    let dial=Rc::new(37u32);
    assert!(matches!(a.borrowed(1,Borrowed::new(unrelated.as_rc(),dial.clone()),&parent),Err(OwnerError::Invalid)));
    drop(unrelated);
    let d=a.borrowed(1,Borrowed::new(parent.as_rc(),dial.clone()),&parent).unwrap();
    let obj=b.take::<u32>(1,b.refop(-9,d.id(),0).unwrap()).unwrap();
    assert!(Rc::ptr_eq(&dial,obj.as_rc())); drop(dial);
    let old=second.id();drop(second);assert!(matches!(b.get::<Parent>(0,old),Err(OwnerError::Closed)));
    let bound=b.refop(-1,0,0).unwrap();assert_eq!(a.refop(-3,bound,0),Ok(0));assert_eq!(b.refop(-3,bound,0),Ok(1));
    drop(b);assert_eq!(a.refop(-2,bound,0),Ok(0));a.refop(-8,bound,0).unwrap();
    let tid=a.refop(-4,1,0).unwrap();assert_eq!(a.refop(-6,d.id(),tid),Ok(1));a.refop(-8,tid,0).unwrap();
    assert!(std::thread::spawn(||matches!(Session::new("domain",vec![Kind::of::<u8>("thread")]),Err(OwnerError::WrongContext))).join().unwrap());
    let child=unsafe{fork()};assert!(child>=0);
    if child==0 {unsafe{_exit(if matches!(a.get::<Parent>(0,p.id()),Err(OwnerError::WrongContext)){0}else{2})}}
    let mut status=0;assert_eq!(unsafe{waitpid(child,&mut status,0)},child);assert_eq!(status,0);
    drop(a);assert!(matches!(incompatible(),Err(OwnerError::Invalid)));
    drop(p);drop(parent);drop(d);assert!(weak.upgrade().is_some() && drops.get()==1);
    drop(obj);assert!(weak.upgrade().is_none() && drops.get()==2);
    drop(incompatible().unwrap());drop(other);
    println!("Rust owners: exact identity, anchored result, stale rejection and reentrant destruction");
}
