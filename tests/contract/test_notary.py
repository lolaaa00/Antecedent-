import pytest


HTTPS_A = "https://example.org/notice-a"
HTTPS_B = "https://example.org/notice-b"


def _seal(notary, event_id="ev-a", sources=(HTTPS_A,), sender="0xAAAA000000000000000000000000000000AAAA", stub=None):
    if stub:
        stub.CURRENT_SENDER["value"] = sender
    notary.create_event(event_id, "Label", "A material, checkable criterion for the event.", list(sources), "explicit source time only")
    notary.seal_event(event_id)
    return event_id


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
# Observation consensus
# --------------------------------------------------------------------------

def test_observe_confirmed_with_explicit_time(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "Published 2024-01-01T00:00:00Z. It happened."
    response = (
        '{"occurrence": "CONFIRMED", "effective_time": "2024-01-01T00:00:00+00:00", '
        '"time_basis": "EXPLICIT_SOURCE_TIME", "source_support": '
        '[{"source_id": 1, "stance": "SUPPORTS", "excerpt": "It happened."}], "reason": "ok"}'
    )
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "OBSERVED"
    assert ev.observation.occurrence == "CONFIRMED"
    assert ev.observation.effective_time == "2024-01-01T00:00:00+00:00"


def test_observe_cannot_run_twice(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "content"
    response = '{"occurrence": "CONFIRMED", "effective_time": "UNKNOWN", "time_basis": "UNKNOWN", "source_support": [], "reason": "ok"}'
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    with pytest.raises(Exception):
        notary.observe_event("e1")


def test_observe_requires_sealed_status(notary):
    notary.create_event("e1", "Label", "criterion text long enough", [HTTPS_A], "policy")
    with pytest.raises(Exception):
        notary.observe_event("e1")


def test_source_unavailable_yields_unavailable_status(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FAILURES.add(HTTPS_A)
    response = '{"occurrence": "UNAVAILABLE", "effective_time": "UNKNOWN", "time_basis": "UNKNOWN", "source_support": [], "reason": "source fetch failed"}'
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_unsupported_occurrence_yields_inconclusive(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "unrelated content"
    response = '{"occurrence": "NOT_CONFIRMED", "effective_time": "UNKNOWN", "time_basis": "UNKNOWN", "source_support": [], "reason": "criterion not met"}'
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
    leader_response = (
        '{"occurrence": "CONFIRMED", "effective_time": "2024-01-01T00:00:00+00:00", '
        '"time_basis": "EXPLICIT_SOURCE_TIME", "source_support": [], "reason": "ok"}'
    )
    validator_response = (
        '{"occurrence": "NOT_CONFIRMED", "effective_time": "UNKNOWN", '
        '"time_basis": "UNKNOWN", "source_support": [], "reason": "disagree"}'
    )
    stub.PROMPT_QUEUE.extend([leader_response, validator_response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.status == "UNAVAILABLE"


def test_ambiguous_timestamp_stays_unknown(notary, stub):
    _seal(notary, "e1", (HTTPS_A,))
    stub.WEB_FIXTURES[HTTPS_A] = "no dates mentioned here"
    response = '{"occurrence": "CONFIRMED", "effective_time": "UNKNOWN", "time_basis": "UNKNOWN", "source_support": [], "reason": "no explicit time"}'
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("e1")
    ev = notary.get_event("e1")
    assert ev.observation.effective_time == "UNKNOWN"
    assert ev.observation.time_basis == "UNKNOWN"


# --------------------------------------------------------------------------
# Pairs and deterministic relation derivation
# --------------------------------------------------------------------------

def _observe_confirmed(notary, stub, event_id, url, iso_time):
    stub.WEB_FIXTURES[url] = f"published {iso_time}"
    response = (
        f'{{"occurrence": "CONFIRMED", "effective_time": "{iso_time}", '
        '"time_basis": "EXPLICIT_SOURCE_TIME", "source_support": [], "reason": "ok"}'
    )
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event(event_id)


def test_before_derivation(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-06-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources")
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.final_relation == "BEFORE"
    assert cert.status == "VALID"


def test_after_derivation(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-06-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-01-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "AFTER", 0, 0, "independent sources")
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.final_relation == "AFTER"
    assert cert.status == "VALID"


def test_relation_mismatch_is_invalid(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-06-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-01-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources")
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_minimum_separation_enforced(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-01-01T00:00:30+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 3600, 0, "independent sources")
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INVALID_RELATION"


def test_abstention_propagates_to_inconclusive_certificate(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    stub.WEB_FIXTURES[HTTPS_B] = "unrelated"
    response = '{"occurrence": "NOT_CONFIRMED", "effective_time": "UNKNOWN", "time_basis": "UNKNOWN", "source_support": [], "reason": "no"}'
    stub.PROMPT_QUEUE.extend([response, response])
    notary.observe_event("b")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "independent sources")
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"


def test_pair_requires_both_events_differ(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    with pytest.raises(Exception):
        notary.create_pair("p1", "a", "a", "BEFORE", 0, 0, "policy")


def test_pair_rejects_min_greater_than_max(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    with pytest.raises(Exception):
        notary.create_pair("p1", "a", "b", "BEFORE", 100, 10, "policy")


def test_certificate_immutable(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-06-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy")
    notary.finalize_certificate("c1", "p1")
    with pytest.raises(Exception):
        notary.finalize_certificate("c1", "p1")


def test_finalize_rejects_stale_pair_after_definition_mutation(notary, stub):
    # A pair binds definition hashes at creation time. If we could rebind an
    # event's sources under the same event_id post-pairing, the pair would be
    # stale — the contract must detect this via the definition_hash check.
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    notary.create_pair("p1", "a", "b", "BEFORE", 0, 0, "policy")
    pair = notary.pairs["p1"]
    pair.event_a_definition_hash = "tampered"
    with pytest.raises(Exception):
        notary.finalize_certificate("c1", "p1")


def test_supersedes_valid(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy")
    response = (
        '{"relation": "SUPERSEDES", "same_subject": true, '
        '"replacement_scope": "FULL", "evidence": "corrects the earlier notice"}'
    )
    stub.PROMPT_QUEUE.extend([response, response])
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.final_relation == "SUPERSEDES"
    assert cert.status == "VALID"


def test_supersedes_validator_disagreement_yields_inconclusive(notary, stub):
    _seal(notary, "a", (HTTPS_A,))
    _seal(notary, "b", (HTTPS_B,))
    _observe_confirmed(notary, stub, "a", HTTPS_A, "2024-01-01T00:00:00+00:00")
    _observe_confirmed(notary, stub, "b", HTTPS_B, "2024-02-01T00:00:00+00:00")
    notary.create_pair("p1", "a", "b", "SUPERSEDES", 0, 0, "policy")
    leader_response = '{"relation": "SUPERSEDES", "same_subject": true, "replacement_scope": "FULL", "evidence": "x"}'
    validator_response = '{"relation": "COEXISTS", "same_subject": false, "replacement_scope": "NONE", "evidence": "y"}'
    stub.PROMPT_QUEUE.extend([leader_response, validator_response])
    notary.finalize_certificate("c1", "p1")
    cert = notary.get_certificate("c1")
    assert cert.status == "INCONCLUSIVE"
