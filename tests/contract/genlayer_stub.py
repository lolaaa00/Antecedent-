"""
Minimal local stand-in for the `genlayer` runtime, used ONLY by the pure-Python
unit tests in this directory.

This is NOT a GenVM emulator and does not replace live-network testing. It
exists so that antecedent_notary.py / antecedent_gate.py — written against the
real stable py-genlayer 1jb45aa... runtime — can be imported and exercised
under pytest to unit-test their deterministic logic (hashing, bounds
checking, time derivation, state machine transitions) and to simulate
leader/validator agreement and disagreement with controllable fixtures.

Consensus itself (multi-validator voting, GenVM scheduling, real nondet web
fetch / LLM calls) is stubbed:
- `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` calls leader_fn() once,
  then validator_fn(Return(leader_result)) once. If validation fails, it
  returns a non-Return sentinel (mirroring "no majority" -> contract treats
  as UNAVAILABLE), exactly like the real contract's own handling.
- `gl.nondet.web.render` / `gl.nondet.web.get` / `gl.nondet.exec_prompt` read
  from a per-test registry (`WEB_FIXTURES`, `PROMPT_RESPONSES`) so tests can
  script "what the model/web would have said" without a live network or LLM.
"""

import sys
import types
from dataclasses import dataclass as _dataclass, fields as _fields


# ---------------------------------------------------------------------------
# Test-controllable fixtures
# ---------------------------------------------------------------------------

WEB_FIXTURES: dict[str, str] = {}
WEB_FAILURES: set[str] = set()
PROMPT_QUEUE: list[str] = []
CURRENT_TIME = {"value": 1_700_000_000}
CURRENT_SENDER = {"value": "0xAAAA000000000000000000000000000000AAAA"}


def reset_fixtures():
    WEB_FIXTURES.clear()
    WEB_FAILURES.clear()
    PROMPT_QUEUE.clear()
    CURRENT_TIME["value"] = 1_700_000_000
    CURRENT_SENDER["value"] = "0xAAAA000000000000000000000000000000AAAA"


# ---------------------------------------------------------------------------
# Storage primitives
# ---------------------------------------------------------------------------

class TreeMap(dict):
    pass


class DynArray(list):
    pass


class Address(str):
    def __new__(cls, value):
        return str.__new__(cls, value)


def u32(v):
    return int(v)


def u64(v):
    return int(v)


class _AnyMeta(type):
    def __getitem__(cls, item):
        return cls


class Any(metaclass=_AnyMeta):
    pass


# ---------------------------------------------------------------------------
# gl.vm
# ---------------------------------------------------------------------------

class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class _Disagreement:
    pass


class _Vm:
    Return = Return

    def get_current_transaction_time(self):
        return CURRENT_TIME["value"]

    def run_nondet_unsafe(self, leader_fn, validator_fn):
        try:
            leader_value = leader_fn()
        except Exception:
            return _Disagreement()
        leader_result = Return(leader_value)
        try:
            agreed = validator_fn(leader_result)
        except Exception:
            agreed = False
        if not agreed:
            return _Disagreement()
        return leader_result


class _WebNondet:
    def render(self, url, mode="text"):
        if url in WEB_FAILURES:
            raise RuntimeError(f"fetch failed for {url}")
        return WEB_FIXTURES.get(url, "")

    def get(self, url):
        return self.render(url)


class _Nondet:
    def __init__(self):
        self.web = _WebNondet()

    def exec_prompt(self, prompt, response_format="json"):
        if not PROMPT_QUEUE:
            raise RuntimeError("no scripted prompt response available")
        return PROMPT_QUEUE.pop(0)


class _Message:
    @property
    def sender_address(self):
        return Address(CURRENT_SENDER["value"])


# ---------------------------------------------------------------------------
# gl.public decorators (no-op passthrough — the real runtime enforces the
# read/write distinction at the GenVM boundary, not in Python semantics)
# ---------------------------------------------------------------------------

class _Public:
    @staticmethod
    def view(fn):
        return fn

    @staticmethod
    def write(fn):
        return fn


def contract_interface(cls):
    return cls


class _ContractAtRegistry:
    _registry: dict[str, object] = {}

    def register(self, address: str, instance):
        self._registry[address] = instance

    def __call__(self, address):
        instance = self._registry.get(str(address))
        return _ContractAtHandle(instance)


class _ContractAtHandle:
    def __init__(self, instance):
        self._instance = instance

    def contract(self, _interface):
        return self

    def view(self):
        return self._instance

    def emit(self):
        return self._instance


ContractAt = _ContractAtRegistry()


class Contract:
    pass


class _GL(types.SimpleNamespace):
    pass


gl = _GL(
    Contract=Contract,
    public=_Public(),
    contract_interface=contract_interface,
    vm=_Vm(),
    nondet=_Nondet(),
    message=_Message(),
    ContractAt=ContractAt,
)


def install():
    """Install the fake `genlayer` module into sys.modules before importing contracts."""
    module = types.ModuleType("genlayer")
    module.gl = gl
    module.TreeMap = TreeMap
    module.DynArray = DynArray
    module.Address = Address
    module.u32 = u32
    module.u64 = u64
    module.Any = Any
    # `from genlayer import *` pulls these names directly too
    for name in ("gl", "TreeMap", "DynArray", "Address", "u32", "u64", "Any"):
        setattr(module, name, globals()[name] if name != "gl" else gl)
    module.__all__ = ["gl", "TreeMap", "DynArray", "Address", "u32", "u64", "Any"]
    sys.modules["genlayer"] = module
    return module
