import type { Form3WritingConfig } from '../dynamic-schema'
import { normalizeToken } from '../../lib/aiGradingService'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import './sentence-writing.css'

interface WritingResultItem {
  correct: boolean
  hint?: string
  feedback_vi?: string
  feedback_en?: string
  missingWords?: string[]
  score?: number
  word_count?: number
  criteria_met?: Array<{ criterion: string; passed: boolean; comment?: string }>
  grammar_issues?: Array<{ issue: string; suggestion: string }>
  suggestions?: string[]
}

interface SentenceWritingRendererProps {
  config: Form3WritingConfig
  answers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
  results?: Record<string, WritingResultItem> | null
  disabled?: boolean
  isChecking?: boolean
  onSubmit?: () => void
  onRestart?: () => void
  isCompleted?: boolean
  onNavigateHome?: () => void
  phase?: 'entry' | 'guided' | 'complete'
  activeRetryId?: string | null
}

export function SentenceWritingRenderer({
  config,
  answers,
  onAnswerChange,
  results,
  disabled = false,
  isChecking = false,
  onSubmit,
  onRestart,
  isCompleted = false,
  onNavigateHome,
  phase = 'entry',
  activeRetryId: _activeRetryId = null,
}: SentenceWritingRendererProps) {
  const subMode = config.sub_mode || 'FREE_SENTENCE'

  // Kiểm tra xem từ/cụm từ có trong đoạn văn bản hay không
  const isWordPresent = (text: string, word: string) => {
    if (!text || !text.trim()) return false
    const cleanWord = word.trim().toLowerCase()
    if (!cleanWord) return false

    if (cleanWord.includes(' ')) {
      return text.toLowerCase().includes(cleanWord)
    }

    const targetToken = normalizeToken(cleanWord)
    const tokens = text.split(/\s+/).map(normalizeToken).filter(Boolean)
    return tokens.some((t) => {
      if (t === targetToken) return true
      if (targetToken.length >= 3) {
        if (t === `${targetToken}s` || t === `${targetToken}es`) return true
        if (t === `${targetToken}ed` || t === `${targetToken}ing`) return true
      }
      return false
    })
  }

  // ==========================================
  // DẠNG 3.3: VIẾT ĐOẠN VĂN (PARAGRAPH)
  // ==========================================
  if (subMode === 'PARAGRAPH') {
    const paragraphConfig = config.paragraph || {
      prompt: 'Write a short paragraph.',
      min_words: 30,
      max_words: 100,
    }

    const paragraphKey = 'paragraph'
    const currentText = answers[paragraphKey] || answers['1'] || ''
    const wordCount = currentText.trim() ? currentText.trim().split(/\s+/).filter(Boolean).length : 0
    const paragraphResult = results?.[paragraphKey] || results?.['1']

    const minWords = paragraphConfig.min_words || 30
    const maxWords = paragraphConfig.max_words || 100
    const helperWords = paragraphConfig.helper_words || []
    const criteria = paragraphConfig.criteria || []
    const hints = paragraphConfig.hints || []

    // 1. Khi đoạn văn đã hoàn thành
    if (isCompleted) {
      return (
        <div className="form-3-writing-container">
          <section className="card summary" id="summaryCard">
            <div className="ch">
              <h2>Task complete ✓</h2>
              <p>Đoạn văn của bạn đã được AI đánh giá và đạt yêu cầu!</p>
            </div>
            <div className="cb">
              <div className="sr">
                <span>Your Paragraph ({wordCount} words)</span>
                <StatusTag tone="success">Complete ✓</StatusTag>
              </div>
              <div className="reuse" style={{ marginTop: '12px' }}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '14px', background: '#fdfcfe' }}>
                  {currentText}
                </div>
              </div>

              {paragraphResult?.criteria_met && paragraphResult.criteria_met.length > 0 && (
                <div style={{ marginTop: '14px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', marginBottom: '6px' }}>
                    ✓ Tiêu chí đạt được:
                  </div>
                  {paragraphResult.criteria_met.map((cm, cIdx) => (
                    <div key={cIdx} className="criteria-eval-item passed">
                      <span>✓</span>
                      <span><strong>{cm.criterion}</strong>: {cm.comment || 'Tốt'}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="actions" style={{ marginTop: '16px' }}>
                {onRestart && (
                  <ActionButton id="restartBtn" variant="secondary" onClick={onRestart}>
                    🔄 Làm lại (Try again)
                  </ActionButton>
                )}
                {onNavigateHome && (
                  <ActionButton id="homeBtn" onClick={onNavigateHome}>
                    ⌨️ Quay lại trang nhập mã
                  </ActionButton>
                )}
              </div>
            </div>
          </section>
        </div>
      )
    }

    // 2. Giao diện soạn thảo đoạn văn
    return (
      <div className="form-3-writing-container">
        <section className="card" id="captureCard">
          <div className="cb" style={{ paddingTop: '16px' }}>

            {/* Helper Word Bank (Vốn từ trợ giúp) */}
            {helperWords.length > 0 && (
              <div className="helper-words-box">
                <div className="helper-words-title">💡 Vốn từ / Cụm từ gợi ý (Word Bank):</div>
                <div className="helper-words-list">
                  {helperWords.map((word, wIdx) => {
                    const used = isWordPresent(currentText, word)
                    return (
                      <span key={wIdx} className={`helper-word-chip ${used ? 'used' : ''}`}>
                        <span>{used ? '✓' : '🏷️'}</span>
                        <span>{word}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Criteria (Tiêu chí đánh giá) */}
            {criteria.length > 0 && (
              <div className="criteria-box">
                <div className="criteria-title">📋 Tiêu chí cần có trong bài viết:</div>
                <ul className="criteria-list">
                  {criteria.map((c, cIdx) => (
                    <li key={cIdx}>{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Hints */}
            {hints.length > 0 && (
              <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe', fontSize: '12px', color: '#1e40af' }}>
                <strong>💡 Gợi ý viết:</strong> {hints.join(' • ')}
              </div>
            )}

            {/* Textarea nhập đoạn văn */}
            <textarea
              id="paragraph-writing-input"
              rows={7}
              className="paragraph-textarea"
              placeholder="Nhập đoạn văn tiếng Anh của bạn tại đây..."
              disabled={disabled || isChecking}
              value={currentText}
              onChange={(e) => {
                onAnswerChange(paragraphKey, e.target.value)
                onAnswerChange('1', e.target.value)
              }}
            />

            <div className="paragraph-counter-bar">
              <span>
                {wordCount < minWords ? (
                  <span style={{ color: '#d97706' }}>⚠️ Cần thêm ít nhất {minWords - wordCount} từ nữa</span>
                ) : wordCount > maxWords ? (
                  <span style={{ color: '#0284c7' }}>ℹ️ Đoạn văn khá dài ({wordCount}/{maxWords} từ)</span>
                ) : (
                  <span style={{ color: '#16a34a' }}>✓ Đã đạt độ dài yêu cầu ({wordCount} từ)</span>
                )}
              </span>
              <span>Min: {minWords} | Max: {maxWords}</span>
            </div>

            {/* Feedback từ AI nếu có */}
            {paragraphResult && !paragraphResult.correct && (
              <div className="ai-paragraph-feedback">
                <div className="feedback-header">
                  <span>💡 Nhận xét từ AI Tutor</span>
                  {paragraphResult.score !== undefined && (
                    <span style={{ fontSize: '13px', background: '#ffffff', padding: '2px 8px', borderRadius: '6px', border: '1px solid #f9dbe7' }}>
                      Điểm: {paragraphResult.score}/100
                    </span>
                  )}
                </div>

                {paragraphResult.feedback_vi && (
                  <div style={{ marginBottom: '8px', lineHeight: 1.5, fontSize: '13px' }}>
                    {paragraphResult.feedback_vi}
                  </div>
                )}

                {/* Chi tiết tiêu chí */}
                {paragraphResult.criteria_met && paragraphResult.criteria_met.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #f9dbe7', paddingTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Đối chiếu tiêu chí:</div>
                    {paragraphResult.criteria_met.map((cm, cIdx) => (
                      <div key={cIdx} className={`criteria-eval-item ${cm.passed ? 'passed' : 'failed'}`}>
                        <span>{cm.passed ? '✓' : '✗'}</span>
                        <span><strong>{cm.criterion}</strong>: {cm.comment || (cm.passed ? 'Đạt' : 'Chưa đạt')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lỗi ngữ pháp cụ thể */}
                {paragraphResult.grammar_issues && paragraphResult.grammar_issues.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #f9dbe7', paddingTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Chỉnh sửa ngữ pháp:</div>
                    {paragraphResult.grammar_issues.map((gi, gIdx) => (
                      <div key={gIdx} className="grammar-issue-item">
                        ⚠️ <em>"{gi.issue}"</em> ➜ Gợi ý sửa: <strong>"{gi.suggestion}"</strong>
                      </div>
                    ))}
                  </div>
                )}

                {/* Gợi ý chung */}
                {paragraphResult.suggestions && paragraphResult.suggestions.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px dashed #f9dbe7', paddingTop: '8px', fontSize: '12px' }}>
                    <strong>Hướng dẫn cải thiện:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {paragraphResult.suggestions.map((sug, sIdx) => (
                        <li key={sIdx}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {onSubmit && (
              <div className="actions">
                <ActionButton
                  id="checkWritingBtn"
                  disabled={disabled || isChecking || wordCount === 0}
                  onClick={onSubmit}
                >
                  {isChecking ? 'AI đang chấm bài...' : 'Nộp đoạn văn & Chấm AI'}
                </ActionButton>
              </div>
            )}
          </div>
        </section>
      </div>
    )
  }

  // ==========================================
  // DẠNG 3.1 VÀ 3.2: TỪNG CÂU HỎI VIẾT (SENTENCES)
  // ==========================================
  const items = config.items || []

  // 1. Khi đã hoàn thành tất cả các câu (chỉ hiển thị standalone summary nếu không có guided chat runner)
  if (isCompleted && phase !== 'complete' && phase !== 'guided') {
    return (
      <div className="form-3-writing-container">
        <section className="card summary" id="summaryCard">
          <div className="ch">
            <h2>Task complete ✓</h2>
            <p>All sentences are verified and correct.</p>
          </div>
          <div className="cb">
            <div className="sr">
              <span>Your Sentences ({items.length})</span>
              <StatusTag tone="success">Complete ✓</StatusTag>
            </div>
            <div className="reuse">
              {items.map((item, index) => {
                const itemId = String(item.id || index + 1)
                const studentVal = (answers[itemId] || '').trim()
                const prefix = (item.sentence_starter || '').trim()
                const suffix = (item.sentence_ending || '').trim()
                let displaySentence = studentVal || '—'
                if (studentVal && prefix) {
                  if (studentVal.toLowerCase().startsWith(prefix.toLowerCase())) {
                    displaySentence = studentVal
                  } else {
                    displaySentence = `${prefix} ${studentVal}`
                  }
                }
                if (studentVal && suffix && !displaySentence.toLowerCase().endsWith(suffix.toLowerCase())) {
                  displaySentence = `${displaySentence} ${suffix}`
                }
                return (
                  <div key={itemId} style={{ marginBottom: '8px', lineHeight: 1.6 }}>
                    {index + 1}. <strong>{displaySentence}</strong>
                  </div>
                )
              })}
            </div>
            <div className="actions">
              {onRestart && (
                <ActionButton id="restartBtn" variant="secondary" onClick={onRestart}>
                  🔄 Làm lại (Try again)
                </ActionButton>
              )}
              {onNavigateHome && (
                <ActionButton id="homeBtn" onClick={onNavigateHome}>
                  ⌨️ Quay lại trang nhập mã
                </ActionButton>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  // 2. Giao diện thu bài Quick capture cho từng câu
  return (
    <div className="form-3-writing-container">
      <section className="card" id="captureCard">
        <div className="ch">
          <h2>{config.intro || 'Your answers'}</h2>
          {phase === 'guided' ? (
            <p>Khung đáp án ban đầu của bạn. Đang sửa từng câu cùng AI ở bên dưới ⬇️</p>
          ) : subMode === 'BOOK_KEYWORD' ? (
            <p>Viết các câu theo yêu cầu và sử dụng các từ gợi ý trong sách bài tập.</p>
          ) : null}
        </div>
        <div className="cb">
          {items.map((item, index) => {
            const itemId = String(item.id || index + 1)
            const currentAnswer = answers[itemId] || ''
            const itemResult = results?.[itemId]
            const reqWords = item.required_words || []

            // Ở dạng BOOK_KEYWORD hoặc FREE_SENTENCE: KHÔNG hiện chip từ khóa trên web!
            const showChips = !config.sub_mode && reqWords.length > 0
            const isRowDisabled = disabled || isChecking || phase === 'guided' || phase === 'complete'
            const isCorrect = itemResult?.correct === true || phase === 'complete'
            const isWrong = !isCorrect && itemResult && !itemResult.correct
            const hasCustomPrompt = subMode !== 'FREE_SENTENCE' && Boolean(item.prompt)
            const showStatusTag = phase === 'guided' || phase === 'complete'

            return (
              <div className="capture-row" key={itemId}>
                <span className="num-badge">{index + 1}</span>
                <div className="capture-input-col">
                  {(hasCustomPrompt || (showStatusTag && isCorrect)) && (
                    <div style={{ display: 'flex', justifyContent: hasCustomPrompt ? 'space-between' : 'flex-end', alignItems: 'center', marginBottom: '4px' }}>
                      {hasCustomPrompt && (
                        <div className="prompt-label" style={{ margin: 0 }}>{item.prompt}</div>
                      )}
                      {showStatusTag && isCorrect && (
                        <StatusTag tone="success">
                          Correct ✓
                        </StatusTag>
                      )}
                    </div>
                  )}

                  {/* Tag gợi ý xem sách cho dạng 3.2 */}
                  {subMode === 'BOOK_KEYWORD' && (
                    <div className="book-cue-tag">
                      <span>📖</span>
                      <span>Xem từ gợi ý trong sách bài tập</span>
                    </div>
                  )}

                  {/* Hiển thị chips chỉ với bài mẫu cũ chưa nâng cấp sub_mode */}
                  {showChips && (
                    <div className="target-words-bar">
                      {reqWords.map((word, wIdx) => {
                        const matched = isWordPresent(currentAnswer, word)
                        return (
                          <span
                            key={wIdx}
                            className={`target-word-pill ${matched ? 'matched' : ''}`}
                          >
                            <span>{matched ? '✓' : '🏷️'}</span>
                            <span>{word}</span>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <div className="sentence-input-wrapper">
                    {item.sentence_starter && (
                      <span className="sentence-starter-prefix" title="Phần đầu câu cho trước">
                        {item.sentence_starter}
                      </span>
                    )}
                    <input
                      id={`writing-input-${itemId}`}
                      type="text"
                      disabled={isRowDisabled}
                      placeholder={item.sentence_starter ? 'viết tiếp câu của bạn...' : 'Type what you wrote'}
                      value={currentAnswer}
                      onChange={(e) => onAnswerChange(itemId, e.target.value)}
                      className={`sentence-writing-input ${
                        item.sentence_starter ? 'has-prefix' : ''
                      } ${item.sentence_ending ? 'has-suffix' : ''} ${
                        isCorrect
                          ? 'is-correct'
                          : isWrong
                          ? 'is-wrong'
                          : ''
                      }`}
                    />
                    {item.sentence_ending && (
                      <span className="sentence-starter-suffix" title="Phần kết câu cho trước">
                        {item.sentence_ending}
                      </span>
                    )}
                  </div>

                  {/* Khi ở phase 'guided': KHÔNG hiển thị hint-box trong khung Your answers này! */}
                  {/* Vì câu sai sẽ được mang xuống dưới và sửa ở khung riêng cùng AI! */}
                  {phase !== 'guided' && itemResult && !itemResult.correct && (
                    <div className="hint-box">
                      {itemResult.missingWords && itemResult.missingWords.length > 0 ? (
                        subMode === 'BOOK_KEYWORD' ? (
                          <div>
                            ⚠️ <strong>Chưa đủ từ gợi ý:</strong> Bạn chưa dùng đủ từ gợi ý từ sách bài tập. Hãy mở sách đối chiếu và bổ sung vào câu nhé!
                          </div>
                        ) : (
                          <div>
                            ⚠️ <strong>Chưa đủ từ bắt buộc:</strong> Còn thiếu từ{' '}
                            <strong>"{itemResult.missingWords.join(', ')}"</strong>. Hãy thêm vào câu nhé!
                          </div>
                        )
                      ) : itemResult.feedback_vi ? (
                        <div>
                          💡 <strong>AI Tutor:</strong> {itemResult.feedback_vi}
                          {itemResult.hint && (
                            <div style={{ marginTop: '2px', opacity: 0.9 }}>
                              Gợi ý: {itemResult.hint}
                            </div>
                          )}
                        </div>
                      ) : itemResult.hint ? (
                        <div>
                          💡 <strong>Gợi ý:</strong> {itemResult.hint}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {onSubmit && phase === 'entry' && !isCompleted && (
            <div className="actions">
              <ActionButton
                id="checkWritingBtn"
                disabled={disabled || isChecking}
                onClick={onSubmit}
              >
                {isChecking ? 'Checking...' : 'Check my writing'}
              </ActionButton>
            </div>
          )}

          {phase === 'guided' && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
              💡 Khung đáp án ban đầu của bạn đang được giữ nguyên để đối chiếu. Hãy cuộn xuống dưới để sửa từng câu nhé! ⬇️
            </div>
          )}

          {phase === 'complete' && (
            <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', fontSize: '12px', color: '#166534', textAlign: 'center', fontWeight: 600 }}>
              ✓ Tất cả các câu đã hoàn thành chính xác! Xem tổng kết ở bên dưới ⬇️
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
