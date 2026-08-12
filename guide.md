Bạn là một **Senior AI Engineer / RAG Evaluation Engineer**. Nhiệm vụ của bạn là đọc toàn bộ repository hiện tại và hoàn thành bài lab **Day 14 — AI Evaluation & Benchmarking Pipeline** một cách chính xác, có kiểm thử, không làm tắt và không gây data leakage.

## 1. Mục tiêu tổng thể

Hãy xây dựng hoàn chỉnh một pipeline đánh giá hệ thống RAG theo luồng:

```text
Corpus
data/student_services/*.md
        ↓
Golden Dataset 20 QA
golden_dataset.json
        ↓
domain_assistant.py
        ↓
Retriever lấy contexts
        ↓
Generator tạo actual answer
        ↓
artifacts/actual_answers.json
        ↓
evaluate_answers.py
        ↓
template.py / solution.py
        ↓
5 evaluation metrics
        ↓
artifacts/benchmark_results.json
        ↓
Failure Analysis
        ↓
exercises.md + reflection.md
```

Phải hiểu rõ hai thành phần:

- `domain_assistant.py` = **system under evaluation**, là hệ thống RAG sinh câu trả lời.
- `template.py` = **evaluation engine**, dùng để chấm chất lượng câu trả lời và retrieval.

Tuyệt đối không để `domain_assistant.py` sử dụng:

- `expected_answer`
- gold contexts
- evaluation labels

để sinh câu trả lời.

Điều này sẽ gây **data leakage** và làm benchmark mất ý nghĩa.

---

# 2. Nguyên tắc làm việc

Trước khi sửa code:

1. Đọc toàn bộ:
   - `README.md`
   - `guide_lab.md`
   - `template.py`
   - `domain_assistant.py`
   - `evaluate_answers.py`
   - `validate_golden_dataset.py`
   - `tests/`
   - `exercises.md`
   - `reflection.md`
   - `.env.example`

2. Đọc corpus:
   - `data/student_services/*.md`

3. Tìm toàn bộ:
   - `TODO`
   - `pass`
   - `NotImplementedError`
   - function chưa hoàn thiện.

4. Không tự ý thay đổi API/interface nếu tests đang phụ thuộc vào chúng.

5. Ưu tiên implement đúng specification và tests thay vì viết lại kiến trúc repository.

6. Sau mỗi phần lớn:
   - chạy tests;
   - đọc lỗi;
   - sửa nguyên nhân gốc;
   - không hard-code chỉ để tests pass.

---

# 3. Thiết lập môi trường

Kiểm tra:

```bash
python --version
```

Yêu cầu:

```text
Python >= 3.11
```

Tạo virtual environment nếu chưa có:

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Sau đó chạy baseline:

```bash
pytest tests/ -v
```

Ghi lại:

- bao nhiêu tests được collect;
- bao nhiêu tests fail;
- nguyên nhân fail chính.

Không được bỏ qua tests.

---

# 4. TASK 1 — Data Models

Trong `template.py`, hoàn thiện:

```python
QAPair
EvalResult
overall_score()
```

## QAPair

Model phải chứa đủ dữ liệu cần thiết cho evaluation, ví dụ:

```text
id
question
expected_answer
context / gold_context
retrieved_contexts
difficulty
category
...
```

Nhưng phải bám đúng schema hiện có trong repository và tests.

Không tự ý thêm field bắt buộc nếu không cần.

## EvalResult

Phải có khả năng lưu các metric:

```text
faithfulness
relevance
completeness
context_recall
context_precision
overall_score
```

Hai retrieval metrics có thể optional nếu không truyền contexts.

## overall_score()

Chỉ sử dụng các metric được specification của core yêu cầu.

Không tự ý đưa:

```text
context_recall
context_precision
```

vào overall score nếu thiết kế gốc không yêu cầu.

Hai metric retrieval chủ yếu dùng để **diagnose retriever**.

---

# 5. TASK 2 — RAGASEvaluator

Hoàn thiện class:

```python
RAGASEvaluator
```

và các hàm:

```python
evaluate_faithfulness(...)
evaluate_relevance(...)
evaluate_completeness(...)
evaluate_context_recall(...)
evaluate_context_precision(...)
run_full_eval(...)
```

---

## 5.1 Faithfulness

