import { json, error } from '../utils/response.js';

export async function getMonsters(env, user) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM monsters WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.userId).all();
  return json({ monsters: results });
}

export async function addMonster(request, env, user) {
  const data = await request.json();
  const result = await env.DB.prepare(
    'INSERT INTO monsters (user_id, subject, question, answer, wrong_answer, explanation, difficulty) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    user.userId, data.subject, data.question, data.answer,
    data.wrong_answer, data.explanation, data.difficulty ?? 1
  ).run();
  return json({ success: true, id: result.meta.last_row_id }, 201);
}

export async function updateMonster(request, env, user, id) {
  const data = await request.json();

  // 본인 몬스터인지 확인
  const monster = await env.DB.prepare(
    'SELECT id FROM monsters WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first();
  if (!monster) return error('몬스터를 찾을 수 없습니다', 404);

  const sets = [];
  const values = [];
  if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status); }
  if (data.defeated_at !== undefined) { sets.push('defeated_at = ?'); values.push(data.defeated_at); }
  if (data.question !== undefined) { sets.push('question = ?'); values.push(data.question); }
  if (data.answer !== undefined) { sets.push('answer = ?'); values.push(data.answer); }

  if (sets.length === 0) return error('수정할 항목이 없습니다');

  values.push(id);
  await env.DB.prepare(
    `UPDATE monsters SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return json({ success: true });
}

export async function deleteMonster(env, user, id) {
  const result = await env.DB.prepare(
    'DELETE FROM monsters WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).run();
  if (result.meta.changes === 0) return error('몬스터를 찾을 수 없습니다', 404);
  return json({ success: true });
}
