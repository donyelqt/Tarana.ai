// AI & Machine Learning Module
// Dead-code cleanup 2026-09-19 (Osmani review): the intelligentCacheManager
// re-export (smartCacheManager compat alias) had zero importers — all 5
// consumers were ported in commit f064353 and the alias was never deleted.
// Removed. Consumers of generateEmbedding import ../ai/embeddings directly.

export * from "./embeddings";