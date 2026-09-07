import TokenBucketCore

namespace LeanTokenBucket

theorem refill_eq (capacity tokens rate elapsed : Nat) :
    refill capacity tokens rate elapsed = min capacity (tokens + elapsed * rate) := by
  unfold refill
  split
  · rename_i full
    omega
  · rename_i notFull
    split
    · rename_i zero
      simp [zero]
      omega
    · rename_i positive
      have ratePositive : 0 < rate := by omega
      split
      · rename_i saturated
        have : capacity - tokens < elapsed * rate :=
          (Nat.div_lt_iff_lt_mul ratePositive).mp saturated
        omega
      · rename_i notSaturated
        have : elapsed * rate ≤ capacity - tokens :=
          (Nat.le_div_iff_mul_le ratePositive).mp (by omega)
        omega

theorem refill_bounded (capacity tokens rate elapsed : Nat) :
    refill capacity tokens rate elapsed ≤ capacity := by
  rw [refill_eq]
  exact Nat.min_le_left _ _

theorem refill_grows (config : Config) (state : State) (valid : Valid config state)
    (elapsed : Nat) : state.tokens ≤ refill config.capacity state.tokens config.rate elapsed := by
  rw [refill_eq]
  unfold Valid at valid
  omega

theorem refill_product_bounded (capacity tokens rate elapsed : Nat)
    (positive : 0 < rate) (unsaturated : elapsed ≤ (capacity - tokens) / rate) :
    elapsed * rate ≤ capacity - tokens :=
  (Nat.le_div_iff_mul_le positive).mp unsaturated

theorem initial_valid (config : Config) (now : Nat) : Valid config (initial config now) :=
  Nat.le_refl _

theorem clock_regression_unchanged (config : Config) (state : State) (now cost : Nat)
    (regression : now < state.last) :
    request config state now cost = ⟨state, 2, state.tokens, 0, none⟩ := by
  simp [request, regression]

theorem request_available (config : Config) (state : State) (now cost : Nat)
    (monotone : state.last ≤ now) :
    (request config state now cost).available =
      min config.capacity (state.tokens + (now - state.last) * config.rate) := by
  simp only [request, Nat.not_lt.mpr monotone, ↓reduceIte]
  split <;> simp [refill_eq]

theorem admitted_iff (config : Config) (state : State) (now cost : Nat) :
    (request config state now cost).status = 0 ↔
      state.last ≤ now ∧
        cost ≤ min config.capacity (state.tokens + (now - state.last) * config.rate) := by
  simp only [request]
  split
  · rename_i regression
    simp only [Nat.reduceEqDiff, false_iff, not_and]
    omega
  · rename_i monotone
    split
    · rename_i admitted
      simp only [true_iff]
      exact ⟨by omega, by simpa [refill_eq] using admitted⟩
    · rename_i rejected
      simp only [Nat.reduceEqDiff, false_iff, not_and]
      simpa [refill_eq] using fun _ => rejected

theorem request_valid (config : Config) (state : State) (valid : Valid config state)
    (now cost : Nat) : Valid config (request config state now cost).state := by
  simp only [request]
  split
  · exact valid
  · have bound := refill_bounded config.capacity state.tokens config.rate (now - state.last)
    split <;> simp only [Valid] <;> omega

theorem request_time_monotone (config : Config) (state : State) (now cost : Nat) :
    state.last ≤ (request config state now cost).state.last := by
  simp only [request]
  split <;> (try split) <;> simp_all <;> omega

theorem request_clock (config : Config) (state : State) (now cost : Nat) :
    (request config state now cost).state.last = max state.last now := by
  simp only [request]
  split <;> (try split) <;> simp_all <;> omega

theorem rejected_unspent (config : Config) (state : State) (now cost : Nat)
    (rejected : (request config state now cost).status ≠ 0) :
    (request config state now cost).state.tokens = (request config state now cost).available := by
  by_cases regression : now < state.last
  · simp [request, regression]
  · by_cases admitted : cost ≤ refill config.capacity state.tokens config.rate (now - state.last)
    · simp [request, regression, admitted] at rejected
    · simp [request, regression, admitted]

