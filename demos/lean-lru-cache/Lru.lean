import LruCore

namespace LeanLRU

variable {Key Value : Type} [BEq Key]

@[simp] theorem remove_refines (entries : Array (Entry Key Value)) (key : Key) :
    (remove entries key).toList = Spec.remove entries.toList key := by
  simp [remove, Spec.remove]

theorem remove_size (entries : Array (Entry Key Value)) (key : Key) :
    (remove entries key).size = (Spec.remove entries.toList key).length := by
  simpa only [Array.length_toList] using congrArg List.length (remove_refines entries key)

omit [BEq Key] in
theorem extract_rest (entries : Array (Entry Key Value)) :
    (entries.extract 1 entries.size).toList = entries.toList.drop 1 := by
  simp only [Array.toList_extract, List.extract_eq_take_drop]
  apply List.take_of_length_le
  simp only [List.length_drop, Array.length_toList, Nat.le_refl]

theorem get_refines (cache : Cache Key Value) (key : Key) :
    (get cache key).cache.entries.toList = (Spec.get cache.entries.toList key).1 ∧
    (get cache key).value = (Spec.get cache.entries.toList key).2 := by
  simp only [get, lookup, Spec.get, Array.find?_toList]
  split <;> simp [remove_refines]

theorem put_refines (cache : Cache Key Value) (key : Key) (value : Value) :
    (put cache key value).cache.entries.toList =
      Spec.put cache.capacity cache.entries.toList key value := by
  simp only [put, Spec.put]
  split
  · simp [empty]
  · have size := remove_size cache.entries key
    simp only [size]
    split
    · simp
    · rw [← size]
      simp only [Array.toList_push, extract_rest, remove_refines]

omit [BEq Key] in
theorem empty_valid (capacity : Nat) : Valid (empty capacity : Cache Key Value) := by
  simp [Valid, empty, Unique]

theorem remove_has_other_keys [LawfulBEq Key] (entries : List (Entry Key Value)) (key : Key)
    (entry : Entry Key Value) (member : entry ∈ Spec.remove entries key) :
    entry.1 ≠ key := by
  simpa [Spec.remove] using (List.mem_filter.mp member).2

theorem remove_preserves_order (entries : List (Entry Key Value)) (key : Key) :
    (Spec.remove entries key).Sublist entries := List.filter_sublist

theorem remove_unique (entries : List (Entry Key Value)) (key : Key)
    (unique : Unique entries) : Unique (Spec.remove entries key) :=
  unique.sublist (remove_preserves_order entries key)

omit [BEq Key] in
theorem append_fresh_unique (entries : List (Entry Key Value)) (entry : Entry Key Value)
    (unique : Unique entries) (fresh : ∀ other ∈ entries, other.1 ≠ entry.1) :
    Unique (entries ++ [entry]) := by
  simpa [Unique, List.pairwise_append] using And.intro unique fresh

theorem remove_length_le (entries : List (Entry Key Value)) (key : Key) :
    (Spec.remove entries key).length ≤ entries.length := List.length_filter_le _ _

theorem remove_length_lt_of_found [LawfulBEq Key] (entries : List (Entry Key Value)) (key : Key)
    (entry : Entry Key Value) (found : entries.find? (fun e => e.1 == key) = some entry) :
    (Spec.remove entries key).length < entries.length := by
  have member := List.mem_of_find?_eq_some found
  have matching := List.find?_some found
  apply List.length_filter_lt_length_iff_exists.mpr
  exact ⟨entry, member, by simpa using matching⟩

theorem get_valid [LawfulBEq Key] (cache : Cache Key Value) (key : Key) (valid : Valid cache) :
    Valid (get cache key).cache := by
  rcases valid with ⟨bounded, unique⟩
  unfold get
  split
  · exact ⟨bounded, unique⟩
  · rename_i entry found
    have foundList : cache.entries.toList.find? (fun e => e.1 == key) = some entry := by
      simpa [lookup, Array.find?_toList] using found
    have matching : entry.1 = key := by simpa using List.find?_some foundList
    have shorter := remove_length_lt_of_found cache.entries.toList key entry foundList
    constructor
    · simp only [Array.size_push]
      have := remove_size cache.entries key
      simp only [Array.length_toList] at shorter
      omega
    · simp only [Array.toList_push, remove_refines]
      apply append_fresh_unique _ _ (remove_unique _ _ unique)
      intro other member
      rw [matching]
      exact remove_has_other_keys _ _ _ member

