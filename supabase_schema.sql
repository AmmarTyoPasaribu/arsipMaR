-- ============================================
-- ArsipMaR Database Schema
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================

-- Tabel users (custom auth - bukan Supabase Auth)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel archives (judul arsip/grup chat)
CREATE TABLE archives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel messages (isi chat dalam arsip)
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  archive_id UUID REFERENCES archives(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel emails (daftar email tersimpan)
CREATE TABLE emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Disable RLS (kita handle auth di application layer via JWT)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Allow all operations via anon key (auth handled in app)
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for archives" ON archives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for messages" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for emails" ON emails FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Indexes for performance
-- ============================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_archives_user_id ON archives(user_id);
CREATE INDEX idx_messages_archive_id ON messages(archive_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_emails_user_id ON emails(user_id);