/-- Refilling and spending exactly account for the change in stored credit.
Rejected requests spend zero, including requests with regressing clocks. -/
theorem request_conservation (config : Config) (state : State) (valid : Valid config state)
    (now cost : Nat) :
    (request config state now cost).state.tokens + spent cost (request config state now cost) =
      state.tokens + (request config state now cost).refilled := by
  by_cases regression : now < state.last
  · simp [request, spent, regression]
  · have grows := refill_grows config state valid (now - state.last)
    by_cases admitted : cost ≤ refill config.capacity state.tokens config.rate (now - state.last)
    · simp only [request, regression, admitted, ↓reduceIte, spent]
      omega
    · simp only [request, regression, admitted, ↓reduceIte, spent, Nat.reduceEqDiff]
      omega

theorem request_budget (config : Config) (state : State) (now cost : Nat) :
    (request config state now cost).state.tokens + spent cost (request config state now cost) +
      state.last * config.rate ≤
      state.tokens + (request config state now cost).state.last * config.rate := by
  by_cases regression : now < state.last
  · simp [request, spent, regression]
  · have monotone : state.last ≤ now := by omega
    have clock : (now - state.last) * config.rate + state.last * config.rate =
        now * config.rate := by
      rw [← Nat.add_mul, Nat.sub_add_cancel (by omega)]
    have credit : refill config.capacity state.tokens config.rate (now - state.last) ≤
        state.tokens + (now - state.last) * config.rate := by
      rw [refill_eq]
      exact Nat.min_le_right _ _
    by_cases admitted : cost ≤ refill config.capacity state.tokens config.rate (now - state.last)
    · simp only [request, regression, admitted, ↓reduceIte, spent]
      omega
    · simp only [request, regression, admitted, ↓reduceIte, spent, Nat.reduceEqDiff]
      omega

theorem trace_valid (config : Config) (operations : List (Nat × Nat)) (state : State)
    (valid : Valid config state) : Valid config (runTrace config state operations).1 := by
  induction operations generalizing state with
  | nil => exact valid
  | cons operation rest induction =>
    exact induction _ (request_valid config state valid operation.1 operation.2)

theorem trace_time_monotone (config : Config) (operations : List (Nat × Nat)) (state : State) :
    state.last ≤ (runTrace config state operations).1.last := by
  induction operations generalizing state with
  | nil => exact Nat.le_refl _
  | cons operation rest induction =>
    exact Nat.le_trans (request_time_monotone config state operation.1 operation.2) (induction _)

theorem trace_budget (config : Config) (operations : List (Nat × Nat)) (state : State) :
    (runTrace config state operations).1.tokens + (runTrace config state operations).2 +
      state.last * config.rate ≤
      state.tokens + (runTrace config state operations).1.last * config.rate := by
  induction operations generalizing state with
  | nil => simp [runTrace]
  | cons operation rest induction =>
    have one := request_budget config state operation.1 operation.2
    have restBound := induction (request config state operation.1 operation.2).state
    simp only [runTrace]
    omega

/-- Every trace, including any suffix of a longer trace, admits at most the
credit it began with plus refill accrued over its nondecreasing clock interval. -/
theorem trace_no_over_admission (config : Config) (operations : List (Nat × Nat)) (state : State) :
    (runTrace config state operations).2 ≤ state.tokens +
      ((runTrace config state operations).1.last - state.last) * config.rate := by
  have budget := trace_budget config operations state
  have monotone := trace_time_monotone config operations state
  have clock : ((runTrace config state operations).1.last - state.last) * config.rate +
      state.last * config.rate = (runTrace config state operations).1.last * config.rate := by
    rw [← Nat.add_mul, Nat.sub_add_cancel monotone]
  omega