theorem put_valid [LawfulBEq Key] (cache : Cache Key Value) (key : Key) (value : Value)
    (valid : Valid cache) : Valid (put cache key value).cache := by
  rcases valid with ⟨bounded, unique⟩
  have removed := remove_unique cache.entries.toList key unique
  have removedLength := remove_length_le cache.entries.toList key
  have size := remove_size cache.entries key
  unfold put
  split
  · exact empty_valid 0
  · rename_i positive
    dsimp only
    split
    · rename_i room
      constructor
      · simp only [Array.size_push]; omega
      · simp only [Array.toList_push, remove_refines]
        exact append_fresh_unique _ _ removed (remove_has_other_keys _ _)
    · rename_i full
      constructor
      · simp only [Array.size_push, Array.size_extract]
        simp only [Array.length_toList] at removedLength
        omega
      · simp only [Array.toList_push, extract_rest, remove_refines]
        apply append_fresh_unique
        · exact removed.sublist (List.drop_sublist _ _)
        · intro other member
          exact remove_has_other_keys _ _ _ (List.mem_of_mem_drop member)

theorem get_miss_unchanged (cache : Cache Key Value) (key : Key)
    (missing : lookup cache.entries key = none) :
    (get cache key).cache = cache ∧ (get cache key).value = none := by
  simp [get, missing]

theorem get_promotes (cache : Cache Key Value) (key : Key) (entry : Entry Key Value)
    (found : lookup cache.entries key = some entry) :
    (get cache key).cache.entries.toList = Spec.remove cache.entries.toList key ++ [entry] ∧
    (get cache key).value = some entry.2 := by
  simp [get, found]

theorem put_most_recent (cache : Cache Key Value) (key : Key) (value : Value)
    (positive : cache.capacity ≠ 0) :
    (put cache key value).cache.entries.back? = some (key, value) := by
  simp only [put, if_neg positive]
  split <;> simp

theorem zero_capacity (cache : Cache Key Value) (key : Key) (value : Value)
    (zero : cache.capacity = 0) : (put cache key value).cache.entries = #[] := by
  simp [put, zero, empty]

variable [LawfulBEq Key]

theorem remove_find_none (entries : List (Entry Key Value)) (key : Key) :
    (Spec.remove entries key).find? (fun entry => entry.1 == key) = none := by
  apply List.find?_eq_none.mpr
  intro entry member
  simpa using remove_has_other_keys entries key entry member

theorem remove_lookup_other (entries : List (Entry Key Value)) (key other : Key)
    (different : other ≠ key) :
    (Spec.remove entries key).find? (fun entry => entry.1 == other) =
      entries.find? (fun entry => entry.1 == other) := by
  simp only [Spec.remove, List.find?_filter]
  congr 1
  funext entry
  by_cases matching : entry.1 = other
  · simp [matching, different]
  · simp [matching]

theorem get_preserves_values (cache : Cache Key Value) (key queried : Key) :
    lookup (get cache key).cache.entries queried = lookup cache.entries queried := by
  unfold get
  split
  · rfl
  · rename_i entry found
    have matching : entry.1 = key := by
      simpa using (Array.find?_some (p := fun e : Entry Key Value => e.1 == key) found)
    simp only [lookup, ← Array.find?_toList, Array.toList_push, remove_refines,
      List.find?_append]
    by_cases equal : queried = key
    · subst queried
      simp only [remove_find_none, matching, beq_self_eq_true, List.find?_cons,
        Option.none_or]
      simpa only [lookup, ← Array.find?_toList] using found.symm
    · rw [remove_lookup_other _ _ _ equal]
      simp [matching, Ne.symm equal]

theorem put_lookup_written (cache : Cache Key Value) (key : Key) (value : Value)
    (positive : cache.capacity ≠ 0) :
    lookup (put cache key value).cache.entries key = some (key, value) := by
  simp only [put, if_neg positive]
  split
  · simp only [lookup, ← Array.find?_toList, Array.toList_push, remove_refines,
      List.find?_append, remove_find_none]
    simp
  · simp only [lookup, ← Array.find?_toList, Array.toList_push, extract_rest,
      remove_refines, List.find?_append]
    have missing : ((Spec.remove cache.entries.toList key).drop 1).find?
        (fun entry => entry.1 == key) = none := by
      apply List.find?_eq_none.mpr
      intro entry member
      simpa using remove_has_other_keys cache.entries.toList key entry
        (List.mem_of_mem_drop member)
    rw [missing]
    simp