Mục tiêu:

> Đánh giá answer có grounded trong context hay không.

Heuristic của lab:

```text
Faithfulness
= |answer ∩ context| / |answer|
```

Cần xử lý:

- normalize text;
- lowercase;
- punctuation;
- whitespace;
- tokenization;
- answer rỗng;
- context rỗng;
- tránh divide-by-zero.

Score phải nằm trong:

```text
0.0 <= score <= 1.0
```

---

## 5.2 Relevance

Mục tiêu:

> Answer có thực sự trả lời đúng question không?

Heuristic:

```text
Relevance
= |answer ∩ question| / |question|
```

Xử lý edge cases tương tự.

Score:

```text
0 → 1
```

---

## 5.3 Completeness

Mục tiêu:

> Answer có bao phủ đủ nội dung của expected answer không?

Heuristic:

```text
Completeness
= |answer ∩ expected| / |expected|
```

Nếu expected answer chứa nhiều ý mà actual answer chỉ trả lời một phần:

```text
Completeness phải giảm.
```

---

# 6. Retrieval Metrics

Hai metric này phải chạy trên:

```python
QAPair.retrieved_contexts
```

và giữ nguyên thứ tự ranking mà retriever trả về.

---

## 6.1 Context Recall

Mục tiêu:

> Retriever có lấy đủ evidence cần để trả lời không?

Heuristic:

```text
Context Recall
=
|expected_answer ∩ union(retrieved_chunks)|
/
|expected_answer|
```

Ví dụ:

Expected cần:

```text
A B C D
```

Retrieved contexts chỉ chứa:

```text
A B C
```

thì recall phải thấp hơn 1.

---

## 6.2 Context Precision

Mục tiêu:

> Các context relevant có xuất hiện sớm trong ranking hay không?

Sử dụng:

```text
Average Precision@K
```

Ví dụ ranking tốt:

```text
1 relevant
2 relevant
3 irrelevant
4 irrelevant
```

phải có score cao hơn:

```text
1 irrelevant
2 irrelevant
3 relevant
4 relevant
```

Phải giữ đúng thứ tự retrieved contexts.

---

# 7. run_full_eval()

Hàm:

```python
run_full_eval(..., contexts=None)
```

luôn phải tính ba answer-side metrics:

```text
Faithfulness
Relevance
Completeness
```

Nếu:

```python
contexts is not None
```

thì tính thêm:

```text
Context Recall
Context Precision
```

và lưu chúng vào `EvalResult`.

Nếu không có contexts:

```text
retrieval metrics = None / không tính
```

theo đúng data model và tests.

---

# 8. TASK 3 — LLMJudge

Hoàn thiện:

```python
LLMJudge
```

đặc biệt:

```python
score_response()
detect_bias()
```

---

## 8.1 score_response()

Judge nhận:

```text
Question
Agent Answer
Rubric
```

và trả:

```text
Score: 1–5
Rationale
```

Hãy xây judge prompt rõ ràng, deterministic nhất có thể.

Rubric nên thể hiện:

```text
5 — hoàn toàn chính xác, đầy đủ, relevant và grounded
4 — phần lớn chính xác, chỉ thiếu lỗi nhỏ
3 — đúng một phần nhưng còn thiếu hoặc chưa rõ
2 — có nhiều lỗi hoặc thiếu nhiều ý
1 — sai nghiêm trọng, hallucination hoặc không trả lời câu hỏi
```

Phải parse output một cách robust.

Không giả định LLM lúc nào cũng trả JSON sạch.

Xử lý:

- malformed output;
- missing score;
- score ngoài 1–5;
- empty rationale.

---

# 9. Bias Detection

Implement:

```python
detect_bias()
```

để nhận diện các bias được yêu cầu trong lab.

Ít nhất xem xét:

### Position bias

Judge có xu hướng ưu tiên answer xuất hiện trước.

### Leniency / severity bias

Judge chấm quá dễ hoặc quá khắt khe.

Nếu repository/tests sử dụng tên bias cụ thể thì bám đúng tests.

Ngoài ra trong phần lý thuyết cần nhận thức:

```text
verbosity bias
self-preference bias
```

Khi viết reflection có thể đề xuất:

- randomize answer order;
- multiple judges;
- human calibration.