theorem trace_capacity_rate_bound (config : Config) (operations : List (Nat × Nat))
    (state : State) (valid : Valid config state) :
    (runTrace config state operations).2 ≤ config.capacity +
      ((runTrace config state operations).1.last - state.last) * config.rate := by
  have budget := trace_no_over_admission config operations state
  unfold Valid at valid
  omega

theorem trace_append (config : Config) (before after : List (Nat × Nat)) (state : State) :
    runTrace config state (before ++ after) =
      let first := runTrace config state before
      let second := runTrace config first.1 after
      (second.1, first.2 + second.2) := by
  induction before generalizing state with
  | nil => simp [runTrace]
  | cons operation remaining induction =>
    simp only [List.cons_append, runTrace, induction, Nat.add_assoc]

/-- The burst-plus-rate bound applies to every interval in a request history,
not only to the history beginning at initialization. -/
theorem trace_interval_bound (config : Config) (before after : List (Nat × Nat))
    (state : State) (valid : Valid config state) :
    (runTrace config state (before ++ after)).2 - (runTrace config state before).2 ≤
      config.capacity + ((runTrace config state (before ++ after)).1.last -
        (runTrace config state before).1.last) * config.rate := by
  simp only [trace_append, Nat.add_sub_cancel_left]
  exact trace_capacity_rate_bound config after _ (trace_valid config before state valid)

theorem retryDelay_le_iff (config : Config) (available cost delay : Nat)
    (insufficient : available < cost) (possible : cost ≤ config.capacity)
    (positive : 0 < config.rate) :
    (retryDelay config available cost).getD 0 ≤ delay ↔
      cost ≤ available + delay * config.rate := by
  simp only [retryDelay, possible, positive, and_self, ↓reduceIte, Option.getD_some]
  have quotient := Nat.div_lt_iff_lt_mul (x := cost - available - 1) (y := delay) positive
  omega

theorem retryDelay_positive (config : Config) (available cost : Nat)
    (possible : cost ≤ config.capacity) (positive : 0 < config.rate) :
    0 < (retryDelay config available cost).getD 0 := by
  simp [retryDelay, possible, positive]

theorem retryDelay_impossible (config : Config) (available cost : Nat)
    (impossible : config.capacity < cost ∨ config.rate = 0) :
    retryDelay config available cost = none := by
  simp only [retryDelay]
  split
  · omega
  · rfl

/-- A finite retry delay is the first whole tick at which a rejected request
fits, assuming no intervening requests spend the available credit. -/
theorem retryDelay_earliest (config : Config) (available cost delay : Nat)
    (insufficient : available < cost) (possible : cost ≤ config.capacity)
    (positive : 0 < config.rate) :
    cost ≤ refill config.capacity available config.rate delay ↔
      (retryDelay config available cost).getD 0 ≤ delay := by
  rw [refill_eq, retryDelay_le_iff config available cost delay insufficient possible positive]
  omega

theorem request_retry_earliest (config : Config) (state : State) (now cost delay retry : Nat)
    (throttled : (request config state now cost).status = 1)
    (finite : (request config state now cost).retryAfter = some retry) :
    (request config (request config state now cost).state (now + delay) cost).status = 0 ↔
      retry ≤ delay := by
  by_cases regression : now < state.last
  · simp [request, regression] at throttled
  · by_cases admitted : cost ≤ refill config.capacity state.tokens config.rate (now - state.last)
    · simp [request, regression, admitted] at throttled
    · simp only [request, regression, admitted, ↓reduceIte] at finite ⊢
      have insufficient : refill config.capacity state.tokens config.rate (now - state.last) < cost := by
        omega
      have possible : cost ≤ config.capacity ∧ 0 < config.rate := by
        by_cases possible : cost ≤ config.capacity ∧ 0 < config.rate
        · exact possible
        · simp [retryDelay, possible] at finite
      have earliest := retryDelay_earliest config
        (refill config.capacity state.tokens config.rate (now - state.last)) cost delay
        insufficient possible.1 possible.2
      rw [finite] at earliest
      simp only [Option.getD_some] at earliest
      simp only [Nat.not_lt.mpr (Nat.le_add_right now delay), ↓reduceIte,
        Nat.add_sub_cancel_left]
      split <;> simp_all

