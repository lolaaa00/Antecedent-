import sys
import os
import importlib

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "contracts"))
sys.path.insert(0, os.path.dirname(__file__))

import genlayer_stub  # noqa: E402

genlayer_stub.install()

import antecedent_notary  # noqa: E402
import antecedent_gate  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_stub():
    genlayer_stub.reset_fixtures()
    genlayer_stub.ContractAt._registry.clear()
    yield


@pytest.fixture
def notary():
    importlib.reload(antecedent_notary)
    return antecedent_notary.AntecedentNotary()


@pytest.fixture
def gate():
    importlib.reload(antecedent_gate)
    return antecedent_gate.AntecedentGate()


@pytest.fixture
def stub():
    return genlayer_stub
