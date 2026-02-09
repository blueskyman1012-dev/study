import { json } from '../utils/response.js';

export async function getRuns(env, user) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM runs WHERE user_id = ? ORDER BY start_time DESC LIMIT 50'
  ).bind(user.userId).all();
  return json({ runs: results });
}

export async function addRun(request, env, user) {
  const data = await request.json();
  const result = await env.DB.prepare(
    'INSERT INTO runs (user_id, start_time, end_time, score, monsters_defeated, data) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    user.userId, data.start_time, data.end_time,
    data.score ?? 0, data.monsters_defeated ?? 0,
    data.data ? JSON.stringify(data.data) : null
  ).run();
  return json({ success: true, id: result.meta.last_row_id }, 201);
}