theorem put_existing_no_eviction (cache : Cache Key Value) (key : Key) (value : Value)
    (entry : Entry Key Value) (valid : Valid cache)
    (found : lookup cache.entries key = some entry) :
    (put cache key value).evicted = none ∧ (put cache key value).status = 3 := by
  have foundList : cache.entries.toList.find? (fun e => e.1 == key) = some entry := by
    simpa only [lookup, Array.find?_toList] using found
  have shorter := remove_length_lt_of_found _ _ _ foundList
  have size := remove_size cache.entries key
  have bounded := valid.1
  simp only [Array.length_toList] at shorter
  have positive : cache.capacity ≠ 0 := by omega
  have room : (remove cache.entries key).size < cache.capacity := by omega
  have existed : (remove cache.entries key).size < cache.entries.size := by omega
  simp [put, positive, room, existed]

omit [LawfulBEq Key] in
theorem put_preserves_other_order (cache : Cache Key Value) (key : Key) (value : Value) :
    ((put cache key value).cache.entries.toList.dropLast).Sublist cache.entries.toList := by
  rw [put_refines]
  simp only [Spec.put]
  split
  · simp
  · split
    · simpa using remove_preserves_order cache.entries.toList key
    · simpa using (List.drop_sublist 1 (Spec.remove cache.entries.toList key)).trans
        (remove_preserves_order cache.entries.toList key)

theorem remove_of_missing (entries : Array (Entry Key Value)) (key : Key)
    (missing : lookup entries key = none) : remove entries key = entries := by
  apply Array.toList_inj.mp
  simp only [remove_refines, Spec.remove]
  apply List.filter_eq_self.mpr
  intro entry member
  have absent := List.find?_eq_none.mp
    (show entries.toList.find? (fun e => e.1 == key) = none by
      simpa only [lookup, Array.find?_toList] using missing) entry member
  simpa using absent

theorem remove_size_lt_iff_lookup (entries : Array (Entry Key Value)) (key : Key) :
    (remove entries key).size < entries.size ↔ (lookup entries key).isSome = true := by
  rw [remove_size]
  change (entries.toList.filter (fun entry => entry.1 != key)).length < entries.toList.length ↔ _
  rw [List.length_filter_lt_length_iff_exists]
  simp only [lookup, ← Array.find?_toList, List.find?_isSome]
  simp

theorem fastGet_eq_get (cache : Cache Key Value) (key : Key) (valid : Valid cache) :
    fastGet cache key = get cache key := by
  unfold fastGet
  split
  · rfl
  · rename_i entry last
    split
    · rename_i matching
      have keyEqual : entry.1 = key := eq_of_beq matching
      obtain ⟨leading, shape⟩ := Array.back?_eq_some_iff.mp last
      have distinct := valid.2
      rw [shape] at distinct
      simp only [Array.toList_push, Unique, List.pairwise_append] at distinct
      have fresh : ∀ other ∈ leading.toList, other.1 ≠ key := by
        intro other member
        rw [← keyEqual]
        exact distinct.2.2 other member entry (by simp)
      have noKey : lookup leading key = none := by
        apply Array.find?_eq_none.mpr
        intro other member
        exact by simpa using fresh other (by simpa using member)
      have removed : remove cache.entries key = leading := by
        apply Array.toList_inj.mp
        simp only [remove_refines, shape, Array.toList_push, Spec.remove, List.filter_append]
        have keep : leading.toList.filter (fun entry => entry.1 != key) = leading.toList := by
          apply List.filter_eq_self.mpr
          intro other member
          simpa using fresh other member
        simp [keep, keyEqual]
      have found : lookup cache.entries key = some entry := by
        simp only [lookup] at noKey
        simp [lookup, shape, Array.find?_push, noKey, matching]
      simp only [get, found, removed, ← shape]
    · rfl

theorem put_full_evicts_oldest (cache : Cache Key Value) (key : Key) (value : Value)
    (positive : cache.capacity ≠ 0) (full : cache.entries.size = cache.capacity)
    (missing : lookup cache.entries key = none) :
    (put cache key value).evicted = cache.entries[0]? ∧
    (put cache key value).cache.entries.toList = cache.entries.toList.drop 1 ++ [(key, value)] ∧
    (put cache key value).status = 4 := by
  simp only [put, if_neg positive, remove_of_missing _ _ missing, full,
    Nat.lt_irrefl, if_false]
  rw [← full]
  simp only [Array.toList_push, extract_rest, and_self]

omit [LawfulBEq Key] in
theorem get_most_recent (cache : Cache Key Value) (key : Key) (entry : Entry Key Value)
    (found : lookup cache.entries key = some entry) :
    (get cache key).cache.entries.back? = some entry := by
  simp [get, found]

