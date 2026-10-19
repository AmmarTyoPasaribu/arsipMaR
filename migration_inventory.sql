-- ============================================
-- ArsipMaR Migration: Inventaris (Website & Layanan)
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================

-- Website yang dimiliki
CREATE TABLE websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  name TEXT DEFAULT '',
  platform TEXT DEFAULT 'other',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Akun layanan (supabase / cloudinary / render) beserta email pemiliknya
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  account_email TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Proyek di bawah sebuah akun layanan
CREATE TABLE service_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS (sama seperti tabel lain: akses diatur di aplikasi)
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for websites" ON websites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for services" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_projects" ON service_projects FOR ALL USING (true) WITH CHECK (true);

-- Index
CREATE INDEX idx_websites_user_id ON websites(user_id);
CREATE INDEX idx_services_user_id ON services(user_id);
CREATE INDEX idx_service_projects_service_id ON service_projects(service_id);
