import { handleCORS, corsHeaders } from './middleware/cors.js';
import { requireAuth } from './middleware/auth.js';
import { handleGoogleLogin, handleMe } from './routes/auth.js';
import { getPlayer, updatePlayer } from './routes/player.js';
import { getMonsters, addMonster, updateMonster, deleteMonster } from './routes/monsters.js';
import { getItems, addItem, updateItem } from './routes/items.js';
import { getRuns, addRun } from './routes/runs.js';
import { getSettings, updateSettings } from './routes/settings.js';
import { getKeys, saveKey, deleteKey, geminiProxy, imageProxy } from './routes/keys.js';
import { json, error } from './utils/response.js';

export default {
  async fetch(request, env) {
    // CORS preflight
    const corsResponse = handleCORS(request, env);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    let response;
    try {
      // 인증 불필요한 라우트
      if (path === '/api/auth/google' && method === 'POST') {
        response = await handleGoogleLogin(request, env);
        return addCors(response, request, env);
      }

      if (path === '/api/health' && method === 'GET') {
        response = json({ status: 'ok', time: new Date().toISOString() });
        return addCors(response, request, env);
      }

      // 이하 인증 필요
      const { user, errorResponse } = await requireAuth(request, env);
      if (errorResponse) return addCors(errorResponse, request, env);

      // Auth
      if (path === '/api/auth/me' && method === 'GET') {
        response = await handleMe(request, env, user);
      }
      // Player
      else if (path === '/api/player' && method === 'GET') {
        response = await getPlayer(env, user);
      }
      else if (path === '/api/player' && method === 'PUT') {
        response = await updatePlayer(request, env, user);
      }
      // Monsters
      else if (path === '/api/monsters' && method === 'GET') {
        response = await getMonsters(env, user);
      }
      else if (path === '/api/monsters' && method === 'POST') {
        response = await addMonster(request, env, user);
      }
      else if (path.match(/^\/api\/monsters\/(\d+)$/) && method === 'PUT') {
        const id = parseInt(path.split('/').pop());
        response = await updateMonster(request, env, user, id);
      }
      else if (path.match(/^\/api\/monsters\/(\d+)$/) && method === 'DELETE') {
        const id = parseInt(path.split('/').pop());
        response = await deleteMonster(env, user, id);
      }
      // Items
      else if (path === '/api/items' && method === 'GET') {
        response = await getItems(env, user);
      }
      else if (path === '/api/items' && method === 'POST') {
        response = await addItem(request, env, user);
      }
      else if (path.match(/^\/api\/items\/(\d+)$/) && method === 'PUT') {
        const id = parseInt(path.split('/').pop());
        response = await updateItem(request, env, user, id);
      }
      // Runs
      else if (path === '/api/runs' && method === 'GET') {
        response = await getRuns(env, user);
      }
      else if (path === '/api/runs' && method === 'POST') {
        response = await addRun(request, env, user);
      }
      // Settings
      else if (path === '/api/settings' && method === 'GET') {
        response = await getSettings(env, user);
      }
      else if (path === '/api/settings' && method === 'PUT') {
        response = await updateSettings(request, env, user);
      }
      // Keys
      else if (path === '/api/keys' && method === 'GET') {
        response = await getKeys(env, user);
      }
      else if (path === '/api/keys' && method === 'POST') {
        response = await saveKey(request, env, user);
      }
      else if (path.match(/^\/api\/keys\/(.+)$/) && method === 'DELETE') {
        const keyName = path.split('/').pop();
        response = await deleteKey(env, user, keyName);
      }
      // Proxy
      else if (path === '/api/gemini/generate' && method === 'POST') {
        response = await geminiProxy(request, env, user);
      }
      else if (path === '/api/image/analyze' && method === 'POST') {
        response = await imageProxy(request, env, user);
      }
      else {
        response = error('Not Found', 404);
      }
    } catch (err) {
      console.error('API Error:', err);
      response = error(`서버 오류: ${err.message}`, 500);
    }

    return addCors(response, request, env);
  }
};

function addCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers
  });
}
