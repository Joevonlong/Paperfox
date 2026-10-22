# Seed pipeline: hold-out results

Measured 2026-10-18. Scripts: `eval/holdout.py`, `eval/reach.py`, `eval/fuse.py`,
`eval/lanes.py` (OpenAlex and PubMed, no keys needed; set `OPENALEX_MAILTO`). These numbers shaped the seed-based
discovery flow ([docs/features/seed-discovery.md](../docs/features/seed-discovery.md)). Library-mode results are in
[RESULTS_LIBRARY.md](RESULTS_LIBRARY.md).

**Method (hold-out).** Take a real review paper. Hide all but 5 of its references; those 5 are the seeds, the review title is the question, and the hidden references are the "relevant" set. Build the candidate pool from the seeds (published before the review only), rank it, and count how many hidden references land in the top 20. Ground truth from one review's reference list is incomplete, so every number here is a lower bound.

Reviews: *Dynamics and specificities of T cells in cancer immunotherapy* (Nat Rev Cancer 2023, 235 refs) and *CD8+ T cell states in human cancer: insights from single-cell analysis* (2020, 93 refs).

## Which discovery routes find relevant papers (recall)

| Route | Review 2023 hits / pool | Review 2020 hits / pool |
|---|---|---|
| R1 references of the seeds | 31 / 397 (13%) | 24 / 305 (27%) |
| R2 papers citing ≥2 seeds | 4 / 28 (2%) | 9 / 238 (10%) |
| R3a OpenAlex `related_works` | **0** / 42 | **0** / 43 |
| R3b PubMed similar articles (60 per seed) | 6 / 286 (3%) | 8 / 297 (9%) |
| **Union R1–R3** | **36 / 734 (16%)** | **37 / 860 (42%)** |
| Baseline: PubMed keyword, top 100 | 4 (2%) | 0 (title query returned no hits) |
| Baseline: OpenAlex search, top 100 | 2 (1%) | 5 (6%) |

## How well each ranking orders that pool (precision at 20)

Base rate of relevant papers in the pool: 5.2% and 4.5%.

| Ranking | Review 2023 | Review 2020 |
|---|---|---|
| Citation count only | 0% | 25% |
| **Seed links only** (seeds it cites + seeds citing it) | **40%** | **35%** |
| Seed links, ties broken by title TF-IDF | 25% | 20% |
| Title TF-IDF only | 5% | 5% |
| RRF(seed links, title TF-IDF) | 30% | 15% |
| 0.5 links + 0.4 text + 0.1 citations (percentiles) | 5% | 10% |

Earlier 3-trial runs with random seeds: seed links beat citation count at top 20 in 4 of 6 trials; weighting seed links by inverse seed popularity (Adamic–Adar style) did not help.

## Lessons that shape the design

1. **The pool caps quality.** The best routes reach 16–42% of the hidden references; keyword search reaches ≤6%. Spend effort on routes first.
2. **Seed links are the strongest signal we have measured:** 7–8× the base rate at top 20.
3. **Citation count alone is unreliable** (0% in one review).
4. **A weak signal blended into a strong one makes ranking worse.** Title TF-IDF dragged every blend down. Abstract embeddings, the reranker and the LLM judge should be much stronger than title TF-IDF, but each one gets weight only after the harness shows it helps.
5. **Drop OpenAlex `related_works`** (0 hits twice).
6. The benchmark favors older papers (a review cites older work). Recent papers are under-counted, which is why "Fresh" and "Bridges" get their own lanes instead of competing on one score.

## Real snapshot: the melanoma example through R1–R3 (no LLM yet)

| Route | Candidates |
|---|---|
| R1 references of the seeds | 238 |
| R2 papers citing ≥2 seeds | 494 |
| R3 PubMed similar articles (60 per seed) | 283 |
| **Union** (overlaps: R1∩R3 18, R2∩R3 13) | **980** |

| Lane | Count | What the top of the lane looks like before the judge |
|---|---|---|
| Core | 545 | 2026 paper citing all 5 seeds (0 citations); *Clonal replacement of tumor-specific T cells following PD-1 blockade* (2019, 4 seed links) |
| Fresh | 0 | Empty: R1–R3 return older work. Fresh papers come from R4 query expansion and the R5 Scout (bioRxiv, medRxiv) |
| Linked | 216 | Generic tool papers by citation count: SAMtools, BWA, STAR, edgeR, *Hallmarks of Cancer* |
| Bridges | 218 | PubMed-similar papers with no citation link, e.g. *Topological Tumor Graphs…* (2019), *CD103+ tumor-resident CD8+ T cells…* (2018) |
| Retracted | 1 | A 1991 paper on T-cell-receptor genes in tumor-infiltrating lymphocytes, flagged by OpenAlex `is_retracted` |

Three rules come out of this snapshot:
- **Generic tools need a facet, not a filter.** Tool papers are noise for an evidence question and exactly right for a method question. The judge labels `paperType: tool` and the Lens moves them.
- **Check dates on citation links.** OpenAlex lists a 2017 review as cited by a 2016 seed. An in-link from seed *s* to candidate *c* counts only if `year(c) ≤ year(s) + 1` (one year of slack for preprints); otherwise it is dropped and logged.
- **Fresh needs its own routes.** Without R4/R5, a run has no recent low-link papers at all.

Snapshot data: [`server/demo/fixtures/melanoma-lanes-snapshot.json`](../server/demo/fixtures/melanoma-lanes-snapshot.json).

