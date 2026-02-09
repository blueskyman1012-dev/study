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
  }

  async loadMonsters() {
    this.monsters = await this.db.getByIndex('monsters', 'status', 'alive');
  }

  async loadMonstersBySubject(subject) {
    const all = await this.db.getByIndex('monsters', 'status', 'alive');
    if (subject === 'math') {
      this.monsters = all.filter(m => !m.subject || m.subject === 'math');
    } else {
      this.monsters = all.filter(m => m.subject === subject);
    }
  }

  // 보스 타입 확인
  getBossType(stage) {
    if (BOSS_CONFIG.FINAL_BOSS.stages.includes(stage)) return 'FINAL_BOSS';
    if (BOSS_CONFIG.MID_BOSS.stages.includes(stage)) return 'MID_BOSS';
    if (BOSS_CONFIG.NORMAL_BOSS.stages.includes(stage)) return 'NORMAL_BOSS';
    return null;
  }

  // 적응형 난이도로 몬스터 선택
  selectMonsterByDifficulty(accuracyRate, totalAnswers) {
    if (totalAnswers < 5) {
      return this.monsters[Math.floor(Math.random() * this.monsters.length)];
    }

    const easy = this.monsters.filter(m => (m.difficulty || 2) <= 1);
    const medium = this.monsters.filter(m => (m.difficulty || 2) === 2);
    const hard = this.monsters.filter(m => (m.difficulty || 2) >= 3);

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
    monster.answer = answer;

    if (!monster.choices || monster.choices.length === 0) {
      const wrongAnswers = this.generateWrongAnswers(answer);
      monster.choices = [answer, ...wrongAnswers];
    } else if (!monster.choices.includes(answer)) {
      monster.choices[0] = answer;
    }

    monster.choices = this.shuffleArray([...monster.choices]);
    monster.correctIndex = monster.choices.indexOf(answer);
  }

  // 오답 자동 생성
  generateWrongAnswers(answer) {
    const wrongAnswers = [];
    const num = parseFloat(answer);
    if (!isNaN(num)) {
      const variations = [
        num + Math.floor(Math.random() * 5) + 1,
        num - Math.floor(Math.random() * 5) - 1,
        num * 2, num + 10, num - 10,
        Math.abs(num) * -1, num + 0.5, num - 0.5
      ];
      const unique = [...new Set(variations.filter(v => v !== num))];
      this.shuffleArray(unique);
      for (let i = 0; i < 3 && i < unique.length; i++) {
        wrongAnswers.push(String(unique[i]));
      }
    }
    while (wrongAnswers.length < 3) {
      const randomNum = Math.floor(Math.random() * 100) + 1;
      const randomStr = String(randomNum);
      if (!wrongAnswers.includes(randomStr) && randomStr !== answer) {
        wrongAnswers.push(randomStr);
      }
    }
    return wrongAnswers.slice(0, 3);
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
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
      console.log('🤖 보스용 난이도 중 이상 문제 생성 중...');
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
          monster.questions = [{
            question: monster.question, answer: monster.answer,
            choices: monster.choices || [], correctIndex: monster.correctIndex || 0,
            explanation: monster.explanation || '', difficulty: monster.difficulty || 1
          }];
        }

        for (const p of problems) {
          if (monster.questions.length < 10) {
            monster.questions.push({
              question: p.question, answer: p.answer,
              choices: p.choices || [], correctIndex: p.correctIndex || 0,
              explanation: p.explanation || '', difficulty: p.difficulty || 3
            });
          }
        }

        const first = problems[0];
        monster.question = first.question;
        monster.answer = first.answer;
        monster.choices = first.choices || [];
        monster.correctIndex = first.correctIndex || 0;
        monster.explanation = first.explanation || '';
        monster.difficulty = first.difficulty || 3;

        console.log(`✅ 보스 문제 ${problems.length}개 생성 완료!`);
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
          currentMonster.questions.push({
            question: m.question, answer: m.answer,
            choices: m.choices || [], correctIndex: m.correctIndex || 0,
            explanation: m.explanation || ''
          });
        }
      }
    }
  }

  // AI로 문제 자동 생성 (백그라운드)
  async autoGenerateQuestions(monster) {
    try {
      console.log('🤖 문제 부족! AI 자동 생성 중...');
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
          if (monster.questions.length < 10) {
            monster.questions.push({
              question: p.question, answer: p.answer,
              choices: p.choices || [], correctIndex: p.correctIndex || 0,
              explanation: p.explanation || ''
            });
          }
        }

        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          existingMonster.questions = monster.questions;
          await this.db.put('monsters', existingMonster);
        }

        console.log(`✅ AI 자동 생성 완료! (총 ${monster.questions.length}개 문제)`);
      } else {
        // AI 키 없음 — 다른 몬스터 문제로 보충
        this._fillFromAllMonsters(monster, 10);
        console.log(`📦 다른 몬스터 문제로 보충 (총 ${monster.questions.length}개)`);
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
      const q = {
        question: m.question, answer: m.answer,
        choices: m.choices || [], correctIndex: m.correctIndex || 0,
        explanation: m.explanation || ''
      };
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
      console.log('🤖 ProblemGeneratorService 유사 문제 생성 중...');
      const originalProblem = {
        question: monster.question || '', answer: monster.answer || '',
        topic: monster.topic || t('defaultTopic'), difficulty: monster.difficulty || 2
      };
      const problems = await problemGeneratorService.generateSimilar(originalProblem);

      if (problems && problems.length > 0) {
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          if (!existingMonster.questions) {
            existingMonster.questions = [{
              question: existingMonster.question, answer: existingMonster.answer,
              choices: existingMonster.choices || [], correctIndex: existingMonster.correctIndex || 0,
              explanation: existingMonster.explanation || ''
            }];
          }
          for (const p of problems) {
            if (existingMonster.questions.length < 10) {
              existingMonster.questions.push({
                question: p.question, answer: p.answer,
                choices: p.choices || [], correctIndex: p.correctIndex || 0,
                explanation: p.explanation || ''
              });
            }
          }
          await this.db.put('monsters', existingMonster);

          if (currentMonster && currentMonster.id === existingMonster.id) {
            currentMonster.questions = [...existingMonster.questions];
          }
          console.log(`✅ ${problems.length}개 유사 문제 추가! (총 ${existingMonster.questions.length}개)`);
        }
      }
    } catch (err) {
      console.error('ProblemGeneratorService 문제 생성 오류:', err);
      if (geminiService.hasApiKey()) {
        console.log('🔄 Gemini로 폴백...');
        this.generateSimilarMonsters(monster, currentMonster);
      }
    }
  }

  // AI로 유사 문제 생성 (Gemini)
  async generateSimilarMonsters(monster, currentMonster) {
    try {
      console.log('🤖 Gemini 유사 문제 생성 중...');
      const subjectKey = SUBJECTS[monster.subject?.toUpperCase()]?.nameKey || 'math';
      const subjectName = t(subjectKey);
      const result = await geminiService.generateSimilarProblems(
        monster.question || t('defaultProblem'), monster.answer || '', subjectName, 2
      );

      if (result && result.problems) {
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          if (!existingMonster.questions) {
            existingMonster.questions = [{
              question: existingMonster.question, answer: existingMonster.answer,
              choices: existingMonster.choices || [], correctIndex: existingMonster.correctIndex || 0,
              explanation: existingMonster.explanation || ''
            }];
          }
          for (const problem of result.problems) {
            if (existingMonster.questions.length < 10) {
              existingMonster.questions.push({
                question: problem.question, answer: problem.answer,
                choices: problem.choices || [], correctIndex: problem.correctIndex || 0,
                explanation: problem.explanation || ''
              });
            }
          }
          await this.db.put('monsters', existingMonster);

          if (currentMonster && currentMonster.id === existingMonster.id) {
            currentMonster.questions = [...existingMonster.questions];
          }
          console.log(`✅ ${result.problems.length}개 유사 문제 추가! (Gemini, 총 ${existingMonster.questions.length}개)`);
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
      // 서버에 상태 업데이트 (serverId가 있으면 사용)
      if (apiService.isLoggedIn() && monster.serverId) {
        apiService.putMonster(monster.serverId, {
          status: 'defeated',
          defeated_at: new Date().toISOString()
        }).catch(() => {});
      }
    }
  }
}
