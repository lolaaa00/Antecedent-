import json

import pytest

HTTPS_A = "https://example.org/notice-a"
HTTPS_B = "https://example.org/notice-b"
HTTPS_C = "https://example.org/notice-c"


def _obs(occurrence, effective_time, time_basis, support, reason="ok"):
    return json.dumps({
        "occurrence": occurrence,
        "effective_time": effective_time,
        "time_basis": time_basis,
        "source_support": support,
        "reason": reason,
    })


def _support(*entries):
    return [{"source_id": sid, "stance": stance, "excerpt": excerpt} for sid, stance, excerpt in entries]


def _seal(notary, event_id="ev-a", sources=(HTTPS_A,), sender="0xAAAA000000000000000000000000000000AAAA", stub=None):
    if stub:
        stub.CURRENT_SENDER["value"] = sender
    notary.create_event(event_id, "Label", "A material, checkable criterion for the event.", list(sources), "explicit source time only")
    notary.seal_event(event_id)
    return event_id


def _confirm_one_source(notary, stub, event_id, url, iso_time, time_basis="EXPLICIT_SOURCE_TIME"):
    stub.WEB_FIXTURES[url] = f"published {iso_time}"
    response = _obs("CONFIRMED", iso_time, time_basis, _support((1, "SUPPORTS", "It happened.")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event(event_id)


# --------------------------------------------------------------------------
# Event creation / bounds / authorization
# --------------------------------------------------------------------------

def test_create_event_requires_at_least_one_source(notary):
    with pytest.raises(Exception):
        notary.create_event("e1", "Label", "criterion text long enough", [], "policy")


def test_create_event_rejects_more_than_three_sources(notary):
    urls = [f"https://example.org/{i}" for i in range(4)]
    with pytest.raises(Exception):
        notary.create_event("e1", "Label", "criterion text long enough", urls, "policy")


def test_create_event_rejects_non_https(notary):
    with pytest.raises(Exception):
        notary.create_event("e1", "Label", "criterion text long enough", ["http://example.org/a"], "policy")


def test_create_event_rejects_localhost(notary):
    with pytest.raises(Exception):
        notary.create_event("e1", "Label", "criterion text long enough", ["https://localhost/a"], "policy")


def test_create_event_rejects_embedded_credentials(notary):
    with pytest.raises(Exception):
        notary.create_event("e1", "Label", "criterion text long enough", ["https://user:pass@example.org/a"], "policy")


def test_create_event_rejects_fragment(notary):
    with pytest.raises(Exception):
        notary.create_event("e1", "Label", "criterion text long enough", ["https://example.org/a#frag"], "policy")


def test_create_event_rejects_duplicate_equivalent_urls(notary):
    with pytest.raises(Exception):
        notary.create_event(
            "e1", "Label", "criterion text long enough",
            ["https://example.org/a", "https://example.org/a/"], "policy",
        )


def test_create_event_duplicate_id_rejected(notary):
    notary.create_event("e1", "Label", "criterion text long enough", [HTTPS_A], "policy")
    with pytest.raises(Exception):
        notary.create_event("e1", "Label2", "criterion text long enough", [HTTPS_A], "policy")


def test_seal_only_by_creator(notary, stub):
    stub.CURRENT_SENDER["value"] = "0xAAAA000000000000000000000000000000AAAA"
    notary.create_event("e1", "Label", "criterion text long enough", [HTTPS_A], "policy")
    stub.CURRENT_SENDER["value"] = "0xBBBB000000000000000000000000000000BBBB"
    with pytest.raises(Exception):
        notary.seal_event("e1")


def test_event_immutable_after_seal(notary):
    _seal(notary, "e1")
    ev = notary.get_event("e1")
    assert ev.status == "SEALED"
    with pytest.raises(Exception):
        notary.seal_event("e1")


def test_get_unknown_event_raises(notary):
    with pytest.raises(Exception):
        notary.get_event("does-not-exist")


# --------------------------------------------------------------------------
# Observation consensus — exact-match / fail-closed
# --------------------------------------------------------------------------

def test_observe_confirmed_with_explicit_time(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    _confirm_one_source(notary, stub, "e1", HTTPS_A, "2024-01-01T00:00:00+00:00")
    ev = notary.get_event("e1")
    assert ev.status == "OBSERVED"
    assert ev.observation.occurrence == "CONFIRMED"
    assert ev.observation.effective_time == "2024-01-01T00:00:00+00:00"
    assert ev.observation.source_support[0].content_digest != ""


def test_observe_cannot_run_twice(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    _confirm_one_source(notary, stub, "e1", HTTPS_A, "2024-01-01T00:00:00+00:00")
    with pytest.raises(Exception):
        notary.observe_event("e1")


def test_observe_requires_sealed_status(notary):
    notary.create_event("e1", "Label", "criterion text long enough", [HTTPS_A], "policy")
    with pytest.raises(Exception):
        notary.observe_event("e1")


def test_source_unavailable_yields_unavailable_status(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FAILURES.add(HTTPS_A)
    # No prompt is scripted at all — a fetch failure must be resolved
    # deterministically without ever calling the model.
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"
    assert stub.PROMPT_QUEUE == []


def test_unsupported_occurrence_yields_inconclusive(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "unrelated content"
    response = _obs("NOT_CONFIRMED", "UNKNOWN", "UNKNOWN", _support((1, "UNCLEAR", "no match")), "criterion not met")
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "INCONCLUSIVE"


def test_malformed_model_output_treated_as_disagreement(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "content"
    stub.PROMPT_QUEUE.extend(["not json at all", "not json at all"])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_validator_material_disagreement_yields_unavailable(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "content"
    leader_response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME",
                            _support((1, "SUPPORTS", "x")))
    validator_response = _obs("NOT_CONFIRMED", "UNKNOWN", "UNKNOWN", _support((1, "UNCLEAR", "y")))
    stub.PROMPT_QUEUE.extend([leader_response, validator_response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_ambiguous_timestamp_stays_unknown(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "no dates mentioned here"
    response = _obs("CONFIRMED", "UNKNOWN", "UNKNOWN", _support((1, "SUPPORTS", "x")), "no explicit time")
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.observation.effective_time == "UNKNOWN"
    assert ev.observation.time_basis == "UNKNOWN"


def test_page_date_with_different_times_fails_consensus(notary, stub):
    """PAGE_DATE must never get a pass on time disagreement just because it
    isn't EXPLICIT_SOURCE_TIME — the fix for the reviewed gap."""
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "content"
    leader_response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "PAGE_DATE", _support((1, "SUPPORTS", "x")))
    validator_response = _obs("CONFIRMED", "2024-01-02T00:00:00+00:00", "PAGE_DATE", _support((1, "SUPPORTS", "x")))
    stub.PROMPT_QUEUE.extend([leader_response, validator_response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_page_date_agreement_still_succeeds(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "content"
    response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "PAGE_DATE", _support((1, "SUPPORTS", "x")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "OBSERVED"


def test_naive_timestamp_rejected_at_observation(notary, stub):
    """A timezone-naive timestamp must never be accepted, even if leader and
    validator both (identically) produce it — GenVM cannot let a naive
    timestamp's interpretation depend on the executing machine's local
    timezone."""
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "content"
    response = _obs("CONFIRMED", "2024-01-01T00:00:00", "EXPLICIT_SOURCE_TIME", _support((1, "SUPPORTS", "x")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_missing_source_support_entry_fails(notary, stub):
    _seal(notary, "e1", (HTTPS_A, HTTPS_B))
    stub.WEB_FIXTURES[HTTPS_A] = "a"
    stub.WEB_FIXTURES[HTTPS_B] = "b"
    # Only reports source 1, event has two sources.
    response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME", _support((1, "SUPPORTS", "x")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_extra_unknown_source_id_fails(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "a"
    response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME",
                     _support((1, "SUPPORTS", "x"), (99, "SUPPORTS", "y")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_duplicate_source_id_fails(notary, stub):
    _seal(notary, "e1", (HTTPS_A, HTTPS_B))
    stub.WEB_FIXTURES[HTTPS_A] = "a"
    stub.WEB_FIXTURES[HTTPS_B] = "b"
    response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME",
                     _support((1, "SUPPORTS", "x"), (1, "SUPPORTS", "y")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_malformed_source_support_stance_fails(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "a"
    bad = json.dumps({
        "occurrence": "CONFIRMED", "effective_time": "2024-01-01T00:00:00+00:00", "time_basis": "EXPLICIT_SOURCE_TIME",
        "source_support": [{"source_id": 1, "stance": "MAYBE", "excerpt": "x"}], "reason": "ok",
    })
    stub.PROMPT_QUEUE.extend([bad, bad])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_source_id_as_string_fails(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "a"
    bad = json.dumps({
        "occurrence": "CONFIRMED", "effective_time": "2024-01-01T00:00:00+00:00", "time_basis": "EXPLICIT_SOURCE_TIME",
        "source_support": [{"source_id": "1", "stance": "SUPPORTS", "excerpt": "x"}], "reason": "ok",
    })
    stub.PROMPT_QUEUE.extend([bad, bad])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_reordered_identical_source_support_still_matches(notary, stub):
    _seal(notary, "e1", (HTTPS_A, HTTPS_B))
    stub.WEB_FIXTURES[HTTPS_A] = "a"
    stub.WEB_FIXTURES[HTTPS_B] = "b"
    leader_response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME",
                            _support((1, "SUPPORTS", "x"), (2, "SUPPORTS", "y")))
    # Same set of facts, different order and different (irrelevant) excerpts.
    validator_response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME",
                               _support((2, "SUPPORTS", "different wording"), (1, "SUPPORTS", "other wording")))
    stub.PROMPT_QUEUE.extend([leader_response, validator_response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "OBSERVED"


def test_content_change_between_fetches_fails_closed(notary, stub):
    """If the underlying page changes between the leader's fetch and a
    validator's independent fetch, the content digests diverge even when the
    model's classification happens to agree — this must still fail closed."""
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_SEQUENCES[HTTPS_A] = ["version one of the notice", "version TWO of the notice — edited"]
    response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME", _support((1, "SUPPORTS", "x")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_stable_content_across_fetches_succeeds(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_SEQUENCES[HTTPS_A] = ["stable content", "stable content"]
    response = _obs("CONFIRMED", "2024-01-01T00:00:00+00:00", "EXPLICIT_SOURCE_TIME", _support((1, "SUPPORTS", "x")))
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "OBSERVED"


# --------------------------------------------------------------------------
# Pairs and deterministic relation derivation
# --------------------------------------------------------------------------

def test_before_derivation(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-06-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.final_relation == "BEFORE"
    assert cert.status == "VALID"


def test_after_derivation(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-06-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "AFTER", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.final_relation == "AFTER"
    assert cert.status == "VALID"


def test_relation_mismatch_is_invalid(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-06-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_timezone_offsets_for_same_instant_normalize_equal(notary, stub):
    """Same absolute instant, expressed with different UTC offsets, must
    compare as SAME_DAY / zero separation regardless of the host's local
    timezone."""
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2023-12-31T19:00:00-05:00")
    notary.create_pair("p1", "a", "b", "SAME_DAY", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "VALID"
    assert cert.separation_seconds == 0


# -- separation boundary tests --------------------------------------------

def test_minimum_separation_below_threshold_rejected(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T00:00:59+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 60, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_minimum_separation_exactly_at_threshold_accepted(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T00:01:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 60, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "VALID"
    assert cert.separation_seconds == 60


def test_maximum_separation_exactly_at_threshold_accepted(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T01:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 3600, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "VALID"


def test_maximum_separation_above_threshold_rejected(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T01:00:01+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 3600, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_same_day_within_bounds_accepted(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T01:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T05:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SAME_DAY", 0, 14400, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "VALID"
    assert cert.final_relation == "SAME_DAY"


def test_same_day_exceeding_max_separation_rejected(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T01:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T05:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SAME_DAY", 0, 3600, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_same_day_below_min_separation_rejected(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T01:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-01T01:00:30+00:00")
    notary.create_pair("p1", "a", "b", "SAME_DAY", 3600, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_midnight_utc_boundary_is_not_same_day(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T23:59:59+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-01-02T00:00:01+00:00")
    notary.create_pair("p1", "a", "b", "SAME_DAY", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_create_pair_rejects_impossible_same_day_min_separation(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    with pytest.raises(Exception):
        notary.create_pair("p1", "a", "b", "SAME_DAY", 86400, 0, "independent sources", False)


def test_abstention_propagates_to_inconclusive_certificate(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    stub.WEB_FIXTURES[HTTPS_B] = "unrelated"
    response = _obs("NOT_CONFIRMED", "UNKNOWN", "UNKNOWN", _support((1, "UNCLEAR", "no")), "no")
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("b")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"


def test_fetch_error_never_yields_valid_certificate(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    stub.WEB_FAILURES.add(HTTPS_B)
    notary.observe_event("b")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "UNAVAILABLE"


def test_pair_requires_both_events_differ(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    with pytest.raises(Exception):
        notary.create_pair("p1", "a", "a", "BEFORE", 0, 0, "policy", False)


def test_pair_rejects_min_greater_than_max(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    with pytest.raises(Exception):
        notary.create_pair("p1", "a", "b", "BEFORE", 100, 10, "policy", False)


def test_require_distinct_source_hosts_rejects_shared_host(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", ("https://example.org/notice-b-other",))
    with pytest.raises(Exception):
        notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy", True)


def test_require_distinct_source_hosts_allows_distinct_hosts(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", ("https://other-domain.example/notice",))
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy", True)
    pair = notary.get_pair("p1")
    assert pair.require_distinct_source_hosts is True


def test_certificate_immutable(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-06-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy", False)
    notary.finalize_certificate("c1", "p1")
    with pytest.raises(Exception):
        notary.finalize_certificate("c1", "p1")


def test_finalize_rejects_stale_pair_after_definition_mutation(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy", False)
    pair = notary.pairs["p1"]
    pair.event_a_definition_hash = "tampered"
    with pytest.raises(Exception):
        notary.finalize_certificate("c1", "p1")


def test_certificate_commitment_is_reproducible(notary, stub):
    """The verifier promise: cert_hash must be recomputable purely from
    stored certificate + pair data."""
    import hashlib

    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-06-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy", False)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    pair = notary.get_pair("p1")

    def digest(*parts):
        h = hashlib.sha256()
        for p in parts:
            h.update(str(p).encode("utf-8"))
            h.update(b"\x00")
        return h.hexdigest()

    recomputed = digest(
        "cert-v2", cert.pair_hash, cert.event_a_definition_hash, cert.event_b_definition_hash,
        cert.event_a_observation.evidence_hash, cert.event_b_observation.evidence_hash,
        cert.final_relation, cert.status, str(cert.separation_seconds), cert.supersedes_commitment,
    )
    assert recomputed == cert.certificate_hash
    assert cert.pair_hash == pair.pair_hash


# --------------------------------------------------------------------------
# SUPERSEDES
# --------------------------------------------------------------------------

def _supersedes_json(relation, same_subject, scope, evidence="corrects the earlier notice"):
    return json.dumps({
        "relation": relation, "same_subject": same_subject,
        "replacement_scope": scope, "evidence": evidence,
    })


def test_supersedes_valid(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy", False)
    stub.WEB_FIXTURES[HTTPS_A] = "published 2024-01-01T00:00:00Z"
    stub.WEB_FIXTURES[HTTPS_B] = "published 2024-02-01T00:00:00Z"
    response = _supersedes_json("SUPERSEDES", True, "FULL")
    stub.PROMPT_QUEUE.extend([response, response])
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.final_relation == "SUPERSEDES"
    assert cert.status == "VALID"
    assert cert.supersedes_commitment != ""


def test_supersedes_validator_disagreement_yields_inconclusive(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy", False)
    stub.WEB_FIXTURES[HTTPS_A] = "published 2024-01-01T00:00:00Z"
    stub.WEB_FIXTURES[HTTPS_B] = "published 2024-02-01T00:00:00Z"
    leader_response = _supersedes_json("SUPERSEDES", True, "FULL")
    validator_response = _supersedes_json("COEXISTS", False, "NONE")
    stub.PROMPT_QUEUE.extend([leader_response, validator_response])
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"


def test_supersedes_same_subject_as_string_is_rejected(notary, stub):
    """same_subject must be a real JSON boolean — a truthy string must not
    pass validation just because Python treats it as truthy."""
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy", False)
    stub.WEB_FIXTURES[HTTPS_A] = "published 2024-01-01T00:00:00Z"
    stub.WEB_FIXTURES[HTTPS_B] = "published 2024-02-01T00:00:00Z"
    bad = json.dumps({"relation": "SUPERSEDES", "same_subject": "true", "replacement_scope": "FULL", "evidence": "x"})
    stub.PROMPT_QUEUE.extend([bad, bad])
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"


def test_supersedes_content_change_fails_closed(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy", False)
    stub.WEB_SEQUENCES[HTTPS_A] = ["version one", "version TWO — edited"]
    stub.WEB_FIXTURES[HTTPS_B] = "stable"
    response = _supersedes_json("SUPERSEDES", True, "FULL")
    stub.PROMPT_QUEUE.extend([response, response])
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"


def test_supersedes_fetch_failure_yields_inconclusive(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _confirm_one_source(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _confirm_one_source(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy", False)
    stub.WEB_FAILURES.add(HTTPS_A)
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"
