import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaskComponentProps } from '../../app/task-types'
import { Celebration } from '../../components/effects/Celebration'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { SpeakingPronunciationRenderer } from '../../task-engine/renderers/SpeakingPronunciationRenderer'
import { saveTaskAttempt } from '../../lib/taskAttemptService'
import type { PronunciationScoreResult } from '../../lib/pronunciationScorer'
import './task.css'

export function Task60116({ task }: TaskComponentProps) {
  const navigate = useNavigate()
  const [complete, setComplete] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [lastResult, setLastResult] = useState<PronunciationScoreResult | null>(null)
  const [notices, setNotices] = useState<string[]>([])

  const handlePronunciationComplete = (score: number, result: PronunciationScoreResult) => {
    setComplete(true)
    setFinalScore(score)
    setLastResult(result)

    saveTaskAttempt({
      taskCode: task.code,
      score: score,
      firstScore: score,
      status: 'completed',
      supportMode: 'INDEPENDENT',
      answersPayload: {
        recognized_text: result.recognizedText,
        accuracy_score: result.accuracyScore,
        confidence_score: result.confidenceScore,
        evaluated_words: result.evaluatedWords,
      },
    })
  }

  const handleRestart = () => {
    setComplete(false)
    setFinalScore(0)
    setLastResult(null)
  }

  const blocks: TaskFlowBlock[] = [
    {
      id: 'intro',
      type: 'tutor-message',
      content: (
        <>
          <strong>Task 6 · Speaking & Pronunciation.</strong>
          <br />
          Read aloud the sentences you wrote in Task 5. AI will evaluate your pronunciation and speech clarity.
        </>
      ),
    },
    ...notices.map((n, i): TaskFlowBlock => ({ id: `n-${i}`, type: 'tutor-message', content: n })),
    {
      id: 'speaking-console',
      type: 'custom' as const,
      content: (
        <SpeakingPronunciationRenderer
          config={{
            intro: '6B · Speaking & Pronunciation',
            linked_task_code: '60115',
            fallback_sentences: [
              'My school is Minh Khai School.',
              'In my school bag, I have a ruler and a pencil case.',
              'I also have two pens.',
              'I feel happy at school.',
            ],
            pass_score: 80,
            allow_model_listen: true,
          }}
          taskCode={task.code}
          onComplete={handlePronunciationComplete}
          onRestart={handleRestart}
          onNavigateHome={() => navigate('/?mode=code')}
        />
      ),
    },
    ...(complete
      ? [
          {
            id: 'complete',
            type: 'panel' as const,
            title: 'Task 6 complete ✓',
            subtitle: `Speaking score: ${finalScore}/100`,
            variant: 'summary' as const,
            stage: 'complete',
            content: (
              <>
                <div className="sr">
                  <span>Pronunciation Mastery</span>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>{finalScore}/100 ✓</span>
                </div>
                <div className="sr">
                  <span>Accuracy</span>
                  <span>{lastResult?.accuracyScore ?? 100}%</span>
                </div>
                <div className="sr">
                  <span>Acoustic Confidence</span>
                  <span>{lastResult?.confidenceScore ?? 90}%</span>
                </div>
              </>
            ),
          },
          { id: 'celebration', type: 'custom' as const, content: <Celebration active /> },
        ]
      : []),
  ]

  return (
    <TaskRenderer
      task={task}
      disableAutoSave={true}
      className="task-60116 speaking-task"
      footer={
        <StatusFooter
          title={complete ? 'Task 6 complete' : 'Task 6'}
          status={complete ? 'Worksheet finished.' : 'Speaking practice'}
          actionLabel="Finish"
          actionId="finishBtn"
          disabled={!complete}
          onAction={() => setNotices((v) => [...v, 'Great work! You finished Task 6.'])}
        />
      }
      blocks={blocks}
    />
  )
}
 