---

# 10. TASK 4 — BenchmarkRunner

Hoàn thiện:

```python
BenchmarkRunner
```

với:

```python
run()
generate_report()
run_regression()
identify_failures()
```

---

## 10.1 run()

Cho mỗi `QAPair`:

```text
question
   ↓
agent_fn
   ↓
actual answer
   ↓
evaluator
   ↓
EvalResult
```

Khi gọi:

```python
run_full_eval(...)
```

phải truyền:

```python
pair.retrieved_contexts
```

vào optional parameter `contexts`.

Không được bỏ retrieval metrics khi contexts tồn tại.

---

## 10.2 generate_report()

Report cần tổng hợp ít nhất:

```text
total cases
pass rate
average faithfulness
average relevance
average completeness
average context recall
average context precision
```

Hai retrieval averages chỉ tính trên những result thực sự có retrieval score.

Không biến `None` thành `0` vì sẽ làm sai thống kê.

---

## 10.3 run_regression()

So sánh kết quả mới với baseline.

Nếu một metric giảm hơn:

```text
0.05
```

thì đánh dấu regression.

Ví dụ:

```text
Old = 0.85
New = 0.77

Drop = 0.08
=> Regression
```

Phải xử lý float chính xác và edge cases.

---

## 10.4 identify_failures()

Lọc các cases có score dưới threshold.

Trả đủ thông tin để thực hiện failure analysis sau đó.

---

# 11. TASK 5 — FailureAnalyzer

Hoàn thiện:

```python
FailureAnalyzer
```

bao gồm:

```python
categorize_failures()
find_root_cause()
generate_improvement_suggestions()
generate_improvement_log()
```

Failure taxonomy:

```text
hallucination
irrelevant
incomplete
off_topic
refusal
```

Logic cần dựa vào metrics và nội dung answer.

Ví dụ:

### Trường hợp 1

```text
Context Recall thấp
Completeness thấp
```

Khả năng lớn:

```text
retrieval failure → incomplete
```

### Trường hợp 2

```text
Context Recall cao
Context Precision cao
Faithfulness thấp
```

Khả năng lớn:

```text
retriever tốt
generator hallucinate
```

### Trường hợp 3

```text
Relevance thấp
```

Có thể:

```text
routing / generation / intent failure
```

Không chỉ phân loại lỗi mà còn phải đưa ra:

```text
root cause
suggested improvement
improvement log
```

---

# 12. TASK 6 — Golden Dataset 20 QA

Đọc toàn bộ:

```text
data/student_services/*.md
```

và xây:

```text
golden_dataset.json
```

gồm đúng:

```text
20 QA
```

phân bổ:

```text
5 Easy
7 Medium
5 Hard
3 Adversarial
```

---

## 12.1 Easy — 5 câu

Đặc điểm:

```text
Factual lookup
Một document
Một fact tương đối trực tiếp
```

---

## 12.2 Medium — 7 câu

Đặc điểm:

```text
Cần kết hợp quy trình
Có thể cần evidence từ 2–3 đoạn / documents
Có reasoning vừa phải
```

---

## 12.3 Hard — 5 câu

Có thể chứa:

```text
nhiều điều kiện
exception
effective date
ambiguity
multi-step reasoning
```

---

## 12.4 Adversarial — 3 câu

Bao gồm các dạng như:

```text
out-of-scope
prompt injection
false premise
trap question
```

Các câu adversarial phải hợp lý với domain Student Services.

Không tạo câu quá vô nghĩa chỉ để đủ số lượng.

---

# 13. Golden Dataset Requirements

Mỗi QA phải:

1. Có `question` rõ ràng.
2. Có `expected_answer` dựa trên corpus.
3. Có gold evidence / source provenance chính xác.
4. Không tự bịa dữ liệu.
5. Không sử dụng knowledge ngoài corpus nếu task yêu cầu corpus-grounded.
6. Không đưa expected answer cho RAG lúc generation.

Sau khi hoàn thiện chạy:

```bash
python validate_golden_dataset.py
```

Mục tiêu:

```text
PASS
```

Nếu fail:

- đọc lỗi validation;
- sửa dataset;
- chạy lại.

---

# 14. Chạy RAG thật

Phần này yêu cầu:

```text
OPENAI_API_KEY
```

