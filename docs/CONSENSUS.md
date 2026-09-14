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
   text. The contract itself — never the model — computes a SHA-256
   `content_digest` of each source's full fetched body and a `context_digest`
   of the bounded excerpt actually shown to the model (identical to
   `content_digest` unless something was truncated).
2. Every **validator** independently repeats step 1 (its own fetch, its own
   classification) and only agrees if `_observations_match` finds an **exact**
   match on every structured field:
   - same `occurrence` class (`CONFIRMED`/`NOT_CONFIRMED`/`INCONCLUSIVE`/`UNAVAILABLE`)
   - same `effective_time` **and** same `time_basis` — unconditionally, for
     every basis. Earlier drafts of this contract only compared time when one
     side claimed `EXPLICIT_SOURCE_TIME`, which let two `PAGE_DATE` results
     disagree on the actual date and still "match." That gap is closed:
     `PAGE_DATE` is held to exactly the same agreement bar as
     `EXPLICIT_SOURCE_TIME`.
   - the **canonical set** of per-source support — every configured source id
     appears exactly once on both sides, with the same stance **and the same
     content/context digests**. Comparison is order-independent (leader and
     validator can list sources in any order) but exact otherwise: a missing
     entry, an extra/unknown source id, a duplicate id, or a digest mismatch
     (meaning the underlying page changed between the two fetches) all fail
     agreement. See `_source_support_signature` in `antecedent_notary.py`.
3. Free-text `reason` and `excerpt` are allowed to differ between leader and
   validators — only the structured, digest-bound fields must match.
4. Before any of the above runs, `_valid_observation_shape` rejects a
   malformed candidate outright: a naive (non-timezone-aware) or otherwise
   unparseable timestamp, a non-boolean where a boolean is required, an
   occurrence/stance/time-basis outside its enum, or a source-support list
   that doesn't exactly cover every configured source id.

If a fetch fails for any source, both leader and validator independently
produce the same deterministic `UNAVAILABLE` result *without ever calling the
model* — a fetch error can never be papered over by an LLM guessing from
missing content. If validators cannot agree for any other reason,
`gl.vm.run_nondet_unsafe` returns a non-`Return` sentinel and the contract
sets the event to `UNAVAILABLE` rather than guessing. See
`tests/contract/test_notary.py` for the full set of regression cases,
including `test_page_date_with_different_times_fails_consensus`,
`test_content_change_between_fetches_fails_closed`,
`test_duplicate_source_id_fails`, and `test_extra_unknown_source_id_fails`.

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

### Timezone normalization

`_parse_iso8601_utc` requires an explicit UTC offset (or `Z`) on every
timestamp and **rejects timezone-naive input outright** — a naive
`"2024-01-01T00:00:00"` fails observation consensus rather than being
silently interpreted in whatever local timezone the executing machine
happens to be in. Once naive input is excluded, `.astimezone(timezone.utc)`
on an aware datetime is computed purely from the timestamp's own stored
offset, so two different representations of the same instant (e.g.
`"2024-01-01T00:00:00+00:00"` and `"2023-12-31T19:00:00-05:00"`) always
normalize to the identical UTC epoch second regardless of host timezone —
see `test_timezone_offsets_for_same_instant_normalize_equal` and
`test_naive_timestamp_rejected_at_observation`.

### Separation bounds apply uniformly, SAME_DAY included

`min_separation_seconds` / `max_separation_seconds` are enforced identically
for every relation. For `SAME_DAY`, "separation" means exactly the same
thing as for `BEFORE`/`AFTER`: the absolute number of seconds between the two
agreed instants — so a pair can require "same UTC calendar day, at least 60
seconds apart" or "same day, no more than one hour apart." Both bounds are
**inclusive** (a separation exactly equal to the minimum or maximum is
accepted). `create_pair` rejects an unsatisfiable configuration up front:
`SAME_DAY` with `min_separation_seconds >= 86400` can never be met by any
two timestamps that share a UTC calendar day. "Same day" itself is a strict
UTC calendar-date comparison — `23:59:59Z` and `00:00:01Z` the next day are
one second apart but are `INVALID_RELATION` against `SAME_DAY`, never `VALID`
by virtue of being close in absolute time. See
`test_same_day_within_bounds_accepted`,
`test_same_day_exceeding_max_separation_rejected`,
`test_midnight_utc_boundary_is_not_same_day`, and
`test_create_pair_rejects_impossible_same_day_min_separation`.

## SUPERSEDES is the one genuinely semantic relation

Whether one notice "materially replaces" another isn't a timestamp
comparison — it requires judgment about subject match and replacement
scope. This is the **only** place a second independent leader/validator
round decides a relation directly (`_resolve_supersedes`), and it still
requires validator agreement on `relation`, `same_subject`, and
`replacement_scope` — not just an overall "yes." `same_subject` is validated
as a strict JSON boolean (`_valid_supersedes_shape`); a truthy string like
`"true"` is rejected outright rather than silently coerced, closing a gap
where Python's truthiness would otherwise have let a malformed model
response through. Like the temporal path, the supersedes round is
digest-bound: `_supersedes_commitment` hashes both events' per-source content
and context digests together with the judgment, and validator agreement
requires this commitment to match too — so a page changing between the
leader's and a validator's supersedes-round fetch fails closed even if the
resulting classification happens to look the same.

## Abstention is a first-class outcome

`INCONCLUSIVE` / `UNAVAILABLE` propagate to certificate status rather than
being coerced into a relation. `finalize_certificate` explicitly branches:
unavailable source(s) → `CERT_UNAVAILABLE`; non-`OBSERVED` event(s) →
`CERT_INCONCLUSIVE`; ambiguous/`UNKNOWN` time on either side →
`CERT_INCONCLUSIVE` even if both events were individually `OBSERVED`. Nothing
downstream (the Gate) can execute against anything but `CERT_VALID`.
