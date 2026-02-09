import { verifyGoogleToken } from '../utils/google.js';
import { createJWT } from '../utils/jwt.js';
import { json, error } from '../utils/response.js';

export async function handleGoogleLogin(request, env) {
  const { token } = await request.json();
  if (!token) return error('토큰이 필요합니다');

  // Google ID Token 검증
  const googleUser = await verifyGoogleToken(token, env.GOOGLE_CLIENT_ID);
  if (!googleUser) return error('Google 인증 실패', 401);

  const { googleId, email, name, picture } = googleUser;

  // 기존 사용자 조회
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE google_id = ?'
  ).bind(googleId).first();

  if (!user) {
    // 첫 로그인 → 자동 회원가입
    const userId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO users (id, google_id, email, name, picture) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, googleId, email, name, picture),
      env.DB.prepare(
        'INSERT INTO players (user_id) VALUES (?)'
      ).bind(userId),
      env.DB.prepare(
        'INSERT INTO user_settings (user_id) VALUES (?)'
      ).bind(userId)
    ]);
    user = { id: userId, google_id: googleId, email, name, picture };
  } else {
    // 기존 사용자 → 로그인 시간 업데이트
    await env.DB.prepare(
      "UPDATE users SET last_login = datetime('now'), name = ?, picture = ? WHERE id = ?"
    ).bind(name, picture, user.id).run();
  }

  // 세션 토큰 발급 (24시간)
  const sessionToken = await createJWT(
    { userId: user.id, email },
    env.JWT_SECRET,
    86400
  );

  return json({
    success: true,
    sessionToken,
    user: { id: user.id, name: user.name || name, email, picture: user.picture || picture }
  });
}

export async function handleMe(request, env, user) {
  const userData = await env.DB.prepare(
    'SELECT id, email, name, picture, created_at FROM users WHERE id = ?'
  ).bind(user.userId).first();

  if (!userData) return error('사용자를 찾을 수 없습니다', 404);
  return json({ user: userData });
}
