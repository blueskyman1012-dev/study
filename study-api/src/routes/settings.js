import { json, error } from '../utils/response.js';

export async function getSettings(env, user) {
  const settings = await env.DB.prepare(
    'SELECT sfx_enabled, bgm_enabled, sound_volume, bgm_volume FROM user_settings WHERE user_id = ?'
  ).bind(user.userId).first();

  if (!settings) return json({ settings: { sfx_enabled: 1, bgm_enabled: 1, sound_volume: 0.5, bgm_volume: 0.35 } });
  return json({ settings });
}

export async function updateSettings(request, env, user) {
  const data = await request.json();
  await env.DB.prepare(
    "INSERT INTO user_settings (user_id, sfx_enabled, bgm_enabled, sound_volume, bgm_volume, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET sfx_enabled=?, bgm_enabled=?, sound_volume=?, bgm_volume=?, updated_at=datetime('now')"
  ).bind(
    user.userId,
    data.sfx_enabled ?? 1, data.bgm_enabled ?? 1, data.sound_volume ?? 0.5, data.bgm_volume ?? 0.35,
    data.sfx_enabled ?? 1, data.bgm_enabled ?? 1, data.sound_volume ?? 0.5, data.bgm_volume ?? 0.35
  ).run();
  return json({ success: true });
}
