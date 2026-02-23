// roundRect 폴리필
function ensureRoundRect(ctx) {
  if (!ctx.roundRect) {
    ctx.roundRect = function(x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      const [tl, tr, br, bl] = r;
      this.moveTo(x + tl, y);
      this.lineTo(x + w - tr, y);
      this.quadraticCurveTo(x + w, y, x + w, y + tr);
      this.lineTo(x + w, y + h - br);
      this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
      this.lineTo(x + bl, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - bl);
      this.lineTo(x, y + tl);
      this.quadraticCurveTo(x, y, x + tl, y);
    };
  }
}

// 문제 데이터를 이미지(data URL)로 렌더링
export function renderProblemCard(monster) {
  const canvas = document.createElement('canvas');
  const W = 360, PAD = 20;
  canvas.width = W;
  const ctx = canvas.getContext('2d');
  ensureRoundRect(ctx);

  // 텍스트 줄바꿈 헬퍼
  const wrapText = (text, maxW, font) => {
    ctx.font = font;
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  // 내용 준비
  const question = cleanQuestionText(monster.question) || '문제 없음';
  const answer = monster.answer || '?';
  const topic = monster.topic || '';
  const difficulty = monster.difficulty || 2;
  const choices = monster.choices || [];
  const subjectIcon = { math: '📐', science: '🔬', english: '📖', korean: '📝' }[monster.subject] || '📐';
  const diffStars = ['', '★', '★★', '★★★'][difficulty] || '★★';

  // 높이 사전 계산
  ctx.font = 'bold 16px system-ui';
  const qLines = wrapText(question, W - PAD * 2, 'bold 16px system-ui');
  const choiceLines = [];
  for (let i = 0; i < choices.length; i++) {
    const cLines = wrapText(`${i + 1}. ${choices[i]}`, W - PAD * 2 - 10, '14px system-ui');
    choiceLines.push(cLines);
  }
  const choiceTotalH = choiceLines.reduce((s, c) => s + c.length * 20 + 4, 0);

  let H = PAD + 30 + 12 + qLines.length * 22 + 16;
  if (choices.length > 0) H += 8 + choiceTotalH + 8;
  H += 28 + PAD;
  canvas.height = H;

  // 배경
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a1a2e');
  grad.addColorStop(1, '#16213e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 12);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = 'rgba(99,102,241,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 12);
  ctx.stroke();

  let y = PAD;

  // 헤더: 과목 + 유형 + 난이도
  ctx.font = '13px system-ui';
  ctx.fillStyle = '#818cf8';
  ctx.fillText(`${subjectIcon} ${topic}`, PAD, y + 12);
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.fillText(diffStars, W - PAD, y + 12);
  ctx.textAlign = 'left';
  y += 30;

  // 구분선
  ctx.strokeStyle = 'rgba(99,102,241,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 12;

  // 문제 텍스트
  ctx.font = 'bold 16px system-ui';
  ctx.fillStyle = '#e2e8f0';
  for (const line of qLines) {
    ctx.fillText(line, PAD, y + 14);
    y += 22;
  }
  y += 8;

  // 선택지
  if (choices.length > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 8;

    for (let i = 0; i < choiceLines.length; i++) {
      const isCorrect = i === (monster.correctIndex || 0);
      ctx.fillStyle = isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.08)';
      const blockH = choiceLines[i].length * 20 + 4;
      ctx.beginPath();
      ctx.roundRect(PAD, y, W - PAD * 2, blockH, 6);
      ctx.fill();

      ctx.font = '14px system-ui';
      ctx.fillStyle = isCorrect ? '#22c55e' : '#cbd5e1';
      for (const cl of choiceLines[i]) {
        ctx.fillText(cl, PAD + 8, y + 15);
        y += 20;
      }
      y += 4;
    }
    y += 8;
  }

  // 정답
  ctx.font = 'bold 14px system-ui';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('정답: ', PAD, y + 14);
  const ansX = PAD + ctx.measureText('정답: ').width;
  ctx.fillStyle = '#22c55e';
  ctx.fillText(answer, ansX, y + 14);

  return canvas.toDataURL('image/png');
}

// AI 생성 문제 텍스트 정제 유틸
export function cleanQuestionText(text) {
  if (!text || typeof text !== 'string') return text;
  let t = text;
  // 1. 영어 메타 주석 괄호 제거: (Answer: ...), (Hint: ...), (Topic: ...) 등
  t = t.replace(/\((?:answer|hint|note|difficulty|topic|type|level|correct|solution|explanation|참고)\s*[:：]\s*[^)]*\)/gi, '');
  // 2. 영어 문장 괄호 제거: (Solve for x), (Choose the correct answer) 등
  //    3단어 이상 영어만으로 된 괄호 내용 제거 (수학 변수 f(x), sin(x) 등은 1-2단어라 유지)
  t = t.replace(/\(\s*(?:[A-Za-z]+\s+){2,}[A-Za-z.,!?]*\s*\)/g, '');
  // 3. 마크다운 서식 제거: **bold** → bold, *italic* → italic
  t = t.replace(/\*\*(.+?)\*\*/g, '$1');
  t = t.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1');
  // 4. 문제 번호 접두어 제거: "1. ", "1) ", "Q1. ", "문제 1. " 등
  t = t.replace(/^(?:Q?\d+[.)]\s*|문제\s*\d*[.):：]?\s*)/i, '');
  // 5. 연속 공백 정리
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}
