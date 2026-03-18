-- ============================================
-- ArsipMaR Migration: Drive Usage
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================

-- Tambah kolom drive_usage ke tabel emails (dalam GB)
ALTER TABLE emails ADD COLUMN drive_usage REAL DEFAULT 0;
