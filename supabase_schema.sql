-- Hapus tabel jika sudah ada (hati-hati untuk production!)
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS memories;
DROP TABLE IF EXISTS chat_history;
DROP TABLE IF EXISTS personas;
DROP TABLE IF EXISTS users;

-- 1. Tabel Users
CREATE TABLE users (
    telegram_id BIGINT PRIMARY KEY,
    timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
    daily_photo_limit INT DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Personas (1 user punya 1 bot persona)
CREATE TABLE personas (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE UNIQUE,
    name VARCHAR(50) NOT NULL,
    archetype VARCHAR(50),
    craft VARCHAR(100),
    world_context TEXT,
    backstory TEXT,
    reference_image_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Chat History (Memori Jangka Pendek)
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabel Memories (Memori Jangka Panjang / Fakta)
CREATE TABLE memories (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    event_date DATE, -- Opsional, jika berkaitan dengan hari tertentu
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabel Schedules (Untuk Proactive Care)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    time TIME NOT NULL, -- Format 'HH:MM:SS'
    action VARCHAR(50) NOT NULL, -- misal: 'wakeup_call', 'lunch_reminder'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes untuk mempercepat query
CREATE INDEX idx_chat_history_telegram_id ON chat_history(telegram_id);
CREATE INDEX idx_memories_telegram_id ON memories(telegram_id);
CREATE INDEX idx_schedules_time ON schedules(time);

-- 6. Tabel Bot Logs (Untuk Live Dashboard & Diagnostics)
CREATE TABLE bot_logs (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT,
    level VARCHAR(10) DEFAULT 'INFO', -- 'INFO', 'WARN', 'ERROR'
    event VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Disable Row Level Security (RLS)
-- Diperlukan agar Vercel backend bisa mengakses tabel menggunakan Anon Key tanpa user login session.
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE personas DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE memories DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE bot_logs DISABLE ROW LEVEL SECURITY;
