# Graph view

A force-directed graph of the vault notes and the current library's papers. Code: `client/src/graph/`. The layout
is ported from Zettlr (see [../third-party.md](../third-party.md)).

## Current behaviour

- Nodes:
  - vault notes: seed notes, literature notes and plain notes;
  - library papers, labelled "Author Year";
  - seed-pipeline candidates that are not in the vault yet (ghost nodes).
- Edges are wikilinks between notes, plus citation links (`client/src/graph/edges.ts`). A citation link comes from a
  paper's `referencedWorks` and its cites / cited-by relations. Notes are matched by any id they contain (OpenAlex
  id, DOI, PMID, arXiv id).
- Library node size and blue fill follow the total score, scaled between the lowest and the highest drawn score
  (`score-scale.ts`). If all drawn scores are equal, every node gets the middle size.
- d3 force layout with zoom and pan. Re-scoring changes node size and colour without re-running the layout.
  Motion is reduced when `prefers-reduced-motion` is set (D-24).

## Invariants

- Edge building is a pure function and is unit-tested.
- The graph never fetches. It draws what the vault and the library store already hold.

## Non-goals

- 3D layouts.
- Editing notes or links from the graph.
