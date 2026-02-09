import { verifyJWT } from '../utils/jwt.js';
import { error } from '../utils/response.js';

export async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  return payload;
}

export async function requireAuth(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return { user: null, errorResponse: error('인증이 필요합니다', 401) };
  }
  return { user, errorResponse: null };
}
