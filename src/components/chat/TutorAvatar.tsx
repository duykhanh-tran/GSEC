export const TUTOR_AVATAR_URL =
  'https://dl.dropboxusercontent.com/scl/fi/z8qz4l2l5wd50qy8343y1/z-3.jpg?rlkey=cvdmxr2cspuz3xlsz22abhllc&st=klfja3m1&dl=0'

interface TutorAvatarProps {
  decorative?: boolean
}

export function TutorAvatar({ decorative = true }: TutorAvatarProps) {
  return (
    <span className="avatar ui-avatar" aria-hidden={decorative || undefined}>
      <img
        src={TUTOR_AVATAR_URL}
        alt={decorative ? '' : 'AI Tutor'}
        width="34"
        height="34"
      />
    </span>
  )
}
