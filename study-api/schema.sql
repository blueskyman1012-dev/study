-- 사용자 (Google 로그인)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_google ON users(google_id);

-- 플레이어 게임 데이터
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  level INTEGER DEFAULT 1,
  exp INTEGER DEFAULT 0,
  hp INTEGER DEFAULT 100,
  attack INTEGER DEFAULT 10,
  defense INTEGER DEFAULT 5,
  gold INTEGER DEFAULT 0,
  data TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 오답 몬스터
CREATE TABLE IF NOT EXISTS monsters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  subject TEXT,
  question TEXT,
  answer TEXT,
  wrong_answer TEXT,
  explanation TEXT,
  status TEXT DEFAULT 'alive',
  difficulty INTEGER DEFAULT 1,
  data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  defeated_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_monsters_user ON monsters(user_id);
CREATE INDEX IF NOT EXISTS idx_monsters_subject ON monsters(user_id, subject);
CREATE INDEX IF NOT EXISTS idx_monsters_status ON monsters(user_id, status);

-- 아이템
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  data TEXT,
  acquired_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

-- 플레이 기록
CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  score INTEGER DEFAULT 0,
  monsters_defeated INTEGER DEFAULT 0,
  data TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);

-- 사용자 설정
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  sfx_enabled INTEGER DEFAULT 1,
  bgm_enabled INTEGER DEFAULT 1,
  sound_volume REAL DEFAULT 0.5,
  bgm_volume REAL DEFAULT 0.35,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- API 키 암호화 저장
CREATE TABLE IF NOT EXISTS encrypted_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, key_name),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
