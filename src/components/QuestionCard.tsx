import { useState, useEffect } from 'react';
import type { Question, QuestionState } from '../types/quiz';

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  state: QuestionState;
  userAnswer: number | number[] | string | null;
  mode: 'practice' | 'exam';
  submitted: boolean;
  isFlagged: boolean;
  onAnswer: (answer: number | number[] | string | null) => void;
  onSubmit: () => void;
  onToggleFlag: () => void;
}

function checkIsCorrect(
  question: Question,
  userAnswer: number | number[] | string | null
): boolean {
  if (userAnswer === null) return false;

  if (question.type === 2 || question.answer) {
    const userAns = String(userAnswer).trim().toLowerCase();
    const correctAns = question.answer?.trim().toLowerCase() ?? '';
    return question.case_sensitive
      ? String(userAnswer).trim() === question.answer?.trim()
      : userAns === correctAns;
  }

  const correctAnswers = question.correct_answer;
  if (Array.isArray(correctAnswers)) {
    if (!Array.isArray(userAnswer)) return false;
    if (userAnswer.length !== correctAnswers.length) return false;
    const sortedUser = [...userAnswer].sort((a, b) => a - b);
    const sortedCorrect = [...correctAnswers].sort((a, b) => a - b);
    return sortedUser.every((a, i) => a === sortedCorrect[i]);
  }

  return userAnswer === correctAnswers;
}

function getCorrectAnswerText(question: Question): string {
  if (question.type === 2 || question.answer) {
    return question.answer ?? '';
  }

  const correctAnswers = question.correct_answer;
  if (Array.isArray(correctAnswers)) {
    return correctAnswers
      .map((i) => question.answers?.[i - 1])
      .filter(Boolean)
      .join(', ');
  }

  return question.answers?.[correctAnswers - 1] ?? '';
}

