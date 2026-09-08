import { useState } from 'react'
import type { TaskComponentProps } from '../../app/task-types'
import { Celebration } from '../../components/effects/Celebration'
import { ListenButton } from '../../components/listening/ListenButton'
import { ProgressSteps } from '../../components/progress/ProgressSteps'
import { RecordingCard } from '../../components/recording/RecordingCard'
import { StatusFooter } from '../../components/shell/StatusFooter'
import { ActionButton } from '../../components/task/ActionButton'
import { StatusTag } from '../../components/task/StatusTag'
import { TaskRenderer } from '../../task-engine/TaskRenderer'
import type { TaskFlowBlock } from '../../task-engine/schema'
import { SENTENCES_60124 } from './data'
import './task.css'

export function Task60124({ task }: TaskComponentProps) {
  const [index,setIndex]=useState(0); const [attempts,setAttempts]=useState([0,0,0,0]); const [reviewed,setReviewed]=useState(false); const [complete,setComplete]=useState(false); const [notices,setNotices]=useState<string[]>([])
  const pass=index!==1||attempts[index]>1
  const recorded=()=>{setAttempts(v=>v.map((x,i)=>i===index?x+1:x));setReviewed(true)}
  const advance=()=>{setReviewed(false);if(index===3)setComplete(true);else{setIndex(v=>v+1);setNotices(v=>[...v,'Good. Let’s read the next sentence.'])}}
  const blocks:TaskFlowBlock[]=[{id:'intro',type:'tutor-message',content:<><strong>Task 4.</strong><br/>Read four full sentences clearly and smoothly.</>},...notices.map((n,i):TaskFlowBlock=>({id:`n-${i}`,type:'tutor-message',content:n})),...(!complete?[{id:`sentence-${index}-${attempts[index]}-${reviewed}`,type:'custom' as const,content:!reviewed?<RecordingCard key={`${index}-${attempts[index]}`} label={`Sentence ${index+1}`} range={`${index+1} / 4`} stage="sentence" dataSentence={index+1} transcript={SENTENCES_60124[index]} confirmationMode="automatic" demoLabel="🔊 Listen" recordLabel="🎙 Record" onConfirm={recorded}><ProgressSteps steps={SENTENCES_60124.map((_,i)=>({id:String(i),label:String(i+1),status:i<index?'complete':i===index?'active':'pending'}))}/><div className="sentence">{SENTENCES_60124[index]}</div><div className="helper">Listen if you need help. Then read the whole sentence.</div></RecordingCard>:<section className="card" data-stage="sentence" data-sentence={index+1}><div className="ch"><h2>Sentence {index+1}</h2><span>{index+1} / 4</span></div><div className="cb"><div className="transcript"><strong>What I heard</strong>{SENTENCES_60124[index]}</div><div className={`feedback ${pass?'ok':'warn'}`}><strong>{pass?'Clear and smooth ✓':'Almost there.'}</strong><br/>{pass?'Your sentence was easy to understand.':'Your sentence was clear, but there were a few long pauses. Try to keep the words together.'}</div><div className="actions"><ListenButton text={SENTENCES_60124[index]} label="🔊 Listen again"/>{pass?<ActionButton variant="success" data-next onClick={advance}>{index===3?'Finish':'Next sentence'}</ActionButton>:<ActionButton data-retry onClick={()=>{setReviewed(false);setNotices(v=>[...v,'Try once more. Keep the sentence moving.'])}}>🎙 Try again</ActionButton>}</div></div></section>}]:[]),...(complete?[{id:'complete',type:'panel' as const,title:'Task 4 complete ✓',subtitle:'Sentence fluency',variant:'summary' as const,stage:'complete',content:<><div className="sr"><span>Sentences completed</span><StatusTag tone="success">4 / 4 ✓</StatusTag></div><div className="sr"><span>Clear & understandable</span><StatusTag tone="success">4 / 4 ✓</StatusTag></div><div className="sr"><span>Extra retry</span><StatusTag tone="warning">{attempts.filter(x=>x>1).length} sentence</StatusTag></div></>},{id:'celebrate',type:'custom' as const,content:<Celebration active/>}]:[])];
  return <TaskRenderer task={task} className="task-60124 fluency-task" footer={<StatusFooter title={complete?'Task 4 complete':'Task 4'} status={complete?'Continue to Task 5.':`Sentence ${index+1} of 4`} actionLabel="Back to book" actionId="backBook" disabled={!complete} onAction={()=>setNotices(v=>[...v,'Keep going. I’ll be here when you need me.'])}/>} blocks={blocks}/>
}
