export function ScooterArt({ dark = false }: { dark?: boolean }) {
  return <svg viewBox="0 0 680 420" role="img" aria-label="Minh họa xe máy điện" className="h-full w-full drop-shadow-2xl">
    <defs><linearGradient id="bodyPaint" x1="0" x2="1" y1="0" y2="1"><stop stopColor={dark ? '#d2f9dd' : '#234f51'} /><stop offset="1" stopColor={dark ? '#55d9a4' : '#0d3035'}/></linearGradient><linearGradient id="seat" x1="0" x2="1"><stop stopColor="#162b32"/><stop offset="1" stopColor="#355157"/></linearGradient></defs>
    <ellipse cx="341" cy="363" rx="262" ry="16" fill="#071e22" opacity=".16"/>
    <circle cx="177" cy="312" r="65" fill="#1d3339" stroke="#0c2026" strokeWidth="9"/><circle cx="177" cy="312" r="36" fill="#b6c9c7" stroke="#677e83" strokeWidth="9"/><circle cx="177" cy="312" r="13" fill="#314c51"/>
    <circle cx="514" cy="312" r="65" fill="#1d3339" stroke="#0c2026" strokeWidth="9"/><circle cx="514" cy="312" r="36" fill="#b6c9c7" stroke="#677e83" strokeWidth="9"/><circle cx="514" cy="312" r="13" fill="#314c51"/>
    <path d="M172 310 248 189l63 120h153l51-84" stroke="#203c43" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M295 177h130c24 0 44 18 50 44l-10 88H310c-21 0-30-16-29-36l14-96Z" fill="url(#bodyPaint)"/>
    <path d="M292 175h133l-11 43h-115c-8 0-16-11-7-43Z" fill={dark ? '#ecfff1' : '#356c68'} opacity=".8"/>
    <path d="M474 208c23-38 31-80 31-119" stroke="#253d43" strokeWidth="15" fill="none" strokeLinecap="round"/>
    <path d="m478 92 78-6" stroke="#253d43" strokeWidth="12" strokeLinecap="round"/><path d="m548 83 20 14" stroke="#253d43" strokeWidth="11" strokeLinecap="round"/>
    <path d="M249 167h143c19 0 32-10 30-24-1-13-17-22-36-22h-97c-23 0-36 12-40 46Z" fill="url(#seat)"/>
    <path d="M283 192c-22 33-33 58-42 104" stroke={dark ? '#9ff1c8' : '#2d7172'} strokeWidth="11" fill="none" strokeLinecap="round"/>
    <path d="M306 313h146" stroke="#9fecc0" strokeWidth="9" strokeLinecap="round"/><path d="M458 205c-6 32-14 52-24 66" stroke="#f6fbe6" strokeWidth="8" opacity=".65" strokeLinecap="round"/>
    <rect x="465" y="177" width="21" height="42" rx="9" fill="#f4dba6"/><path d="M280 186h-17" stroke="#b2c7c6" strokeWidth="10" strokeLinecap="round"/>
  </svg>;
}
