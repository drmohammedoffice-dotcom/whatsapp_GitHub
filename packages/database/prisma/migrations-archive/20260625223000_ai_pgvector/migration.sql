CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS ai_knowledge_embedding (
  chunk_id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ai_knowledge_embedding
  ADD CONSTRAINT ai_knowledge_embedding_chunk_id_fkey
  FOREIGN KEY (chunk_id) REFERENCES "AiKnowledgeChunk"(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS ai_knowledge_embedding_team_idx ON ai_knowledge_embedding(team_id);
CREATE INDEX IF NOT EXISTS ai_knowledge_embedding_vector_idx ON ai_knowledge_embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
