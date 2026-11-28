use std::{cell::{Cell,RefCell},rc::Rc};
use workshop::{Binding,BigUint,Fault,HostCallError,HostError,MemberResult,Pair};

struct Meter { value:Cell<u32>, reads:Cell<u32>, fail:RefCell<Option<HostError>> }
impl Meter {
    fn create(n:u32)->Rc<Self> { Rc::new(Self{value:n.into(),reads:Default::default(),fail:Default::default()}) }
    fn get_level(&self)->u32 {self.value.get()}
    fn set_level(&self,n:u32) {self.value.set(n)}
    fn read(&self)->MemberResult<u32> {
        self.reads.set(self.reads.get()+1); match self.fail.borrow().as_ref(){ Some(e)=>Err(e.clone()),None=>Ok(self.value.get()) }
    }
    fn identity(self:&Rc<Self>)->Rc<Self>{self.clone()}
}
workshop::bind_objects!(App{Box=Meter});
inspector::bind_objects!(Peer{Box=Meter});
fn main() {
    let order=std::env::args().nth(1).unwrap();let (api,peer);
    if order=="peer-first" {peer=inspector::Binding::<Peer>::new().unwrap();api=Binding::<App>::new().unwrap();}
    else {assert_eq!(order,"workshop-first");api=Binding::<App>::new().unwrap();peer=inspector::Binding::<Peer>::new().unwrap();}
    let x=Meter::create(23); let y=Meter::create(19);
    let (lx,ly)=(Rc::downgrade(&x),Rc::downgrade(&y));
    let n=(BigUint::from(1u8)<<130usize)+5u8;
    let a=Pair::<App>::new(&x,vec![9,8],n.clone(),&y);
    let clone=a.clone();assert!(Rc::ptr_eq(a.lead().as_rc(),&x));assert_eq!(clone.sequence(),n);
    let generated=api.create_pair(&x).unwrap(); assert_eq!(api.sum_read(&generated,&a).unwrap(),42);
    let before=x.reads.get(); let invalid=Pair::<App>::new(&x,vec![0;17*1024*1024],BigUint::default(),&y);
    assert!(matches!(api.sum_read(&a,&invalid),Err(HostCallError::Boundary(Fault::Limit))));
    assert_eq!(before,x.reads.get());drop(invalid);
    let error:HostError=Rc::new(std::io::Error::other("original meter failed")); x.fail.replace(Some(error.clone()));
    assert!(matches!(api.flip(&a),Err(HostCallError::Host(e)) if Rc::ptr_eq(&e,&error))); x.fail.take();
    let flipped=api.flip(&a).unwrap(); assert!(Rc::ptr_eq(flipped.lead().as_rc(),&y));
    assert_eq!(flipped.sample(),[9,8,23]); assert_eq!(flipped.sequence(),n+1u8);
    let mut copied=flipped.sample();copied[0]=1;assert_eq!(flipped.sample()[0],9);
    let choose=api.choose(&clone).unwrap();drop((a,clone,generated)); assert!(Rc::ptr_eq(choose.call(false).unwrap().as_rc(),&y));
    let temporary=Meter::create(7); let weak=Rc::downgrade(&temporary);
    assert!(matches!(api.duplicate_sample(&temporary,&vec![0;9*1024*1024]),Err(HostCallError::Boundary(Fault::Limit))));
    drop(temporary);assert!(weak.upgrade().is_none());
    assert!(Rc::ptr_eq(choose.call(true).unwrap().as_rc(),&x));choose.close().unwrap();drop(choose);
    drop((x,y));api.close().unwrap();assert!(lx.upgrade().is_some() && ly.upgrade().is_some());
    let kept=flipped.spare(); drop(flipped); assert!(ly.upgrade().is_none() && lx.upgrade().is_some());
    let final_owner=peer.increment(&kept).unwrap();assert!(kept.ptr_eq(&final_owner));drop(kept);peer.close().unwrap();
    assert_eq!(final_owner.read().unwrap(),24);drop(final_owner);assert!(lx.upgrade().is_none());
    println!("{order}: original Rc and error, copied fields, partial export rollback, independent peer retains final owner");
}
