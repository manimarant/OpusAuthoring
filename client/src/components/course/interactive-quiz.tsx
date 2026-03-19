import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, RotateCcw } from "lucide-react";

interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  type: string;
  explanation?: string;
}

interface QuizContent {
  title?: string;
  description?: string;
  questions: QuizQuestion[];
}

interface InteractiveQuizProps {
  content: QuizContent;
  blockId: string;
  isPreviewMode?: boolean;
}

export default function InteractiveQuiz({ content, blockId, isPreviewMode = false }: InteractiveQuizProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const questions = Array.isArray(content.questions) ? content.questions : [];

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    if (isSubmitted) return;
    
    setSelectedAnswers(prev => ({
      ...prev,
      [`question-${questionIndex}`]: answer
    }));
  };

  const handleSubmit = () => {
    if (questions.length === 0) return;
    
    setIsSubmitted(true);
    setShowResults(true);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setShowResults(false);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((question, index) => {
      const selectedAnswer = selectedAnswers[`question-${index}`];
      if (selectedAnswer === question.correctAnswer) {
        correct++;
      }
    });
    return { correct, total: questions.length };
  };

  const getAnswerStatus = (questionIndex: number, optionIndex: number): 'correct' | 'incorrect' | 'unselected' | null => {
    if (!showResults) return null;
    
    const question = questions[questionIndex];
    const selectedAnswer = selectedAnswers[`question-${questionIndex}`];
    const optionLetter = String.fromCharCode(65 + optionIndex);
    const isSelected = selectedAnswer === optionLetter;
    const isCorrect = question.correctAnswer === optionLetter;
    
    if (isSelected && isCorrect) return 'correct';
    if (isSelected && !isCorrect) return 'incorrect';
    if (!isSelected && isCorrect) return 'unselected';
    return null;
  };

  const canSubmit = questions.every((_, index) => selectedAnswers[`question-${index}`]);
  const { correct, total } = calculateScore();

  if (questions.length === 0) {
    return (
      <div className="rise-content" data-testid={`interactive-quiz-${blockId}`}>
        <div className="py-4 text-center text-slate-500">
          <p>No quiz questions available</p>
          <p className="opacity-75">Questions will appear here when added</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rise-content" data-testid={`interactive-quiz-${blockId}`}>
      {/* Quiz Header */}
      <div className="mb-6">
        {content.title && (
          <h3 className="mb-2">
            {content.title}
          </h3>
        )}
        {content.description && (
          <p className="mb-4">
            {content.description}
          </p>
        )}
        
        {/* Progress/Status */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2">
          <div>
            {isSubmitted 
              ? `Score: ${correct}/${total} (${Math.round((correct/total) * 100)}%)`
              : `${Object.keys(selectedAnswers).length}/${questions.length} answered`
            }
          </div>
          {isSubmitted && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="rounded-full"
                data-testid={`quiz-reset-${blockId}`}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, questionIndex) => (
          <div key={question.id || questionIndex} className="rounded-lg border border-slate-200 bg-slate-50/50 p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  Question {questionIndex + 1}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
                  {question.type === 'multiple-choice' ? 'Multiple Choice' : question.type}
                </span>
              </div>
              <p className="font-medium">
                {question.question}
              </p>
            </div>

            {/* Multiple Choice Options */}
            {question.type === "multiple-choice" && question.options && (
              <div className="space-y-2">
                {question.options.map((option, optionIndex) => {
                  const optionLetter = String.fromCharCode(65 + optionIndex);
                  const isSelected = selectedAnswers[`question-${questionIndex}`] === optionLetter;
                  const answerStatus = getAnswerStatus(questionIndex, optionIndex);
                  
                  let buttonClass = "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ";
                  
                  if (isSubmitted) {
                    switch (answerStatus) {
                      case 'correct':
                        buttonClass += "border-emerald-300 bg-emerald-50 text-emerald-800";
                        break;
                      case 'incorrect':
                        buttonClass += "border-red-300 bg-red-50 text-red-800";
                        break;
                      case 'unselected':
                        buttonClass += "border-emerald-300 bg-emerald-50/30 text-emerald-700";
                        break;
                      default:
                        buttonClass += "border-slate-200 bg-white text-slate-700";
                    }
                  } else if (isSelected) {
                    buttonClass += "border-blue-300 bg-blue-50 text-blue-800";
                  } else {
                    buttonClass += "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
                  }

                  return (
                    <button
                      key={optionIndex}
                      onClick={() => handleAnswerSelect(questionIndex, optionLetter)}
                      disabled={isSubmitted}
                      className={buttonClass}
                      data-testid={`quiz-option-${questionIndex}-${optionIndex}-${blockId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          isSelected 
                            ? isSubmitted
                              ? answerStatus === 'correct' 
                                ? "border-emerald-500 bg-emerald-500"
                                : answerStatus === 'incorrect'
                                ? "border-red-500 bg-red-500"
                                : "border-blue-500 bg-blue-500"
                              : "border-blue-500 bg-blue-500"
                            : "border-slate-300"
                        }`}>
                          {isSelected && (
                            <div className="h-2 w-2 rounded-full bg-white"></div>
                          )}
                        </div>
                        <span className="font-medium text-slate-500">
                          {optionLetter}.
                        </span>
                        <span className="flex-1">
                          {option}
                        </span>
                        {isSubmitted && answerStatus && (
                          <div className="ml-auto">
                            {answerStatus === 'correct' ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                            ) : answerStatus === 'incorrect' ? (
                              <XCircle className="h-5 w-5 text-red-600" />
                            ) : answerStatus === 'unselected' ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600 opacity-60" />
                            ) : null}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* True/False Options */}
            {question.type === "true-false" && (
              <div className="space-y-2">
                {["true", "false"].map((option) => {
                  const isSelected = selectedAnswers[`question-${questionIndex}`] === option;
                  const isCorrect = question.correctAnswer?.toLowerCase() === option;
                  
                  let buttonClass = "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ";
                  
                  if (isSubmitted) {
                    if (isSelected && isCorrect) {
                      buttonClass += "border-emerald-300 bg-emerald-50 text-emerald-800";
                    } else if (isSelected && !isCorrect) {
                      buttonClass += "border-red-300 bg-red-50 text-red-800";
                    } else if (!isSelected && isCorrect) {
                      buttonClass += "border-emerald-300 bg-emerald-50/30 text-emerald-700";
                    } else {
                      buttonClass += "border-slate-200 bg-white text-slate-700";
                    }
                  } else if (isSelected) {
                    buttonClass += "border-blue-300 bg-blue-50 text-blue-800";
                  } else {
                    buttonClass += "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50";
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswerSelect(questionIndex, option)}
                      disabled={isSubmitted}
                      className={buttonClass}
                      data-testid={`quiz-tf-${questionIndex}-${option}-${blockId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          isSelected 
                            ? isSubmitted
                              ? (isSelected && isCorrect) 
                                ? "border-emerald-500 bg-emerald-500"
                                : (isSelected && !isCorrect)
                                ? "border-red-500 bg-red-500"
                                : "border-blue-500 bg-blue-500"
                              : "border-blue-500 bg-blue-500"
                            : "border-slate-300"
                        }`}>
                          {isSelected && (
                            <div className="h-2 w-2 rounded-full bg-white"></div>
                          )}
                        </div>
                        <span className="flex-1 capitalize">
                          {option}
                        </span>
                        {isSubmitted && (
                          <div className="ml-auto">
                            {isSelected && isCorrect ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600" />
                            ) : isSelected && !isCorrect ? (
                              <XCircle className="h-5 w-5 text-red-600" />
                            ) : !isSelected && isCorrect ? (
                              <CheckCircle className="h-5 w-5 text-emerald-600 opacity-60" />
                            ) : null}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Explanation */}
            {showResults && question.explanation && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="text-blue-800">
                  <span className="font-medium">Explanation:</span> {question.explanation}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Submit Button */}
      {!isSubmitted && (
        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-blue-600 px-8 text-white hover:bg-blue-700"
            data-testid={`quiz-submit-${blockId}`}
          >
            Submit Quiz
          </Button>
        </div>
      )}

      {/* Results Summary */}
      {showResults && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-center">
            <div className="mb-2">
              <span className="text-2xl font-bold text-slate-900">
                {Math.round((correct/total) * 100)}%
              </span>
            </div>
            <div>
              You got {correct} out of {total} questions correct
            </div>
            {correct === total && (
              <div className="mt-2 font-medium text-emerald-600">
                🎉 Perfect score! Well done!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}