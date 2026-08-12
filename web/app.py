"""Neumorphic web test bench for the DomainAssistant RAG system.

Run from the repository root:

    .venv\\Scripts\\python.exe web\\app.py

Then open http://127.0.0.1:5000
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from flask import Flask, jsonify, render_template, request

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from domain_assistant import (
    BM25Retriever,
    DomainAssistant,
    OpenAIGenerator,
    load_corpus,
)

CORPUS_DIR = ROOT / "data" / "student_services"
GOLDEN_DATASET = ROOT / "golden_dataset.json"

app = Flask(__name__, template_folder="templates", static_folder="static")

corpus_id, chunks = load_corpus(CORPUS_DIR)

try:
    generator = OpenAIGenerator()
    generator_error = None
except Exception as exc:  # pragma: no cover - depends on local .env
    generator = None
    generator_error = str(exc)

if generator is None:  # pragma: no cover - depends on local .env
    class _UnavailableGenerator:
        model = "unavailable"

        def generate(self, prompt: str) -> str:
            raise RuntimeError(generator_error or "Generator is unavailable")

    generator = _UnavailableGenerator()

assistant = DomainAssistant(
    corpus_id, BM25Retriever(chunks), generator, top_k=5
)


def _chunk_payload(chunks_) -> list[dict[str, object]]:
    return [
        {
            "source_doc": chunk.source_doc,
            "chunk_id": chunk.chunk_id,
            "score": round(chunk.score, 4),
            "text": chunk.text,
        }
        for chunk in chunks_
    ]


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.get("/api/state")
def state() -> object:
    dataset = json.loads(GOLDEN_DATASET.read_text(encoding="utf-8"))
    quick_questions = [
        {"id": pair["id"], "question": pair["question"]}
        for pair in dataset.get("qa_pairs", [])
    ]
    return jsonify(
        {
            "corpus_id": corpus_id,
            "num_chunks": len(chunks),
            "model": generator.model,
            "top_k": assistant.top_k,
            "generator_error": generator_error,
            "quick_questions": quick_questions,
        }
    )


@app.post("/api/ask")
def ask() -> object:
    data = request.get_json(silent=True) or {}
    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "Question is empty."}), 400

    started = time.perf_counter()
    try:
        response = assistant.answer_with_trace(question)
    except Exception as exc:
        chunks_payload = _chunk_payload(
            assistant.retriever.retrieve(question, assistant.top_k)
        )
        return jsonify(
            {
                "error": str(exc),
                "chunks": chunks_payload,
                "model": generator.model,
            }
        ), 502

    elapsed = time.perf_counter() - started
    return jsonify(
        {
            "question": response.question,
            "answer": response.actual_answer,
            "latency": round(elapsed, 2),
            "model": generator.model,
            "chunks": _chunk_payload(response.retrieved_chunks),
        }
    )


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
