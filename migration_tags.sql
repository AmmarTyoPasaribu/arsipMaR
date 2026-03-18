-- ============================================
-- ArsipMaR Migration: Email Tags
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================

-- Tabel tags (untuk mengelompokkan email)
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tambah kolom tag_id ke tabel emails
ALTER TABLE emails ADD COLUMN tag_id UUID REFERENCES tags(id) ON DELETE SET NULL;

-- RLS untuk tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for tags" ON tags FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_emails_tag_id ON emails(tag_id);