Nếu `.env` chưa tồn tại:

```bash
cp .env.example .env
```

Windows có thể copy thủ công.

Không được commit:

```text
.env
API key
secret
```

Sau khi cấu hình API key:

Chạy workflow của `domain_assistant.py` theo hướng dẫn repository để tạo:

```text
artifacts/actual_answers.json
```

Phải có 20 actual answers.

Kiểm tra:

- đủ 20 ID;
- không lỗi API;
- không answer rỗng bất thường;
- retrieved contexts có tồn tại nếu pipeline hỗ trợ.

---

# 15. Chạy Benchmark

Dùng:

```text
evaluate_answers.py
```

để đưa actual answers vào evaluation core.

Kết quả phải tạo:

```text
artifacts/benchmark_results.json
```

Benchmark phải chứa đủ:

```text
Faithfulness
Relevance
Completeness
Context Recall
Context Precision
```

ở những cases có retrieval data.

Sau đó xác định:

```text
3 cases có performance thấp nhất
```

để làm failure analysis.

---

# 16. Failure Analysis bằng 5 Whys

Với mỗi một trong 3 cases tệ nhất:

Thực hiện:

```text
Failure
 ↓
Why 1?
 ↓
Why 2?
 ↓
Why 3?
 ↓
Why 4?
 ↓
Why 5?
 ↓
Root Cause
 ↓
Improvement
```

Ví dụ:

```text
Failure:
Completeness thấp.

Why 1:
Answer thiếu policy exception.

Why 2:
Retrieved contexts không chứa exception.

Why 3:
Retriever rank document chứa exception quá thấp.

Why 4:
Query và document dùng wording khác nhau.

Why 5:
Pipeline chỉ dựa vào một retrieval strategy.

Root cause:
Lexical/semantic mismatch trong retrieval.

Improvement:
Hybrid retrieval + reranking.
```

Không được viết 5 Whys chung chung.

Mỗi bước phải có quan hệ nhân quả với bước trước.

---

# 17. exercises.md

Hoàn thiện theo đúng worksheet hiện có.

Ít nhất đảm bảo phần benchmark có:

```text
5 metrics
average scores
pass rate
3 cases thấp nhất
```

Phần LLM-as-a-Judge:

```text
rubric 1–5
edge cases
bias discussion
```

Không xóa nội dung đề bài hoặc format cần thiết.

Chỉ điền các phần yêu cầu.

---

# 18. reflection.md

Hoàn thiện một evaluation report có cấu trúc rõ ràng:

## Evaluation Summary

- Tổng số QA
- Distribution
- Pass rate
- Average metrics

## Strengths

Hệ thống làm tốt ở đâu?

## Weaknesses

Metric nào thấp?

## Failure Case 1

- Question
- Expected
- Actual
- Metrics
- Failure category
- 5 Whys
- Root cause
- Improvement

## Failure Case 2

Tương tự.

## Failure Case 3

Tương tự.

## Improvement Log

Ví dụ:

```text
Problem
Root Cause
Proposed Fix
Expected Impact
Priority
```

## Regression Strategy

Mô tả cách dùng evaluation pipeline làm CI/CD quality gate.

Ví dụ:

```text
PR
 ↓
run benchmark
 ↓
compare with baseline
 ↓
metric drop > 0.05?
        ↓
       YES
        ↓
block / flag regression
```

---

# 19. solution/solution.py

Sau khi `template.py` hoàn thiện và tests pass:

Đảm bảo:

```text
solution/solution.py
```

là phiên bản hoàn chỉnh của evaluation core.

Không để:

```text
TODO
pass
NotImplementedError
placeholder
```

trong các phần bắt buộc.

---

# 20. Test Strategy

Sau mỗi major task chạy test phù hợp.

Cuối cùng chạy:

```bash
pytest tests/ -v
```

Mục tiêu:

```text
all required tests passed
```

Nếu test fail:

Không sửa test.

Hãy:

1. đọc assertion;
2. xác định expected behavior;
3. trace code;
4. sửa implementation;
5. chạy lại.

Không hard-code theo test input.

---

# 21. Kiểm tra chất lượng code

Code cần:

```text
clear naming
type hints
docstrings khi cần
small reusable functions
edge case handling
no unnecessary duplication
```

