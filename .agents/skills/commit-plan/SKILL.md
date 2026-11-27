---
name: commit-plan
description: Group a completed EcoCut change into ordered commits with exact files, hunks and proposed subjects.
---

# commit plan

Compare the final diff against the starting status, including staged, unstaged and untracked files. Assign each intended hunk exactly once. Keep tests with the behavior they cover. Put prerequisites first and make each group independently understandable. Provide the ordered subjects and paths. Name hunk headings when a file contains mixed work. Keep developing through intermediate group boundaries. Only execute the specific batch the owner explicitly approves. Before each approved commit inspect the index for unrelated changes. Use the configured identity, exact subject and no trailers. Stop if the diff changed materially; verify the resulting log and leftover changes.


[Upstream workflow](https://github.com/JuliusBrussee/caveman/blob/47c61be2d10a354f0c5cbe2b90959d24c06b16c6/skills/caveman-commit/SKILL.md) · [EcoCut team workflow](../../../docs/team-workflow.md)