theorem get_preserves_other_order (cache : Cache Key Value) (key : Key) :
    Spec.remove (get cache key).cache.entries.toList key =
      Spec.remove cache.entries.toList key := by
  unfold get
  split
  · rfl
  · rename_i entry found
    have matching : entry.1 = key := by
      simpa using (Array.find?_some (p := fun e : Entry Key Value => e.1 == key) found)
    simp [Spec.remove, Array.toList_push, remove_refines, matching, List.filter_filter]

theorem run_preserves_valid (operations : Array Nat) (remaining index : Nat)
    (cache : Cache Nat Nat) (output : Array Nat) (valid : Valid cache) :
    Valid (runFrom operations remaining index cache output).cache := by
  induction remaining generalizing index cache output with
  | zero => exact valid
  | succ remaining ih =>
    simp only [runFrom]
    apply ih
    split
    · rw [fastGet_eq_get _ _ valid]
      exact get_valid _ _ valid
    · exact put_valid _ _ _ valid

theorem exported_run_valid (cache : Cache Nat Nat) (operations : Array Nat)
    (valid : Valid cache) : Valid (exportedRun cache operations).cache :=
  run_preserves_valid _ _ _ _ _ valid

theorem exported_get_correct (cache : Cache Nat Nat) (key : Nat) (valid : Valid cache) :
    Valid (exportedGet cache key).cache ∧
    (exportedGet cache key).cache.entries.toList = (Spec.get cache.entries.toList key).1 ∧
    (exportedGet cache key).output[1]? = some ((Spec.get cache.entries.toList key).2.getD 0) := by
  simp only [exportedGet, fastGet_eq_get _ _ valid, encode]
  refine ⟨get_valid _ _ valid, (get_refines _ _).1, ?_⟩
  simp [(get_refines cache key).2]

theorem exported_put_correct (cache : Cache Nat Nat) (key value : Nat) (valid : Valid cache) :
    Valid (exportedPut cache key value).cache ∧
    (exportedPut cache key value).cache.entries.toList =
      Spec.put cache.capacity cache.entries.toList key value :=
  ⟨put_valid _ _ _ valid, put_refines _ _ _⟩

namespace Spec

inductive Operation where
  | read (key : Nat)
  | write (key value : Nat)

/- A list-only event specification, independent of the array transition code. -/
def step (capacity : Nat) (entries : List (Entry Nat Nat)) (operation : Operation) :
    List (Entry Nat Nat) × List Nat :=
  match operation with
  | .read key =>
    match entries.find? (fun entry => entry.1 == key) with
    | none => (entries, [0, 0, 0, 0])
    | some entry => (remove entries key ++ [entry], [1, entry.2, 0, 0])
  | .write key value =>
    if capacity = 0 then ([], [5, value, 0, 0])
    else
      let previous := entries.find? (fun entry => entry.1 == key)
      let kept := remove entries key
      if kept.length < capacity then
        (kept ++ [(key, value)], [if previous.isSome then 3 else 2, value, 0, 0])
      else
        let oldest := kept.head?
        (kept.drop 1 ++ [(key, value)],
          [4, value, (oldest.map Prod.fst).getD 0, (oldest.map Prod.snd).getD 0])

def run (capacity : Nat) (entries : List (Entry Nat Nat)) :
    List Operation → List (Entry Nat Nat) × List Nat
  | [] => (entries, [])
  | operation :: rest =>
    let next := step capacity entries operation
    let result := run capacity next.1 rest
    (result.1, next.2 ++ result.2)

def decode (operations : Array Nat) : Nat → Nat → List Operation
  | 0, _ => []
  | remaining + 1, index =>
    let key := operations.getD (index + 1) 0
    let operation := if operations.getD index 0 = 0 then Operation.read key
      else Operation.write key (operations.getD (index + 2) 0)
    operation :: decode operations remaining (index + 3)

end Spec

theorem encoded_get_refines (cache : Cache Nat Nat) (key : Nat) :
    ((encode (get cache key)).cache.entries.toList, (encode (get cache key)).output.toList) =
      Spec.step cache.capacity cache.entries.toList (.read key) := by
  simp only [get, lookup, ← Array.find?_toList, Spec.step]
  split <;> rename_i found <;>
    simp only [encode, Array.toList_push, remove_refines, found] <;> rfl

