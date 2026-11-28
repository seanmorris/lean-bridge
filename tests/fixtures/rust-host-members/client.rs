use std::{cell::{Cell,RefCell},rc::Rc};
use workshop::{HostError,HostCallError,MemberResult,Fault};
thread_local! {static DROPS:Cell<u32>=const{Cell::new(0)};}
struct Meter {
    level:Cell<u32>, err:RefCell<Option<HostError>>, nested:RefCell<Option<Box<dyn Fn()>>>, panic:Cell<bool>,
}
impl Meter {
    fn create(n:u32)->Rc<Self> {Rc::new(Self{level:Cell::new(n),err:Default::default(),nested:Default::default(),panic:Cell::new(false)})}
    fn read(&self)->MemberResult<u32> {
        if self.panic.get(){panic!("application meter panic")}
        if let Some(ref f)=*self.nested.borrow(){f();}
        if let Some(e)=self.err.borrow().clone(){Err(e)}else{Ok(self.level.get())}
    }
    fn get_level(&self)->u32{self.level.get()}
    fn set_level(&self,v:u32){self.level.set(v)}
    fn identity(self:&Rc<Self>)->Rc<Self>{self.clone()}
}
impl Drop for Meter {fn drop(&mut self){DROPS.with(|d|d.set(d.get()+1))}}
workshop::bind_objects!(A{Box=Meter});
peer::bind_objects!(B{Box=Meter});
impostor::bind_objects!(OtherRuntime{Box=Meter});
fn main(){
    let reverse=std::env::args().nth(1).as_deref()==Some("reverse");
    let (a,b)=if reverse {let b=peer::Binding::<B>::new().unwrap();(workshop::Binding::<A>::new().unwrap(),b)}
        else {let a=workshop::Binding::<A>::new().unwrap();(a,peer::Binding::<B>::new().unwrap())};
    let a=Rc::new(a);let b=Rc::new(b);
    assert!(matches!(impostor::Binding::<OtherRuntime>::new(),Err(impostor::Fault::Unavailable)));
    let x=a.make(8).unwrap();let same=b.identity(&x).unwrap();let weak=Rc::downgrade(x.as_rc());
    assert!(same.ptr_eq(&x)); assert_eq!(b.update(&x,41).unwrap(),41);assert_eq!(a.read(&same).unwrap(),41);
    let ext=Meter::create(81);assert_eq!(b.read(&ext).unwrap(),81);
    let original:HostError=Rc::new(std::io::Error::other("original application error"));*ext.err.borrow_mut()=Some(original.clone());
    let (aa,bb,external,original2)=(a.clone(),b.clone(),ext.clone(),original.clone());
    *x.nested.borrow_mut()=Some(Box::new(move||{
        assert_eq!(aa.close(),Err(Fault::Busy));
        match bb.read(&external){Err(HostCallError::Host(e))=>assert!(Rc::ptr_eq(&e,&original2)),_=>panic!("lost nested error")}
    }));
    assert_eq!(a.read(&x).unwrap(),41);
    x.nested.borrow_mut().take();
    match a.read(&ext){Err(HostCallError::Host(e))=>assert!(Rc::ptr_eq(&e,&original)),_=>panic!("lost original error")}
    match b.mapped(&ext){Err(HostCallError::Declared{declaration,payload})=>{assert_eq!(declaration,"Workshop.mapped");assert_eq!(payload,"host read failed")},_=>panic!("wrong mapped error")}
    match b.fail_with(&x){Err(HostCallError::Declared{declaration,payload})=>{assert_eq!(declaration,"Workshop.failWith");assert!(x.ptr_eq(&payload))},_=>panic!("wrong object error")}
    assert!(a.choose(&x,true).unwrap().unwrap().ptr_eq(&x));
    assert!(matches!(a.choose(&x,false),Ok(Err(17))));
    a.close().unwrap();a.close().unwrap();assert!(matches!(a.read(&x),Err(HostCallError::Boundary(Fault::Closed))));
    assert_eq!(b.read(&x).unwrap(),41);drop(ext);drop(x);assert!(weak.upgrade().is_some());drop(same);assert!(weak.upgrade().is_none());
    DROPS.with(|d|assert_eq!(d.get(),2));
    let c=workshop::Binding::<A>::new().unwrap();
    let p=Meter::create(0);p.panic.set(true);
    assert!(matches!(b.read(&p),Err(HostCallError::Boundary(Fault::CallbackPanic{declaration:"Workshop.read"}))));
    assert!(matches!(c.read(&p),Err(HostCallError::Boundary(Fault::Unavailable))));
    b.close().unwrap();c.close().unwrap();drop(p);DROPS.with(|d|assert_eq!(d.get(),3));
    println!("two Rust components, original Rc and error, typed EIO, returned Result and panic retirement");
}
