## Token budget (applies in cloud sessions too). STRICT

Main model (Opus) is the brain: decide, plan, write the hard parts, check. Delegate the rest:
- Gemini 3.8 Flash FIRST for reading, summarizing, drafting, translation work and big-context reads, when available:
  on the owner's PC run `node C:/Users/harsh/.claude/gm.mjs ask "..." --file f` (exit 75 = unavailable, go on down this list).
  Cloud sessions have no Gemini: skip to Haiku/Sonnet.
- Haiku subagent: find/list/count, mechanical sweeps (missing translation keys, unused files), edits from an exact spec.
- Sonnet subagent: coding from a clear plan, tests, refactors, audits needing judgment, research.
- Opus itself: unclear requirements, architecture, hard debugging, security/money/data-loss code, final check.
Briefs for subagents: exact paths, the rule, an output format (table/JSON, file:line), "write UNSURE instead of guessing",
and a check you run on the result. Failed twice: move up one tier. 1 to 3 greps: do them yourself, no agent.

Output: replies terse (no filler, no restating the request, no recaps); full sentences when the owner is deciding.
Never terse in code, commands, commit messages, product text or safety warnings.
Building: smallest complete change; skip unasked extras and name them in one line; never cut validation,
security, data-loss handling, accessibility or anything asked. Hard or high-stakes task: think freely.

Context: one task per session; don't switch model mid-session; Grep then Read with offset/limit (never huge files whole);
pipe long output through tail/grep or a subagent; don't re-read files you just edited; short wrap-ups.
