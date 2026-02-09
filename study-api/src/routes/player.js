import { json, error } from '../utils/response.js';

export async function getPlayer(env, user) {
  const player = await env.DB.prepare(
    'SELECT * FROM players WHERE user_id = ?'
  ).bind(user.userId).first();

  if (!player) return error('플레이어를 찾을 수 없습니다', 404);
  return json({ player });
}

export async function updatePlayer(request, env, user) {
  const data = await request.json();
  const { level, exp, hp, attack, defense, gold, data: extraData } = data;

  await env.DB.prepare(
    "UPDATE players SET level=?, exp=?, hp=?, attack=?, defense=?, gold=?, data=?, updated_at=datetime('now') WHERE user_id=?"
  ).bind(
    level ?? 1, exp ?? 0, hp ?? 100, attack ?? 10, defense ?? 5, gold ?? 0,
    extraData ? JSON.stringify(extraData) : null,
    user.userId
  ).run();

  return json({ success: true });
}
