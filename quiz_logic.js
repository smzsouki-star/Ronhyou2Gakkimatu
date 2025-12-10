// quiz_logic.js

const QUESTIONS_TO_ASK = 5; // Grammer/Vocab の問題数（Comprehensionはセット数で管理）
let currentQuizData = [];
let currentQuizType = '';
let allQuizData = {}; 
let activeButtonId = null; 
let comprehensionSets = []; // Comprehension 問題のセット全体を格納
let currentComprehensionSet = null; // 現在表示中の Comprehension セット

// 起動時にJSONファイルを読み込む
document.addEventListener('DOMContentLoaded', () => {
    fetch('quiz_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            allQuizData = data;
            console.log("問題データの読み込みが完了しました。");
        })
        .catch(error => {
            console.error('問題データの読み込み中にエラーが発生しました。', error);
            document.getElementById('quiz-area').innerHTML = '<p style="color: red;">エラー：問題データを読み込めませんでした。`quiz_data.json`が同じフォルダに存在し、正しくフォーマットされているか確認してください。</p>';
        });
});

// 配列をシャッフルする汎用関数
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// クイズ開始
window.startQuiz = function(type, buttonId) {
    if (Object.keys(allQuizData).length === 0) {
        alert('問題データがまだ読み込まれていないか、エラーが発生しています。しばらく待ってから再試行してください。');
        return;
    }
    
    currentQuizType = type;
    const allQuestions = allQuizData[type];
    currentComprehensionSet = null; // Comprehension 以外の時はリセット
    
    if (!allQuestions || allQuestions.length === 0) {
        alert('選択されたクイズの問題データが見つかりません。');
        return;
    }

    updateActiveButton(buttonId);
    
    // Comprehension 問題か否かで処理を分岐
    if (type.includes('Comprehension')) {
        // Comprehension: 1セット全てをランダムに選択し、そのセット内の問題を使用
        comprehensionSets = allQuestions;
        // ランダムに一つのセットを選ぶ
        const selectedSet = shuffleArray([...comprehensionSets])[0]; 
        currentComprehensionSet = selectedSet;

        // 問題文（空欄）のハイライト処理
        let textWithHighlight = selectedSet.text.replace(/\[([A-Z])\]/g, '<span class="blank-spot">[$1]</span>');
        selectedSet.highlightedText = textWithHighlight;

        currentQuizData = selectedSet.questions;

    } else {
        // Vocab/Grammar: 質問をシャッフルしてQUESTIONS_TO_ASKの数だけ選択
        const shuffledQuestions = shuffleArray([...allQuestions]);
        currentQuizData = shuffledQuestions.slice(0, QUESTIONS_TO_ASK);
    }
    
    // 選択肢をシャッフル (Comprehension/Vocab/Grammar共通)
    currentQuizData.forEach(q => {
        if (q.choices) {
            q.choices = shuffleArray(q.choices);
        }
    });

    displayQuiz();
    
    // クイズエリアの開始位置までスクロール
    document.getElementById('quiz-area-anchor').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// アクティブボタンの更新とスタイリング
function updateActiveButton(buttonId) {
    if (activeButtonId) {
        document.getElementById(activeButtonId).classList.remove('active-test-button');
    }

    const newButton = document.getElementById(buttonId);
    if (newButton) {
        newButton.classList.add('active-test-button');
        activeButtonId = buttonId;
    }
}

// クイズの表示
function displayQuiz() {
    const quizArea = document.getElementById('quiz-area');
    const resultArea = document.getElementById('result-area');
    const submitButton = document.getElementById('submit-button');
    
    quizArea.innerHTML = '';
    resultArea.innerHTML = '';
    submitButton.style.display = 'block';

    let quizTitle = '';
    const typeMap = {
        'Vocab': '語彙クイズ',
        'Grammar': '文法クイズ',
        'Comprehension': '総合問題（本文読解）'
    };

    let lessonNum = currentQuizType.match(/L(\d+)/)[1];
    let quizType = currentQuizType.replace(/L\d+/, '');
    quizTitle = `LESSON ${lessonNum} - ${typeMap[quizType] || 'クイズ'}`;

    let html = `<h2>${quizTitle}</h2>`;
    
    // Comprehension問題の場合、本文を表示
    if (currentComprehensionSet) {
        html += `<div class="passage-box">`;
        html += `<p class="passage-title">【本文】</p>`;
        // 空欄がハイライトされた本文を表示
        html += `<p class="passage-text">${currentComprehensionSet.highlightedText}</p>`;
        html += `</div>`;
    }

    html += `<div id="quiz-list">`;

    currentQuizData.forEach((question, index) => {
        html += `<div class="question-card" id="q${index}">`;
        
        // 総合問題のコンテキスト表示 (Vocab/Grammarにはない)
        if (question.context) {
            html += `<p class="context-text">${question.context}</p>`;
        }
        
        html += `<p class="question-text">Q${index + 1}: ${question.q}</p>`;
        
        question.choices.forEach((choice, choiceIndex) => {
            const radioId = `q${index}_c${choiceIndex}`;
            html += `
                <label class="choice-label" for="${radioId}">
                    <input type="radio" id="${radioId}" name="q${index}" value="${choice}" required>
                    ${choice}
                </label>
            `;
        });
        html += '</div>';
    });
    
    html += '</div>';
    quizArea.innerHTML = html;
}

// クイズの採点
window.submitQuiz = function() {
    const resultArea = document.getElementById('result-area');
    const submitButton = document.getElementById('submit-button');
    
    let score = 0;
    let numQuestions = currentQuizData.length;

    // 警告メッセージを出す allAnswered のチェックは不要なため削除。
    // その代わり、未回答を不正解として扱います。

    currentQuizData.forEach((question, index) => {
        const qCard = document.getElementById(`q${index}`);
        // 選択されているラジオボタンを取得 (未回答の場合は null になる)
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        
        // --- ★ここからが、未回答を不正解として扱うための修正ロジック★ ---
        
        // Comprehension問題の場合は answer_key を、それ以外は a を正解とする
        const correctAnswer = question.answer_key || question.a; 
        
        // 選択肢があり、かつ正解と一致する場合のみ true
        const isCorrect = selected && (selected.value === correctAnswer);
        
        const explanation = question.explanation || '解説は提供されていません。'; 
        
        // --- フィードバックテキストの決定 ---
        let feedbackText;
        if (isCorrect) {
            score++;
            feedbackText = '✅ 正解です！';
        } else if (!selected) {
            // 未回答の場合のフィードバック
            feedbackText = `❌ 不正解です (未回答)。(正解: ${correctAnswer})`;
        } else {
            // 選択したが間違っていた場合のフィードバック
            feedbackText = `❌ 不正解... (正解: ${correctAnswer})`;
        }
        
        // フィードバックと解説を構成
        let feedbackHTML = `<div class="feedback ${isCorrect ? 'correct' : 'incorrect'}">${feedbackText}</div>`;
        
        // ★未回答/不正解の場合でも、解説は必ず表示する★
        feedbackHTML += `<div class="explanation-text">【解説】 ${explanation}</div>`; 

        qCard.innerHTML += feedbackHTML;
        
        // ラジオボタンの無効化
        document.querySelectorAll(`input[name="q${index}"]`).forEach(radio => {
            radio.disabled = true;
        });

        // --- 不正解・未回答の場合、正解の選択肢をハイライト (視覚的フィードバック) ---
        if (!isCorrect) {
             const correctInput = qCard.querySelector(`input[value="${correctAnswer}"]`);
             if (correctInput) {
                 // 正解の選択肢（ラベル）をハイライト
                 correctInput.closest('.choice-label').style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
                 correctInput.closest('.choice-label').style.border = '2px solid var(--gold-accent)';
             }
        }
    });
    
    // 全ての問題の採点・フィードバックが完了

    // 最終結果の表示
    submitButton.style.display = 'none';
    
    // スコア表示の分母を動的に変更
    resultArea.innerHTML = `
        <p>あなたの得点:</p>
        <div id="score">${score} / ${numQuestions}</div>
        <button id="retry-button" onclick="startQuiz(currentQuizType, activeButtonId)">同じテストでやり直す</button>
    `;
    
    // 採点結果の頭までスクロール
    document.getElementById('top').scrollIntoView({ behavior: 'smooth' });
}