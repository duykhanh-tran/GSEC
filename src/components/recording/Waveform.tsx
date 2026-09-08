interface WaveformProps {
  active?: boolean
  bars?: number
}

export function Waveform({ active = false, bars = 15 }: WaveformProps) {
  return (
    <div className={`recording-wave wave ${active ? 'recording' : ''}`.trim()} aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => <span className="recording-wave__bar bar" key={index} />)}
    </div>
  )
}
