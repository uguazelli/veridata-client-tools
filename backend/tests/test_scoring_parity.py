"""The Python api-readiness scoring must match the frozen Node output."""
import json
from pathlib import Path

from app.tools.api_readiness.scoring import calculate_assessment_result

GOLDEN = json.loads((Path(__file__).parent / "golden" / "api_readiness.json").read_text(encoding="utf-8"))


def test_python_scoring_matches_golden():
    assert GOLDEN, "golden fixtures missing"
    for case in GOLDEN:
        actual = calculate_assessment_result(case["input"])
        assert json.loads(json.dumps(actual)) == case["expected"], f"mismatch for input: {case['input']}"
