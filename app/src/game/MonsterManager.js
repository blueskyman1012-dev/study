// 몬스터 관리 (선택, 보스, 난이도, AI문제생성)
import { BOSS_CONFIG, SUBJECTS } from '../utils/constants.js';
import { geminiService } from '../services/GeminiService.js';
import { problemGeneratorService } from '../services/ProblemGeneratorService.js';
import { SoundService } from '../services/SoundService.js';
import { apiService } from '../services/ApiService.js';
import { t } from '../i18n/i18n.js';

export class MonsterManager {
  constructor(db) {
    this.db = db;
    this.monsters = [];
    this._difficultyIndex = { easy: [], medium: [], hard: [] };
  }

  // 난이도별 인덱스 구축 (1회 순회로 3개 배열 분배)
  _buildDifficultyIndex() {
    this._difficultyIndex = { easy: [], medium: [], hard: [] };
    for (const m of this.monsters) {
      const diff = m.difficulty || 2;
      if (diff <= 1) this._difficultyIndex.easy.push(m);
      else if (diff >= 3) this._difficultyIndex.hard.push(m);
      else this._difficultyIndex.medium.push(m);
    }
  }

  async loadMonsters() {
    this.monsters = await this.db.getByIndex('monsters', 'status', 'alive');
    this._buildDifficultyIndex();
  }

  async loadMonstersBySubject(subject) {
    const all = await this.db.getByIndex('monsters', 'status', 'alive');
    if (subject === 'math') {
      this.monsters = all.filter(m => !m.subject || m.subject === 'math');
    } else {
      this.monsters = all.filter(m => m.subject === subject);
    }
    this._buildDifficultyIndex();
  }

  // 보스 타입 확인
  getBossType(stage) {
    if (BOSS_CONFIG.FINAL_BOSS.stages.includes(stage)) return 'FINAL_BOSS';
    if (BOSS_CONFIG.MID_BOSS.stages.includes(stage)) return 'MID_BOSS';
    if (BOSS_CONFIG.NORMAL_BOSS.stages.includes(stage)) return 'NORMAL_BOSS';
    return null;
  }

