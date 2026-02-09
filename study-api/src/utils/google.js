// Google ID Token 검증
export async function verifyGoogleToken(idToken, clientId) {
  // Google의 tokeninfo 엔드포인트로 검증
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
  if (!res.ok) return null;

  const payload = await res.json();

  // aud(audience)가 우리 클라이언트 ID와 일치하는지 확인
  if (payload.aud !== clientId) return null;

  // 이메일 인증 확인
  if (payload.email_verified !== 'true') return null;

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || ''
  };
}