theorem encode_size (change : Change) : (encode change).size = 7 := rfl

theorem exportedStep_admitted_iff (bucket : Bucket) (now cost : Nat) :
    (exportedStep bucket now cost).output[0]? = some 0 ↔
      bucket.state.last ≤ now ∧ cost ≤ min bucket.config.capacity
        (bucket.state.tokens + (now - bucket.state.last) * bucket.config.rate) := by
  simpa [exportedStep, encode] using admitted_iff bucket.config bucket.state now cost

theorem exportedStep_valid (bucket : Bucket) (valid : Valid bucket.config bucket.state)
    (now cost : Nat) :
    Valid (exportedStep bucket now cost).bucket.config (exportedStep bucket now cost).bucket.state :=
  request_valid bucket.config bucket.state valid now cost

theorem appendOutput_eq (output : Array Nat) (change : Change) :
    appendOutput output change = output ++ encode change := by
  apply Array.toList_inj.mp
  simp [appendOutput, encode, List.append_assoc]

theorem runFrom_state (operations : Array Nat) (remaining index : Nat) (bucket : Bucket)
    (output : Array Nat) :
    (runFrom operations remaining index bucket output).bucket =
      ⟨bucket.config, (runTrace bucket.config bucket.state
        (decodeOperations operations remaining index)).1⟩ := by
  induction remaining generalizing index bucket output with
  | zero => rfl
  | succ remaining induction =>
    simpa only [runFrom, decodeOperations, runTrace] using induction (index + 2)
      ⟨bucket.config, (request bucket.config bucket.state (operations.getD index 0)
        (operations.getD (index + 1) 0)).state⟩
      (appendOutput output (request bucket.config bucket.state (operations.getD index 0)
        (operations.getD (index + 1) 0)))

theorem runFrom_size (operations : Array Nat) (remaining index : Nat) (bucket : Bucket)
    (output : Array Nat) :
    (runFrom operations remaining index bucket output).output.size = output.size + remaining * 7 := by
  induction remaining generalizing index bucket output with
  | zero => simp [runFrom]
  | succ remaining induction =>
    simp only [runFrom, induction, appendOutput_eq, Array.size_append, encode_size]
    omega

theorem runCredits_eq (config : Config) (operations : Array Nat) (remaining index tokens last : Nat)
    (output : Array Nat) :
    runCredits config operations remaining index tokens last output =
      runFrom operations remaining index ⟨config, ⟨tokens, last⟩⟩ output := by
  induction remaining generalizing index tokens last output with
  | zero => rfl
  | succ remaining induction =>
    simpa only [runCredits, runFrom] using induction (index + 2)
      (request config ⟨tokens, last⟩ (operations.getD index 0)
        (operations.getD (index + 1) 0)).state.tokens
      (request config ⟨tokens, last⟩ (operations.getD index 0)
        (operations.getD (index + 1) 0)).state.last
      (appendOutput output (request config ⟨tokens, last⟩ (operations.getD index 0)
        (operations.getD (index + 1) 0)))

theorem exportedRun_valid (bucket : Bucket) (operations : Array Nat)
    (valid : Valid bucket.config bucket.state) :
    Valid (exportedRun bucket operations).bucket.config (exportedRun bucket operations).bucket.state := by
  simp only [exportedRun, runCredits_eq, runFrom_state]
  exact trace_valid _ _ _ valid

theorem exportedRun_size (bucket : Bucket) (operations : Array Nat) :
    (exportedRun bucket operations).output.size = operations.size / 2 * 7 := by
  simp [exportedRun, runCredits_eq, runFrom_size]

/-- The complete observable output of the mathematical trace semantics. -/
def traceWire (config : Config) : State → List (Nat × Nat) → List Nat
  | _, [] => []
  | state, (now, cost) :: remaining =>
    let change := request config state now cost
    (encode change).toList ++ traceWire config change.state remaining