  // 적응형 난이도로 몬스터 선택 (인덱스 직접 참조)
  selectMonsterByDifficulty(accuracyRate, totalAnswers) {
    if (totalAnswers < 5) {
      const beginnerPool = this.monsters.filter(m => (m.difficulty || 2) <= 2);
      const pool = beginnerPool.length > 0 ? beginnerPool : this.monsters;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    const { easy, medium, hard } = this._difficultyIndex;
    let targetPool;

    if (accuracyRate >= 0.8) {
      targetPool = hard.length > 0 ? hard : medium;
      if (Math.random() < 0.7 && targetPool.length > 0) {
        return targetPool[Math.floor(Math.random() * targetPool.length)];
      }
    } else if (accuracyRate < 0.5) {
      targetPool = easy.length > 0 ? easy : medium;
      if (Math.random() < 0.7 && targetPool.length > 0) {
        return targetPool[Math.floor(Math.random() * targetPool.length)];
      }
    }

    return this.monsters[Math.floor(Math.random() * this.monsters.length)];
  }

  // 다음 몬스터 준비
  prepareMonster(selectedMonster, stage, effects) {
    const currentMonster = { ...selectedMonster };
    if (selectedMonster.questions && selectedMonster.questions.length > 0) {
      currentMonster.questions = [...selectedMonster.questions];
    }
    currentMonster.currentQuestionIndex = -1;

    // 문제 선택
    if (currentMonster.questions && currentMonster.questions.length > 0) {
      const qIdx = Math.floor(Math.random() * currentMonster.questions.length);
      const selectedQ = currentMonster.questions[qIdx];
      currentMonster.question = selectedQ.question;
      currentMonster.answer = selectedQ.answer;
      currentMonster.choices = selectedQ.choices || [];
      currentMonster.correctIndex = selectedQ.correctIndex || 0;
      currentMonster.explanation = selectedQ.explanation || '';
    }

    // 보스 체크
    const bossType = this.getBossType(stage);
    currentMonster.bossType = bossType;

    if (bossType) {
      const bossConfig = BOSS_CONFIG[bossType];
      const bossBaseName = t(bossConfig.nameKey);
      const bossTopic = currentMonster.topic || '';
      currentMonster.name = bossTopic
        ? `${bossConfig.icon} ${bossTopic} ${bossBaseName}`
        : `${bossConfig.icon} ${bossBaseName}`;
      currentMonster.hp = Math.round(currentMonster.maxHp * bossConfig.hpMultiplier);
      currentMonster.maxHp = currentMonster.hp;
      currentMonster.goldMultiplier = bossConfig.goldMultiplier;
      currentMonster.damageMultiplier = bossConfig.damageMultiplier;
      currentMonster.icon = bossConfig.icon;

      this._ensureBossDifficulty(currentMonster);

      SoundService.playBossAppear();
      effects.startBossEntrance();
    } else {
      this._assignMonsterAppearance(currentMonster, stage);
    }

    // 선택지 생성 및 섞기
    this._prepareChoices(currentMonster);

    return currentMonster;
  }

  _assignMonsterAppearance(monster, stage) {
    const monsterTypes = [
      { icon: '👾', nameKeys: { math: 'mon.slime', english: 'mon.blob', korean: 'mon.muryeong', science: 'mon.jelly' } },
      { icon: '💀', nameKeys: { math: 'mon.skeleton', english: 'mon.skelleton', korean: 'mon.baekgol', science: 'mon.boneguard' } },
      { icon: '🦇', nameKeys: { math: 'mon.bat', english: 'mon.batwing', korean: 'mon.yacha', science: 'mon.flying' } },
      { icon: '🧟', nameKeys: { math: 'mon.zombie', english: 'mon.undead', korean: 'mon.gangsi', science: 'mon.mutant' } },
      { icon: '👻', nameKeys: { math: 'mon.ghost', english: 'mon.ghosty', korean: 'mon.wongui', science: 'mon.specter' } },
      { icon: '🕷️', nameKeys: { math: 'mon.spider', english: 'mon.spidery', korean: 'mon.dokchung', science: 'mon.arachne' } }
    ];

    // 난이도 기반 아이콘 선택: 쉬움(0-1), 보통(2-3), 어려움(4-5)
    const difficulty = monster.difficulty || 2;
    const diffOffset = difficulty <= 1 ? 0 : difficulty >= 3 ? 4 : 2;
    const typeIdx = (diffOffset + stage) % monsterTypes.length;
    const monsterType = monsterTypes[typeIdx];
    const subjectKey = monster.subject || 'math';
    const nameKey = monsterType.nameKeys[subjectKey] || monsterType.nameKeys.math;
    const baseName = t(nameKey);

    // topic이 있으면 "topic + 몬스터이름" 형태로 연관 이름 생성
    const topic = monster.topic || '';
    if (topic) {
      monster.name = `${topic} ${baseName}`;
    } else {
      // topic 없으면 문제 내용에서 키워드 추출하여 접두어 사용
      const prefix = this._extractNamePrefix(monster);
      monster.name = prefix ? `${prefix} ${baseName}` : baseName;
    }

    monster.goldMultiplier = 1;
    monster.damageMultiplier = 1;
    monster.icon = monsterType.icon;
  }

  // 문제에서 몬스터 이름 접두어 추출
  _extractNamePrefix(monster) {
    // 키워드가 있으면 첫 번째 키워드 사용
    if (monster.keywords && monster.keywords.length > 0) {
      return monster.keywords[0];
    }
    // 문제 텍스트에서 짧은 핵심어 추출
    const question = monster.question || '';
    if (!question) return '';

    // 괄호 안 내용이나 따옴표 안 내용 추출 시도
    const bracketMatch = question.match(/[「『【\[](.{2,8})[」』】\]]/);
    if (bracketMatch) return bracketMatch[1];

    const quoteMatch = question.match(/['"'"](.{2,8})['"'"]/);
    if (quoteMatch) return quoteMatch[1];

    return '';
  }

  _prepareChoices(monster) {
    let answer = monster.answer;

    if (!answer && monster.choices && monster.choices.length > 0) {
      const idx = monster.correctIndex || 0;
      answer = monster.choices[idx];
    }
    if (!answer) answer = '?';

    // 부등식 문제인데 답이 숫자만인 경우 → 부등식 표현으로 변환
    const answerStr = String(answer).trim();
    if (/^-?\d+\.?\d*$/.test(answerStr) && !/[<>≤≥]/.test(answerStr)) {
      const question = monster.question || '';
      const topic = (monster.topic || '').toLowerCase();
      const isInequality = /부등식|inequality/i.test(topic) ||
        (/[<>≤≥]/.test(question) && /[a-zA-Zx]/.test(question));
      if (isInequality) {
        const ops = question.match(/[≤≥]|[<>]=?/g);
        if (ops && ops.length > 0) {
          const op = ops[ops.length - 1];
          answer = `x ${op} ${answerStr}`;
          monster.choices = [];  // 기존 숫자 선택지 제거
        }
      }
    }
    monster.answer = answer;

    if (!monster.choices || monster.choices.length === 0) {
      const wrongAnswers = this.generateWrongAnswers(answer);
      monster.choices = [answer, ...wrongAnswers];
    } else if (!monster.choices.includes(answer)) {
      monster.choices[0] = answer;
    }

    monster.choices = this.shuffleArray([...monster.choices]);
    monster.correctIndex = monster.choices.indexOf(answer);

    // 최종 검증: 정답이 선택지에 없으면 강제 삽입
    if (monster.correctIndex === -1) {
      monster.choices[0] = answer;
      monster.choices = this.shuffleArray([...monster.choices]);
      monster.correctIndex = monster.choices.indexOf(answer);
    }
  }

  // 오답 자동 생성
  generateWrongAnswers(answer) {
    // 부등식 표현인 경우 부등호 변형으로 오답 생성
    const ineqMatch = answer.match(/^(.*?)\s*([<>≤≥]=?|[≤≥])\s*(.+)$/);
    if (ineqMatch) {
      return this._generateInequalityWrongAnswers(answer, ineqMatch);
    }

    const answerStr = String(answer).trim();

    // 숫자+단위 형식 (예: "10 m/s²", "20 N", "5 kg")
    const unitMatch = answerStr.match(/^(-?\d+\.?\d*)\s*(.+)$/);
    if (unitMatch && !/^[a-zA-Z가-힣]/.test(answerStr)) {
      const numVal = parseFloat(unitMatch[1]);
      const unit = unitMatch[2];
      return this._generateNumericWrongAnswers(numVal).map(n => `${n} ${unit}`);
    }

    // 순수 숫자
    const num = parseFloat(answerStr);
    if (!isNaN(num) && String(num) === answerStr) {
      return this._generateNumericWrongAnswers(num).map(String);
    }

    // 텍스트 답변 → 과학 용어 풀에서 오답 생성
    return this._generateTextWrongAnswers(answerStr);
  }

  // 숫자 기반 오답 생성 (3개 반환)
  _generateNumericWrongAnswers(num) {
    const variations = [
      num + Math.floor(Math.random() * 5) + 1,
      num - Math.floor(Math.random() * 5) - 1,
      num * 2, num + 10, num - 10,
      Math.abs(num) * -1, num + 0.5, num - 0.5
    ];
    const unique = [...new Set(variations.filter(v => v !== num))];
    this.shuffleArray(unique);
    return unique.slice(0, 3);
  }

  // 텍스트 기반 오답 생성 (과학 용어 풀 활용)
  _generateTextWrongAnswers(answer) {
    const scienceTermGroups = [
      ['미토콘드리아', '리보솜', '소포체', '골지체', '엽록체', '핵', '세포막', '리소좀', '중심체', '액포'],
      ['DNA', 'RNA', 'mRNA', '단백질', '아미노산', '뉴클레오타이드', '염색체', '유전자'],
      ['가속도', '속력', '변위', '관성', '힘', '질량', '운동량', '중력'],
      ['양성자', '중성자', '전자', '쿼크', '뉴트리노', '광자', '원자핵'],
      ['산소', '수소', '질소', '탄소', '헬륨', '네온', '철', '구리', '금'],
      ['광합성', '호흡', '발효', '증산작용', '삼투', '확산', '능동수송'],
      ['지진', '화산', '판구조론', '대류', '풍화', '침식', '퇴적', '단층'],
      ['전압', '전류', '저항', '전력', '자기장', '전기장', '유도전류'],
      ['질량 보존 법칙', '에너지 보존 법칙', '일정 성분비 법칙', '배수 비례 법칙', '기체 반응 법칙'],
      ['등속 운동', '등가속도 운동', '포물선 운동', '원운동', '단진동', '자유낙하'],
      ['공유 결합', '이온 결합', '금속 결합', '수소 결합', '반데르발스 힘'],
      ['감수분열', '체세포분열', '수정', '발생', '분화', '생장']
    ];

    const answerLower = answer.toLowerCase();

    // 정답이 속한 그룹 찾기
    for (const group of scienceTermGroups) {
      const idx = group.findIndex(term => term.toLowerCase() === answerLower || term === answer);
      if (idx !== -1) {
        const others = group.filter((_, i) => i !== idx);
        this.shuffleArray(others);
        return others.slice(0, 3);
      }
    }

    // 그룹에 없으면 길이가 비슷한 용어들로 폴백
    const allTerms = scienceTermGroups.flat();
    const answerLen = answer.length;
    const similarLength = allTerms
      .filter(t => t !== answer && Math.abs(t.length - answerLen) <= 2)
      .sort(() => Math.random() - 0.5);

    if (similarLength.length >= 3) {
      return similarLength.slice(0, 3);
    }

    // 최종 폴백: 일반 과학 용어
    const fallbackTerms = ['원자', '분자', '에너지', '파동', '전자', '세포', '유전자', '중력', '마찰력', '압력'];
    const filtered = fallbackTerms.filter(t => t !== answer);
    this.shuffleArray(filtered);
    return filtered.slice(0, 3);
  }

  // 부등식 오답 생성 (부등호 방향/등호 변형)
  _generateInequalityWrongAnswers(answer, match) {
    const [, variable, op, value] = match;
    const opMap = {
      '>': ['<', '≥', '≤'],
      '<': ['>', '≤', '≥'],
      '>=': ['<=', '>', '<'],
      '<=': ['>=', '<', '>'],
      '≥': ['≤', '>', '<'],
      '≤': ['≥', '<', '>'],
    };
    const wrongOps = opMap[op] || ['<', '>', '≤'];
    return wrongOps.map(wop => `${variable} ${wop} ${value}`).slice(0, 3);
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // 몬스터/질문 소스 → 질문 객체 변환
  _toQuestionObj(src, extraProps) {
    return {
      question: src.question, answer: src.answer,
      choices: src.choices || [], correctIndex: src.correctIndex || 0,
      explanation: src.explanation || '',
      ...extraProps
    };
  }

  // AI 생성 문제 추가 + 선택지 검증
  _pushGeneratedProblem(target, p, maxCount, defaultDifficulty) {
    if (target.length >= maxCount || !p.question || !p.answer) return;
    let choices = p.choices || [];
    let correctIndex = p.correctIndex || 0;
    if (choices.length > 0 && !choices.includes(p.answer)) {
      choices[0] = p.answer;
      correctIndex = 0;
    }
    target.push({
      question: p.question, answer: p.answer,
      choices, correctIndex,
      explanation: p.explanation || '',
      ...(defaultDifficulty != null ? { difficulty: p.difficulty || defaultDifficulty } : {})
    });
  }

  // 보스 난이도 보장
  _ensureBossDifficulty(monster) {
    if ((monster.difficulty || 1) >= 2) return;

    if (monster.questions && monster.questions.length > 0) {
      const hardQ = monster.questions.filter(q => (q.difficulty || 1) >= 2);
      if (hardQ.length > 0) {
        const picked = hardQ[Math.floor(Math.random() * hardQ.length)];
        monster.question = picked.question;
        monster.answer = picked.answer;
        monster.choices = picked.choices || [];
        monster.correctIndex = picked.correctIndex || 0;
        monster.explanation = picked.explanation || '';
        monster.difficulty = picked.difficulty;
        return;
      }
    }

    const hardMonsters = this.monsters.filter(mon => (mon.difficulty || 1) >= 2 && mon.id !== monster.id);
    if (hardMonsters.length > 0) {
      const picked = hardMonsters[Math.floor(Math.random() * hardMonsters.length)];
      monster.question = picked.question;
      monster.answer = picked.answer;
      monster.choices = picked.choices || [];
      monster.correctIndex = picked.correctIndex || 0;
      monster.explanation = picked.explanation || '';
      monster.difficulty = picked.difficulty;
      return;
    }

    if (!monster.isGeneratingBoss) {
      monster.isGeneratingBoss = true;
      this._generateBossQuestion(monster);
    }
  }

  async _generateBossQuestion(monster) {
    try {
      let problems = null;

      if (problemGeneratorService.hasApiKey()) {
        const topic = monster.topic || 'linear';
        problems = await problemGeneratorService.generateProblems(topic, 3, 3);
      } else if (geminiService.hasApiKey()) {
        const result = await geminiService.generateSimilarProblems(
          monster.question || t('defaultProblem'), monster.answer || '', t('defaultTopic'), 3
        );
        problems = result?.problems;
      }

      if (problems && problems.length > 0) {
        if (!monster.questions) {
          monster.questions = [this._toQuestionObj(monster, { difficulty: monster.difficulty || 1 })];
        }

        for (const p of problems) {
          this._pushGeneratedProblem(monster.questions, p, 10, 3);
        }

        const first = problems[0];
        monster.question = first.question;
        monster.answer = first.answer;
        monster.choices = first.choices || [];
        monster.correctIndex = first.correctIndex || 0;
        monster.explanation = first.explanation || '';
        monster.difficulty = first.difficulty || 3;

        // 비동기 완료 후 선택지 검증 및 셔플
        this._prepareChoices(monster);

      }
    } catch (err) {
      console.error('보스 문제 생성 오류:', err);
    } finally {
      monster.isGeneratingBoss = false;
    }
  }

  // 다른 몬스터들의 문제를 가져와 questions 배열 확보
  fillQuestionsFromOtherMonsters(currentMonster) {
    if (!currentMonster || !this.monsters || this.monsters.length <= 1) return;
    if (!currentMonster.questions) currentMonster.questions = [];

    const currentId = currentMonster.id;
    const otherMonsters = this.monsters.filter(m => m.id !== currentId);
    this.shuffleArray(otherMonsters);

    for (const m of otherMonsters) {
      if (currentMonster.questions.length >= 5) break;

      if (m.questions && m.questions.length > 0) {
        for (const q of m.questions) {
          if (currentMonster.questions.length >= 5) break;
          if (!currentMonster.questions.some(existing => existing.question === q.question)) {
            currentMonster.questions.push({ ...q });
          }
        }
      } else if (m.question) {
        if (!currentMonster.questions.some(existing => existing.question === m.question)) {
          currentMonster.questions.push(this._toQuestionObj(m));
        }
      }
    }
  }

  // AI로 문제 자동 생성 (백그라운드)
  async autoGenerateQuestions(monster) {
    if (!monster.questions) monster.questions = [];
    try {
      let problems = null;

      if (problemGeneratorService.hasApiKey()) {
        const originalProblem = {
          question: monster.question || '', answer: monster.answer || '',
          topic: monster.topic || t('defaultTopic'), difficulty: monster.difficulty || 2
        };
        problems = await problemGeneratorService.generateSimilar(originalProblem);
      } else if (geminiService.hasApiKey()) {
        const result = await geminiService.generateSimilarProblems(
          monster.question || t('defaultProblem'), monster.answer || '', t('defaultTopic'), 3
        );
        problems = result?.problems;
      }

      if (problems && problems.length > 0) {
        for (const p of problems) {
          this._pushGeneratedProblem(monster.questions, p, 10);
        }

        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          existingMonster.questions = monster.questions;
          await this.db.put('monsters', existingMonster);
        }

      } else {
        // AI 키 없음 — 다른 몬스터 문제로 보충
        this._fillFromAllMonsters(monster, 10);
      }
    } catch (err) {
      console.error('AI 자동 생성 오류:', err);
      // 실패 시에도 다른 몬스터 문제로 보충
      try {
        this._fillFromAllMonsters(monster, 10);
      } catch (fillErr) {
        console.error('문제 보충도 실패:', fillErr);
      }
      // 최소 1개 문제가 있는지 보장
      if (!monster.questions || monster.questions.length === 0) {
        monster.questions = [{
          question: monster.question || '?',
          answer: monster.answer || '?',
          choices: monster.choices || [],
          correctIndex: monster.correctIndex || 0,
          explanation: monster.explanation || ''
        }];
      }
    } finally {
      monster.isGenerating = false;
    }
  }

  // 다른 몬스터 문제로 보충 (AI 불가 시 fallback)
  _fillFromAllMonsters(monster, maxCount) {
    if (!monster.questions) monster.questions = [];
    const currentId = monster.id;
    const others = this.monsters.filter(m => m.id !== currentId);
    this.shuffleArray(others);

    for (const m of others) {
      if (monster.questions.length >= maxCount) break;
      const q = this._toQuestionObj(m);
      if (!monster.questions.some(existing => existing.question === q.question)) {
        monster.questions.push(q);
      }
      if (m.questions) {
        for (const mq of m.questions) {
          if (monster.questions.length >= maxCount) break;
          if (!monster.questions.some(existing => existing.question === mq.question)) {
            monster.questions.push({ ...mq });
          }
        }
      }
    }
  }

  // 유사 문제 생성 (ProblemGeneratorService)
  async generateSimilarWithProblemGenerator(monster, currentMonster) {
    try {
      const originalProblem = {
        question: monster.question || '', answer: monster.answer || '',
        topic: monster.topic || t('defaultTopic'), difficulty: monster.difficulty || 2
      };
      const problems = await problemGeneratorService.generateSimilar(originalProblem);

      if (problems && problems.length > 0) {
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          if (!existingMonster.questions) {
            existingMonster.questions = [this._toQuestionObj(existingMonster)];
          }
          for (const p of problems) {
            this._pushGeneratedProblem(existingMonster.questions, p, 10);
          }
          await this.db.put('monsters', existingMonster);

          if (currentMonster && currentMonster.id === existingMonster.id) {
            currentMonster.questions = [...existingMonster.questions];
          }
        }
      }
    } catch (err) {
      console.error('ProblemGeneratorService 문제 생성 오류:', err);
      if (geminiService.hasApiKey()) {
        this.generateSimilarMonsters(monster, currentMonster);
      }
    }
  }

  // AI로 유사 문제 생성 (Gemini)
  async generateSimilarMonsters(monster, currentMonster) {
    try {
      const subjectKey = SUBJECTS[monster.subject?.toUpperCase()]?.nameKey || 'math';
      const subjectName = t(subjectKey);
      const result = await geminiService.generateSimilarProblems(
        monster.question || t('defaultProblem'), monster.answer || '', subjectName, 2
      );

      if (result && result.problems) {
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          if (!existingMonster.questions) {
            existingMonster.questions = [this._toQuestionObj(existingMonster)];
          }
          for (const problem of result.problems) {
            this._pushGeneratedProblem(existingMonster.questions, problem, 10);
          }
          await this.db.put('monsters', existingMonster);

          if (currentMonster && currentMonster.id === existingMonster.id) {
            currentMonster.questions = [...existingMonster.questions];
          }
        }
      }
    } catch (err) {
      console.error('Gemini 문제 생성 오류:', err);
    }
  }

  // 몬스터 처치 처리 (영구 삭제 대신 cleared 상태로)
  async onMonsterDefeated(monsterId) {
    const monster = this.monsters.find(m => m.id === monsterId);
    if (monster) {
      monster.status = 'cleared';
      await this.db.put('monsters', monster);
      this.monsters = this.monsters.filter(m => m.id !== monster.id);
      this._buildDifficultyIndex();
      // 서버에 상태 업데이트 (serverId가 있으면 사용)
      if (apiService.isLoggedIn() && monster.serverId) {
        apiService.putMonster(monster.serverId, {
          status: 'cleared',
          defeated_at: new Date().toISOString()
        }).catch(e => console.warn('몬스터 동기화 실패:', e.message));
      }
    }
  }
}
