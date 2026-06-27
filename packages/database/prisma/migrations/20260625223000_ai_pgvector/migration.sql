CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_knowledge_embedding (
  chunk_id TEXT PRIMARY KEY REFERENCES "AiKnowledgeChunk"(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_embedding_team_idx ON ai_knowledge_embedding(team_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_embedding_vector_idx ON ai_knowledge_embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