/-- Credit charged according to the status words actually returned to the caller. -/
def wireSpent : List (Nat × Nat) → List Nat → Nat
  | [], _ => 0
  | (_, cost) :: remaining, output =>
    (if output.head? = some 0 then cost else 0) + wireSpent remaining (output.drop 7)

theorem runFrom_wire (operations : Array Nat) (remaining index : Nat) (bucket : Bucket)
    (output : Array Nat) :
    (runFrom operations remaining index bucket output).output.toList = output.toList ++
      traceWire bucket.config bucket.state (decodeOperations operations remaining index) := by
  induction remaining generalizing index bucket output with
  | zero => simp [runFrom, decodeOperations, traceWire]
  | succ remaining induction =>
    simp only [runFrom, decodeOperations, traceWire, induction, appendOutput_eq,
      Array.toList_append, List.append_assoc]

theorem exportedRun_wire (bucket : Bucket) (operations : Array Nat) :
    (exportedRun bucket operations).output.toList = traceWire bucket.config bucket.state
      (decodeOperations operations (operations.size / 2) 0) := by
  simp [exportedRun, runCredits_eq, runFrom_wire]

theorem traceWire_spent (config : Config) (operations : List (Nat × Nat)) (state : State) :
    wireSpent operations (traceWire config state operations) = (runTrace config state operations).2 := by
  induction operations generalizing state with
  | nil => rfl
  | cons operation rest induction =>
    simp only [traceWire, wireSpent, encode, List.cons_append,
      List.nil_append, List.head?_cons, Option.some.injEq, List.drop_succ_cons,
      List.drop_zero, induction, runTrace, spent]

theorem exportedRun_no_over_admission (bucket : Bucket) (operations : Array Nat) :
    wireSpent (decodeOperations operations (operations.size / 2) 0)
      (exportedRun bucket operations).output.toList ≤ bucket.state.tokens +
        ((exportedRun bucket operations).bucket.state.last - bucket.state.last) * bucket.config.rate := by
  rw [exportedRun_wire, traceWire_spent]
  simp only [exportedRun, runCredits_eq, runFrom_state]
  exact trace_no_over_admission _ _ _

theorem retryDelay_bounded (config : Config) (available cost : Nat)
    (insufficient : available < cost) :
    (retryDelay config available cost).getD 0 ≤ cost := by
  unfold retryDelay
  split
  · rename_i possible
    have quotient := Nat.div_le_self (cost - available - 1) config.rate
    simp only [Option.getD_some]
    omega
  · simp

/-- Any bounded adapter can represent every result word without truncation.
This is independent of the machine word size or the chosen units. -/
theorem request_word_bounds (config : Config) (state : State) (bound now cost : Nat)
    (valid : Valid config state) (capacityBound : config.capacity ≤ bound)
    (previousBound : state.last ≤ bound) (nowBound : now ≤ bound) (costBound : cost ≤ bound)
    (statusBound : 2 ≤ bound) :
    ∀ word ∈ (encode (request config state now cost)).toList, word ≤ bound := by
  have tokensBound : state.tokens ≤ bound := Nat.le_trans valid capacityBound
  have availableBound := Nat.le_trans
    (refill_bounded config.capacity state.tokens config.rate (now - state.last)) capacityBound
  by_cases regression : now < state.last
  · simp only [request, regression, ↓reduceIte, encode, List.mem_cons,
      List.not_mem_nil, or_false, Option.isSome_none, Bool.false_eq_true, Option.getD_none]
    intro word member
    rcases member with h | h | h | h | h | h | h <;> subst word <;> omega
  · by_cases admitted : cost ≤ refill config.capacity state.tokens config.rate (now - state.last)
    · simp only [request, regression, admitted, ↓reduceIte, encode,
        List.mem_cons, List.not_mem_nil, or_false, Option.isSome_some, Option.getD_some]
      intro word member
      rcases member with h | h | h | h | h | h | h <;> subst word <;> omega
    · have retryBound := retryDelay_bounded config
        (refill config.capacity state.tokens config.rate (now - state.last)) cost (by omega)
      simp only [request, regression, admitted, ↓reduceIte, encode,
        List.mem_cons, List.not_mem_nil, or_false]
      intro word member
      rcases member with h | h | h | h | h | h | h <;> subst word <;>
        (try split) <;> omega

