// 오답 등록 관리 (사진 촬영 → 분석 → 몬스터 등록)
import { SCREENS, SUBJECTS } from '../utils/constants.js';
import { geminiService } from '../services/GeminiService.js';
import { imageAnalysisService } from '../services/ImageAnalysisService.js';
import { apiService } from '../services/ApiService.js';
import { t } from '../i18n/i18n.js';

export class RegisterManager {
  constructor(game) {
    this.game = game;
    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;
    this._previewImageLoading = false;
  }

  startRegister() {
    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;
    this._previewImageLoading = false;
    this.game.changeScreen(SCREENS.MAIN);
  }

  async completeRegister(subjectId) {
    const game = this.game;
    if (game.isGenerating) return;
    if (!this.pendingImage) {
      await game.showModal(t('noPhoto'));
      game.changeScreen(SCREENS.MAIN);
      return;
    }

    const imageData = this.pendingImage;
    const subjectKey = SUBJECTS[subjectId.toUpperCase()]?.nameKey || 'math';
    const subjectName = t(subjectKey);

    let question = '', answer = '', answers = [], choices = [], correctIndex = 0;
    let explanation = '', aiAnalysis = null, topic = '', difficulty = 2;
    let keywords = [], questionType = t('multipleChoice'), formula = '';

    try {
    if (imageAnalysisService.hasApiKey()) {
      try {
        game._generationCancelled = false;
        game.isGenerating = true;
        game.generatingMessage = t('analyzing', 'SmilePrint');
        game.generatingSubMessage = t('analyzingDesc');
        game._needsRender = true;
        const result = await Promise.race([imageAnalysisService.analyze(imageData, subjectId), new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 60000))]);
        if (game._generationCancelled) { return; }
        if (result && result.success && result.question) {
          question = result.question; answer = result.answer || '';
          choices = result.choices || []; correctIndex = result.correctIndex || 0;
          explanation = result.explanation || ''; topic = result.topic || '';
          difficulty = this._parseDifficulty(result.difficulty);
          keywords = result.keywords || []; aiAnalysis = result.aiAnalysis;
          answers = result.answers || [answer];
          questionType = result.questionType || t('multipleChoice');
          formula = result.formula || '';

          game.isGenerating = false;
          game._needsRender = true;
          const displayQ = question.length > 100 ? question.substring(0, 100) + '...' : question;
          const answerDisplay = answers.length > 1 ? answers.join(', ') : answer;
          const confirmed = await game.showConfirm(t('aiAnalyzed', displayQ, answerDisplay, topic, explanation));
          if (!confirmed) {
            question = await game.showPrompt(t('editQuestion'), question) || question;
            answer = await game.showPrompt(t('editAnswer'), answer) || answer;
          }
        } else {
          throw new Error(result?.message || t('noAnalysisResult'));
        }
      } catch (err) {
        console.error('SmilePrint 분석 실패:', err);
        if (geminiService.hasApiKey()) {
          try {
            game.generatingMessage = t('analyzing', 'Gemini');
            const result = await Promise.race([geminiService.analyzeImage(imageData, subjectName), new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 60000))]);
            game.isGenerating = false;
            game._needsRender = true;
            if (result && result.question) {
              question = result.question; answer = result.answer || '';
              choices = result.choices || []; correctIndex = result.correctIndex || 0;
              explanation = result.explanation || '';
              const displayQ = question.length > 100 ? question.substring(0, 100) + '...' : question;
              const confirmed = await game.showConfirm(t('aiAnalyzedSimple', displayQ, answer));
              if (!confirmed) {
                question = await game.showPrompt(t('editQuestion'), question) || question;
                answer = await game.showPrompt(t('editAnswer'), answer) || answer;
              }
            } else { throw new Error(t('noAnalysisResult')); }
          } catch (geminiErr) {
            game.isGenerating = false;
            game._needsRender = true;
            await game.showModal(t('aiFailed', this._safeErrorMsg(err)));
            question = await game.showPrompt(t('inputQuestion')) || '';
            if (!question) return;
            answer = await game.showPrompt(t('inputAnswer')) || '';
          }
        } else {
          game.isGenerating = false;
          game._needsRender = true;
          await game.showModal(t('aiFailed', this._safeErrorMsg(err)));
          question = await game.showPrompt(t('inputQuestion')) || '';
          if (!question) return;
          answer = await game.showPrompt(t('inputAnswer')) || '';
        }
      }
    } else if (geminiService.hasApiKey()) {
      try {
        game._generationCancelled = false;
        game.isGenerating = true;
        game.generatingMessage = t('analyzing', 'Gemini');
        game.generatingSubMessage = t('analyzingDesc');
        game._needsRender = true;
        const result = await Promise.race([geminiService.analyzeImage(imageData, subjectName), new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 60000))]);
        if (game._generationCancelled) { return; }
        game.isGenerating = false;
        game._needsRender = true;
        if (result && result.question) {
          question = result.question; answer = result.answer || '';
          choices = result.choices || []; correctIndex = result.correctIndex || 0;
          explanation = result.explanation || '';
          const displayQ = question.length > 100 ? question.substring(0, 100) + '...' : question;
          const confirmed = await game.showConfirm(t('aiAnalyzedSimple', displayQ, answer));
          if (!confirmed) {
            question = await game.showPrompt(t('editQuestion'), question) || question;
            answer = await game.showPrompt(t('editAnswer'), answer) || answer;
          }
        } else { throw new Error(t('noAnalysisResult')); }
      } catch (err) {
        game.isGenerating = false;
        game._needsRender = true;
        await game.showModal(t('aiFailed', this._safeErrorMsg(err)));
        question = await game.showPrompt(t('inputQuestion')) || '';
        if (!question) return;
        answer = await game.showPrompt(t('inputAnswer')) || '';
      }
    } else {
      question = await game.showPrompt(t('inputQuestion')) || '';
      if (!question) return;
      answer = await game.showPrompt(t('inputAnswer')) || '';
    }
    } finally {
      game.isGenerating = false;
      game._needsRender = true;
      game._removeCancelOverlay();
    }

    if (!answer && choices && choices.length > 0) {
      answer = choices[correctIndex] || choices[0];
    }
    if (!answer) {
      answer = await game.showPrompt(t('inputAnswerNum')) || '';
      if (!answer) { await game.showModal(t('noAnswer')); return; }
    }

    if (!choices || choices.length < 4) {
      const wrongAnswers = game.monsterManager.generateWrongAnswers(answer);
      choices = [answer, ...wrongAnswers];
      correctIndex = 0;
    }

    // 입력값 검증 (XSS/인젝션 방지)
    question = this._sanitize(question, 1000);
    answer = this._sanitize(answer, 200);
    explanation = this._sanitize(explanation, 1000);
    topic = this._sanitize(topic, 100);
    formula = this._sanitize(formula, 500);
    answers = answers.map(a => this._sanitize(a, 200));
    choices = choices.map(c => this._sanitize(c, 200));
    keywords = keywords.map(k => this._sanitize(k, 50));

    const monster = {
      subject: subjectId, imageData, question, answer,
      answers: answers.length > 0 ? answers : [answer],
      choices, correctIndex, explanation, topic, difficulty, keywords,
      questionType, formula,
      hp: 80 + difficulty * 20, maxHp: 80 + difficulty * 20,
      createdAt: Date.now(), status: 'alive', aiAnalysis,
      stats: { attempts: 0, correct: 0, wrong: 0, lastAttempt: null, averageTime: 0 },
      review: { nextReviewDate: null, reviewCount: 0, masteryLevel: 0 }
    };

    await game.db.add('monsters', monster);
    if (apiService.isLoggedIn()) {
      apiService.postMonster(monster).catch(err => {
        console.warn('몬스터 서버 업로드 실패:', err.message || err);
      });
    }
    await game.monsterManager.loadMonsters();
    game.achievementManager.onMonsterRegistered(subjectId);

    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;
    this._previewImageLoading = false;

    await game.showModal(t('monsterRegistered'));
    game.changeScreen(SCREENS.MAIN);
  }

  // 에러 메시지에서 시스템 정보 제거
  _safeErrorMsg(err) {
    const msg = err?.message || '';
    // URL, 파일 경로, 스택 트레이스 제거
    return msg.replace(/https?:\/\/[^\s]+/g, '[URL]')
      .replace(/[A-Z]:\\[^\s]+/gi, '[path]')
      .replace(/\/[^\s]*\/[^\s]+/g, '[path]')
      .substring(0, 100);
  }

  // 입력값 검증: HTML 태그 제거 + 길이 제한
  _sanitize(text, maxLen = 500) {
    if (typeof text !== 'string') return '';
    return text.replace(/<[^>]*>/g, '').trim().substring(0, maxLen);
  }

  _parseDifficulty(diffStr) {
    if (diffStr === '상' || diffStr === 'high' || diffStr === '高') return 3;
    if (diffStr === '하' || diffStr === 'low' || diffStr === '低') return 1;
    return 2;
  }
}