export function QuestionCard({
  question,
  questionIndex,
  userAnswer,
  mode,
  submitted,
  isFlagged,
  onAnswer,
  onSubmit,
  onToggleFlag,
}: QuestionCardProps) {
  const [textInput, setTextInput] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<number | number[] | string | null>(null);
  const useTextbox = question.type === 2 || question.answer;

  useEffect(() => {
    if (userAnswer !== null) {
      if (!useTextbox) {
        setSelectedAnswer(userAnswer);
      } else {
        setTextInput(typeof userAnswer === 'string' ? userAnswer : '');
      }
    }
  }, [userAnswer, useTextbox]);

  useEffect(() => {
    if (userAnswer === null) {
      setSelectedAnswer(null);
      setTextInput('');
    }
  }, [questionIndex, userAnswer]);

  const hasUserAnswer = useTextbox
    ? textInput.trim().length > 0
    : selectedAnswer !== null;

  const isCorrect = submitted && checkIsCorrect(question, userAnswer);
  const correctAnswerText = getCorrectAnswerText(question);

  const handleOptionClick = (optionIndex: number) => {
    if (submitted) return;

    const isMultipleCorrect = Array.isArray(question.correct_answer);

    if (isMultipleCorrect) {
      const current = Array.isArray(selectedAnswer) ? selectedAnswer : null;
      const newAnswer = current ? [...current] : [];
      const idx = newAnswer.indexOf(optionIndex);
      if (idx > -1) {
        newAnswer.splice(idx, 1);
      } else {
        newAnswer.push(optionIndex);
      }
      const finalAnswer = newAnswer.length === 0 ? null : newAnswer;
      setSelectedAnswer(finalAnswer);
      onAnswer(finalAnswer);
    } else {
      const newAnswer = selectedAnswer === optionIndex ? null : optionIndex;
      setSelectedAnswer(newAnswer);
      onAnswer(newAnswer);
    }
  };

  const renderAnswerOptions = () => {
    if (useTextbox) {
      const isLongForm = question.textbox_type === 2;
      
      if (isLongForm) {
        return (
          <div>
            <textarea
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                onAnswer(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              disabled={submitted}
              placeholder="Type your answer..."
              className="neu-input"
              style={{ 
                width: '100%', 
                minHeight: '100px',
                resize: 'vertical',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            />
            {mode === 'practice' && textInput.trim().length > 0 && !submitted && (
              <button
                onClick={onSubmit}
                className="neu-btn neu-btn-primary"
                style={{ marginTop: '16px', width: '100%' }}
              >
                Submit Answer (Ctrl+Enter)
              </button>
            )}
          </div>
        );
      }
      
      return (
        <div>
          <input
            type="text"
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              onAnswer(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            disabled={submitted}
            placeholder="Type your answer..."
            className="neu-input"
            style={{ width: '100%' }}
          />
        </div>
      );
    }

    if (!question.answers) return null;

    const correctAnswers = Array.isArray(question.correct_answer)
      ? question.correct_answer
      : [question.correct_answer];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {question.answers.map((answer, index) => {
          const optionIndex = index + 1;
          const isSelected = Array.isArray(selectedAnswer)
            ? selectedAnswer.includes(optionIndex)
            : selectedAnswer === optionIndex;
          const isCorrectOption = correctAnswers.includes(optionIndex);

          let bgColor = 'white';
          let borderStyle = '3px solid #1a1a1a';

          if (submitted) {
            if (isCorrectOption && isSelected) {
              bgColor = '#00d4ff';
            } else if (isSelected && !isCorrectOption) {
              bgColor = '#ff6b9d';
            } else if (isCorrectOption && !isSelected) {
              bgColor = '#ff9f43';
            }
          } else if (isSelected) {
            bgColor = '#00d4ff';
          }

          return (
            <button
              key={index}
              onClick={() => handleOptionClick(optionIndex)}
              disabled={submitted}
              style={{
                padding: '16px',
                border: borderStyle,
                background: bgColor,
                boxShadow: '3px 3px 0px #1a1a1a',
                cursor: submitted ? 'default' : 'pointer',
                textAlign: 'left',
                fontWeight: 600,
                fontSize: '16px',
              }}
            >
              {answer}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="neu-box" style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: '14px',
            padding: '4px 12px',
            border: '3px solid #1a1a1a',
            background: '#c084fc',
          }}
        >
          Question {questionIndex + 1}
        </span>
        <button
          onClick={onToggleFlag}
          style={{
            fontWeight: 700,
            fontSize: '14px',
            padding: '4px 12px',
            border: '3px solid #1a1a1a',
            background: isFlagged ? '#ff6b9d' : 'white',
            cursor: 'pointer',
          }}
        >
          {isFlagged ? '🚩 Flagged' : '🚩 Flag'}
        </button>
        <span
          style={{
            fontWeight: 700,
            fontSize: '14px',
            padding: '4px 12px',
            border: '3px solid #1a1a1a',
            background: '#ffd93d',
          }}
        >
          {question.point ?? 1} point{question.point !== 1 ? 's' : ''}
        </span>
      </div>

      <h2 style={{ fontSize: '24px', marginBottom: '24px', fontWeight: 700 }}>
        {question.question}
      </h2>

      {renderAnswerOptions()}

      {mode === 'practice' && hasUserAnswer && !submitted && !useTextbox && (
        <button
          onClick={onSubmit}
          className="neu-btn neu-btn-primary"
          style={{ marginTop: '16px', width: '100%' }}
        >
          Submit Answer
        </button>
      )}

      {submitted && (
        <div
          style={{
            marginTop: '16px',
            padding: '16px',
            border: '3px solid #1a1a1a',
            background: isCorrect ? '#00d4ff' : '#ff6b9d',
            boxShadow: '3px 3px 0px #1a1a1a',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </div>
          <div style={{ fontWeight: 600 }}>
            The answer is: {correctAnswerText}
          </div>
        </div>
      )}

      {submitted && question.explanation && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            border: '3px solid #1a1a1a',
            background: '#ffd93d',
          }}
        >
          {question.explanation}
        </div>
      )}
    </div>
  );
}