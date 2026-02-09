import { encrypt, decrypt } from '../utils/crypto.js';
import { json, error } from '../utils/response.js';

export async function saveKey(request, env, user) {
  const { key_name, key_value } = await request.json();
  if (!key_name || !key_value) return error('key_name과 key_value가 필요합니다');

  const allowed = ['gemini_api_key', 'smileprint_api_key'];
  if (!allowed.includes(key_name)) return error('허용되지 않는 키 이름입니다');

  const { encrypted, iv } = await encrypt(key_value, env.ENCRYPTION_KEY);

  await env.DB.prepare(
    "INSERT INTO encrypted_keys (user_id, key_name, encrypted_value, iv, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, key_name) DO UPDATE SET encrypted_value=?, iv=?, updated_at=datetime('now')"
  ).bind(user.userId, key_name, encrypted, iv, encrypted, iv).run();

  return json({ success: true });
}

// 저장된 키 목록 조회 (복호화하여 반환 - 프론트에서 직접 API 호출용)
export async function getKeys(env, user) {
  const { results } = await env.DB.prepare(
    'SELECT key_name, encrypted_value, iv FROM encrypted_keys WHERE user_id = ?'
  ).bind(user.userId).all();

  const keys = {};
  for (const row of results) {
    try {
      keys[row.key_name] = await decrypt(row.encrypted_value, row.iv, env.ENCRYPTION_KEY);
    } catch {
      keys[row.key_name] = null;
    }
  }
  return json({ keys });
}

export async function deleteKey(env, user, keyName) {
  await env.DB.prepare(
    'DELETE FROM encrypted_keys WHERE user_id = ? AND key_name = ?'
  ).bind(user.userId, keyName).run();
  return json({ success: true });
}

// Gemini API 프록시 (키를 서버에서 복호화하여 호출)
export async function geminiProxy(request, env, user) {
  const keyRow = await env.DB.prepare(
    'SELECT encrypted_value, iv FROM encrypted_keys WHERE user_id = ? AND key_name = ?'
  ).bind(user.userId, 'gemini_api_key').first();

  if (!keyRow) return error('Gemini API 키가 등록되지 않았습니다', 404);

  const apiKey = await decrypt(keyRow.encrypted_value, keyRow.iv, env.ENCRYPTION_KEY);
  const body = await request.json();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();
  return json(data, res.status);
}

// 이미지 분석 프록시
export async function imageProxy(request, env, user) {
  const keyRow = await env.DB.prepare(
    'SELECT encrypted_value, iv FROM encrypted_keys WHERE user_id = ? AND key_name = ?'
  ).bind(user.userId, 'smileprint_api_key').first();

  if (!keyRow) return error('이미지 분석 API 키가 등록되지 않았습니다', 404);

  const apiKey = await decrypt(keyRow.encrypted_value, keyRow.iv, env.ENCRYPTION_KEY);
  const body = await request.json();

  // Gemini로 이미지 분석 (같은 키 사용)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  const data = await res.json();
  return json(data, res.status);
}
