# Consensus design

## Why a single validator's opinion cannot be authoritative

If one validator (or one centralized operator standing in for "the model")
decided occurrence and time unilaterally, nothing would prevent a false
positive/negative or a fabricated timestamp from becoming a certificate. Two
independent validators disagreeing and both returning `True` would mean the
product is not actually checking substance — it would be checking shape.

Antecedent's consensus is built so that:

1. The **leader** independently fetches the event's frozen sources and asks
   the model to classify occurrence + extract time, strictly from source
   text.
2. Every **validator** independently repeats steps 1 (its own fetch, its own
   classification) and only agrees if the **material fields** match:
   - same `occurrence` class (`CONFIRMED`/`NOT_CONFIRMED`/`INCONCLUSIVE`/`UNAVAILABLE`)
   - same `effective_time` **and** same `time_basis` whenever either side
     claims `EXPLICIT_SOURCE_TIME` (an explicit-vs-explicit mismatch, or an
     explicit-vs-unknown mismatch, both fail agreement)
   - same source support/contradiction direction per source id
3. Free-text `reason` is allowed to differ between leader and validators —
   only the structured, consequential fields must match
   (`_observations_match` in `antecedent_notary.py`).

If validators cannot agree, `gl.vm.run_nondet_unsafe` returns a non-`Return`
sentinel and the contract sets the event to `UNAVAILABLE` rather than
guessing. See `tests/contract/test_notary.py::test_validator_material_disagreement_yields_unavailable`.

## The model never asserts BEFORE/AFTER/SAME_DAY

Once both events in a pair are independently `OBSERVED` with explicit
timestamps, `_resolve_temporal` in `antecedent_notary.py` derives the actual
relation with plain comparison:

```python
if t_a < t_b: derived = BEFORE
elif t_a > t_b: derived = AFTER
else: derived = SAME_DAY
```

and only accepts the certificate as `VALID` if `derived == pair.relation`
and separation bounds hold. This removes an entire class of prompt-injection
or model-persuasion attack: even if a compromised/colluding leader model
tried to claim "B happened before A," the contract's own arithmetic on two
independently-agreed timestamps would produce `INVALID_RELATION` instead.

## SUPERSEDES is the one genuinely semantic relation

Whether one notice "materially replaces" another isn't a timestamp
comparison — it requires judgment about subject match and replacement
scope. This is the **only** place a second independent leader/validator
round decides a relation directly (`_resolve_supersedes`), and it still
requires validator agreement on `relation`, `same_subject`, and
`replacement_scope` — not just an overall "yes."

## Abstention is a first-class outcome

`INCONCLUSIVE` / `UNAVAILABLE` propagate to certificate status rather than
being coerced into a relation. `finalize_certificate` explicitly branches:
unavailable source(s) → `CERT_UNAVAILABLE`; non-`OBSERVED` event(s) →
`CERT_INCONCLUSIVE`; ambiguous/`UNKNOWN` time on either side →
`CERT_INCONCLUSIVE` even if both events were individually `OBSERVED`. Nothing
downstream (the Gate) can execute against anything but `CERT_VALID`.