Không over-engineer.

Giữ implementation đơn giản và phù hợp với lab.

---

# 22. Checklist trước khi kết thúc

Phải xác nhận từng mục sau:

```text
[ ] Python environment chạy được
[ ] Dependencies cài thành công
[ ] Required tests pass
[ ] QAPair hoàn chỉnh
[ ] EvalResult hoàn chỉnh
[ ] overall_score() đúng
[ ] Faithfulness hoạt động
[ ] Relevance hoạt động
[ ] Completeness hoạt động
[ ] Context Recall hoạt động
[ ] Context Precision hoạt động
[ ] LLMJudge hoạt động
[ ] Bias detection hoạt động
[ ] BenchmarkRunner hoạt động
[ ] Regression detection > 0.05 hoạt động
[ ] FailureAnalyzer hoạt động
[ ] golden_dataset.json có đúng 20 QA
[ ] Có 5 Easy
[ ] Có 7 Medium
[ ] Có 5 Hard
[ ] Có 3 Adversarial
[ ] validate_golden_dataset.py PASS
[ ] actual_answers.json được tạo
[ ] benchmark_results.json được tạo
[ ] exercises.md hoàn chỉnh
[ ] reflection.md hoàn chỉnh
[ ] Có 3 failure analyses
[ ] Mỗi failure có 5 Whys
[ ] Có improvement log
[ ] Có regression strategy
[ ] solution/solution.py hoàn chỉnh
[ ] Không commit API key hoặc .env
```

---

# 23. Cách báo cáo tiến độ cho tôi

Không chỉ nói:

```text
Done.
```

Sau mỗi phần lớn, báo:

```text
Task:
Files modified:
Implementation:
Tests executed:
Result:
Remaining issue:
```

Ví dụ:

```text
Task 2 — RAGASEvaluator

Files modified:
- template.py

Implemented:
- Faithfulness
- Relevance
- Completeness
- Context Recall
- Context Precision

Tests:
pytest tests/test_evaluator.py -v

Result:
12 passed, 0 failed

Next:
LLMJudge
```

---

# 24. Khi gặp lỗi

Nếu có lỗi:

Không bỏ qua.

Hãy trình bày:

```text
Error
↓
Root cause
↓
Fix
↓
Verification
```

Ví dụ:

```text
Error:
Context precision test failed.

Root cause:
Implementation ignored ranking order.

Fix:
Changed calculation to Average Precision@K based on ranked retrieved_contexts.

Verification:
Relevant tests now pass.
```

---

# 25. Điều cực kỳ quan trọng

Không tối ưu chỉ để benchmark score cao.

Mục tiêu của bài là xây một evaluation pipeline:

```text
repeatable
comparable
automatable
diagnosable
```

Benchmark thấp không nhất thiết có nghĩa bài làm sai.

Điều quan trọng là:

```text
pipeline đúng
metrics đúng
dataset tốt
evidence hợp lệ
failure analysis có căn cứ
tests pass
```

---

# 26. Bắt đầu thực hiện

Bây giờ hãy:

1. Đọc repository.
2. Đọc README và guide.
3. Inspect tests.
4. Chạy baseline tests.
5. Liệt kê TODO.
6. Hoàn thiện Task 1 → Task 5.
7. Chạy tests cho tới khi required tests pass.
8. Xây golden dataset 20 QA.
9. Validate dataset.
10. Chạy RAG thật.
11. Chạy benchmark.
12. Phân tích 3 failures thấp nhất.
13. Hoàn thiện `exercises.md`.
14. Hoàn thiện `reflection.md`.
15. Copy/finalize `solution/solution.py`.
16. Chạy toàn bộ verification lần cuối.

Không dừng ở việc giải thích tôi phải làm gì.

**Hãy trực tiếp inspect code, sửa file, chạy command, đọc lỗi, tiếp tục sửa và hoàn thành toàn bộ bài lab trong repository hiện tại.**

Nếu một bước không thể thực hiện do thiếu API key hoặc dependency bên ngoài, hãy:

- hoàn thành tất cả phần không phụ thuộc bước đó;
- chỉ rõ chính xác blocker;
- đưa đúng command cần chạy sau khi blocker được cung cấp;
- không giả lập kết quả benchmark hoặc tự bịa output.