theorem exportedStep_word_bounds (bucket : Bucket) (bound now cost : Nat)
    (valid : Valid bucket.config bucket.state) (capacityBound : bucket.config.capacity ≤ bound)
    (previousBound : bucket.state.last ≤ bound) (nowBound : now ≤ bound) (costBound : cost ≤ bound)
    (statusBound : 2 ≤ bound) :
    ∀ word ∈ (exportedStep bucket now cost).output.toList, word ≤ bound :=
  request_word_bounds bucket.config bucket.state bound now cost valid capacityBound previousBound
    nowBound costBound statusBound

theorem request_last_bounded (config : Config) (state : State) (bound now cost : Nat)
    (previousBound : state.last ≤ bound) (nowBound : now ≤ bound) :
    (request config state now cost).state.last ≤ bound := by
  simp only [request]
  split
  · exact previousBound
  · split <;> exact nowBound

theorem traceWire_word_bounds (config : Config) (operations : List (Nat × Nat))
    (state : State) (bound : Nat) (valid : Valid config state)
    (capacityBound : config.capacity ≤ bound) (previousBound : state.last ≤ bound)
    (operationBounds : ∀ operation ∈ operations, operation.1 ≤ bound ∧ operation.2 ≤ bound)
    (statusBound : 2 ≤ bound) :
    ∀ word ∈ traceWire config state operations, word ≤ bound := by
  induction operations generalizing state with
  | nil => simp [traceWire]
  | cons operation remaining induction =>
    have first := operationBounds operation (by simp)
    have tail : ∀ item ∈ remaining, item.1 ≤ bound ∧ item.2 ≤ bound := by
      intro item member
      exact operationBounds item (by simp [member])
    intro word member
    simp only [traceWire, List.mem_append] at member
    rcases member with firstMember | restMember
    · exact request_word_bounds config state bound operation.1 operation.2 valid capacityBound
        previousBound first.1 first.2 statusBound word firstMember
    · exact induction _ (request_valid config state valid operation.1 operation.2)
        (request_last_bounded config state bound operation.1 operation.2 previousBound first.1)
        tail word restMember

theorem decodeOperations_bounded (operations : Array Nat) (remaining index bound : Nat)
    (bounded : ∀ value ∈ operations.toList, value ≤ bound) :
    ∀ operation ∈ decodeOperations operations remaining index,
      operation.1 ≤ bound ∧ operation.2 ≤ bound := by
  have getBound : ∀ atIndex, operations.getD atIndex 0 ≤ bound := by
    intro atIndex
    by_cases inside : atIndex < operations.size
    · simp only [Array.getD, inside, ↓reduceDIte]
      exact bounded _ (by simp)
    · simp [Array.getD, inside]
  induction remaining generalizing index with
  | zero => simp [decodeOperations]
  | succ remaining induction =>
    intro operation member
    simp only [decodeOperations, List.mem_cons] at member
    rcases member with first | rest
    · subst operation
      exact ⟨getBound index, getBound (index + 1)⟩
    · exact induction (index + 2) operation rest

theorem exportedRun_word_bounds (bucket : Bucket) (operations : Array Nat) (bound : Nat)
    (valid : Valid bucket.config bucket.state) (capacityBound : bucket.config.capacity ≤ bound)
    (previousBound : bucket.state.last ≤ bound)
    (operationBounds : ∀ value ∈ operations.toList, value ≤ bound) (statusBound : 2 ≤ bound) :
    ∀ word ∈ (exportedRun bucket operations).output.toList, word ≤ bound := by
  rw [exportedRun_wire]
  exact traceWire_word_bounds bucket.config _ bucket.state bound valid capacityBound previousBound
    (decodeOperations_bounded operations _ _ bound operationBounds) statusBound

end LeanTokenBucket