theorem encoded_put_refines (cache : Cache Nat Nat) (key value : Nat) :
    ((encode (put cache key value)).cache.entries.toList,
      (encode (put cache key value)).output.toList) =
      Spec.step cache.capacity cache.entries.toList (.write key value) := by
  simp only [put, Spec.step]
  split
  · simp [encode, empty]
  · have size := remove_size cache.entries key
    split
    · rename_i room
      have specRoom : (Spec.remove cache.entries.toList key).length < cache.capacity := by omega
      simp [encode, specRoom]
      simp only [remove_size_lt_iff_lookup]
      simp [lookup]
      rw [Array.find?_toList]
      rfl
    · rename_i full
      have specFull : ¬(Spec.remove cache.entries.toList key).length < cache.capacity := by omega
      simp only [if_neg specFull, encode, Array.toList_push, extract_rest, remove_refines,
        Option.getD_some]
      have head : (remove cache.entries key)[0]? = (Spec.remove cache.entries.toList key).head? := by
        rw [← remove_refines]
        simp only [List.head?_eq_getElem?, Array.getElem?_toList]
      rw [head]

theorem get_capacity (cache : Cache Nat Nat) (key : Nat) :
    (get cache key).cache.capacity = cache.capacity := by
  unfold get
  split <;> rfl

theorem put_capacity (cache : Cache Nat Nat) (key value : Nat) :
    (put cache key value).cache.capacity = cache.capacity := by
  unfold put
  split
  · simpa only [empty] using Eq.symm ‹cache.capacity = 0›
  · dsimp only
    split <;> rfl

theorem run_refines_list_fold (operations : Array Nat) (remaining index : Nat)
    (cache : Cache Nat Nat) (output : Array Nat) (valid : Valid cache) :
    let actual := runFrom operations remaining index cache output
    let expected := Spec.run cache.capacity cache.entries.toList (Spec.decode operations remaining index)
    actual.cache.entries.toList = expected.1 ∧ actual.output.toList = output.toList ++ expected.2 := by
  induction remaining generalizing index cache output with
  | zero => simp [runFrom, Spec.decode, Spec.run]
  | succ remaining ih =>
    simp only [runFrom, Spec.decode, Spec.run]
    split
    · rename_i read
      rw [fastGet_eq_get _ _ valid]
      have step := encoded_get_refines cache (operations.getD (index + 1) 0)
      simp only [encode] at step
      rw [← step]
      have result := ih (index + 3) (get cache (operations.getD (index + 1) 0)).cache
        ((((output.push (get cache (operations.getD (index + 1) 0)).status).push
        ((get cache (operations.getD (index + 1) 0)).value.getD 0)).push
        (((get cache (operations.getD (index + 1) 0)).evicted.map Prod.fst).getD 0)).push
        (((get cache (operations.getD (index + 1) 0)).evicted.map Prod.snd).getD 0))
        (get_valid _ _ valid)
      simpa [get_capacity, List.append_assoc] using result
    · rename_i write
      have step := encoded_put_refines cache (operations.getD (index + 1) 0)
        (operations.getD (index + 2) 0)
      simp only [encode] at step
      rw [← step]
      have result := ih (index + 3)
        (put cache (operations.getD (index + 1) 0) (operations.getD (index + 2) 0)).cache
        ((((output.push
        (put cache (operations.getD (index + 1) 0) (operations.getD (index + 2) 0)).status).push
        ((put cache (operations.getD (index + 1) 0) (operations.getD (index + 2) 0)).value.getD 0)).push
        (((put cache (operations.getD (index + 1) 0) (operations.getD (index + 2) 0)).evicted.map
        Prod.fst).getD 0)).push
        (((put cache (operations.getD (index + 1) 0) (operations.getD (index + 2) 0)).evicted.map
        Prod.snd).getD 0)) (put_valid _ _ _ valid)
      simpa [put_capacity, List.append_assoc] using result

theorem exported_run_refines (cache : Cache Nat Nat) (operations : Array Nat) (valid : Valid cache) :
    let expected := Spec.run cache.capacity cache.entries.toList
      (Spec.decode operations (operations.size / 3) 0)
    (exportedRun cache operations).cache.entries.toList = expected.1 ∧
      (exportedRun cache operations).output.toList = expected.2 := by
  simpa [exportedRun] using run_refines_list_fold operations (operations.size / 3) 0 cache
    (Array.mkEmpty (operations.size / 3 * 4)) valid

theorem exported_empty_valid (capacity : Nat) : Valid (exportedEmpty capacity) := empty_valid capacity

theorem exported_batch_refines (capacity : Nat) (operations : Array Nat) :
    (exportedBatch capacity operations).toList =
      (Spec.run capacity [] (Spec.decode operations (operations.size / 3) 0)).2 :=
  (exported_run_refines (empty capacity) operations (empty_valid capacity)).2

end LeanLRU
