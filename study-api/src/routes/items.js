import { json, error } from '../utils/response.js';

export async function getItems(env, user) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM items WHERE user_id = ? ORDER BY acquired_at DESC'
  ).bind(user.userId).all();
  return json({ items: results });
}

export async function addItem(request, env, user) {
  const data = await request.json();
  const result = await env.DB.prepare(
    'INSERT INTO items (user_id, item_type, item_name, quantity, data) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.userId, data.item_type, data.item_name, data.quantity ?? 1, data.data ? JSON.stringify(data.data) : null).run();
  return json({ success: true, id: result.meta.last_row_id }, 201);
}

export async function updateItem(request, env, user, id) {
  const data = await request.json();
  const item = await env.DB.prepare(
    'SELECT id FROM items WHERE id = ? AND user_id = ?'
  ).bind(id, user.userId).first();
  if (!item) return error('아이템을 찾을 수 없습니다', 404);

  await env.DB.prepare(
    'UPDATE items SET quantity = ?, data = ? WHERE id = ?'
  ).bind(data.quantity ?? 1, data.data ? JSON.stringify(data.data) : null, id).run();
  return json({ success: true });
}
