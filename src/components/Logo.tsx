/** Logo: ardilla inspectora de trabajo (gorra y carpeta con el visto bueno) */
export function Logo({ size = 44, title = 'Inspecciones' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} className="logo">
      <rect width="64" height="64" rx="18" fill="#FFE6CC" />
      {/* Cola */}
      <path d="M41 55C57 52 63 37 57 24C52 14 40 12 38 21C36.5 28 45 30 47 37C49 43 45 48 39 50Z" fill="#C2652A" />
      <path d="M44 48C53 44 56 35 52 27C49 21 43 21 42.5 25C42 29 48 31 49 37C50 41 47.5 45 44 48Z" fill="#E59A58" />
      {/* Pies */}
      <ellipse cx="21" cy="56.5" rx="4.5" ry="2.2" fill="#B35A22" />
      <ellipse cx="33" cy="56.5" rx="4.5" ry="2.2" fill="#B35A22" />
      {/* Cuerpo */}
      <ellipse cx="27" cy="45" rx="12" ry="12.5" fill="#D9803E" />
      <ellipse cx="27" cy="47" rx="7" ry="8.5" fill="#F7D6AE" />
      {/* Orejas */}
      <path d="M15.5 21L13 10.5L21.5 16Z" fill="#C2652A" />
      <path d="M34 15.5L39.5 9L38.5 20Z" fill="#C2652A" />
      {/* Cabeza */}
      <circle cx="27" cy="26" r="11" fill="#D9803E" />
      <ellipse cx="31" cy="30.5" rx="5.5" ry="4.2" fill="#F7D6AE" />
      <circle cx="23.5" cy="29.5" r="2.2" fill="#F29C8C" opacity="0.65" />
      <circle cx="30.5" cy="25" r="2" fill="#1B1B21" />
      <circle cx="31.2" cy="24.3" r="0.7" fill="#fff" />
      <ellipse cx="35.6" cy="29.2" rx="1.5" ry="1.1" fill="#3A2418" />
      <path d="M32.5 32.3Q34 33.4 35.5 32.3" stroke="#3A2418" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* Gorra de inspectora */}
      <path d="M15.5 19.5Q15 10 27 10Q38.5 10 38.5 19.5Z" fill="#2B3A6B" />
      <rect x="15" y="18" width="24" height="3.4" rx="1.7" fill="#1E2A50" />
      <path d="M30 19.5H41.5Q44 19.5 44 21.3Q44 22.6 42 22.6H30Z" fill="#1E2A50" />
      <circle cx="27" cy="14.2" r="2.3" fill="#F4C24F" />
      <path d="M27 12.9L27.5 13.9L28.5 14L27.7 14.7L28 15.7L27 15.1L26 15.7L26.3 14.7L25.5 14L26.5 13.9Z" fill="#B8860B" />
      {/* Carpeta */}
      <rect x="30" y="36" width="15" height="18" rx="2.2" fill="#8C5B34" />
      <rect x="32" y="39" width="11" height="13" rx="1.2" fill="#fff" />
      <rect x="34.5" y="34.6" width="6" height="3.4" rx="1.2" fill="#9AA3B8" />
      <path d="M34.3 42.5H41M34.3 45.2H41" stroke="#C5CBDA" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M34 48.4L35.8 50.2L39.6 46.4" stroke="#2E9D5B" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Patitas */}
      <circle cx="31" cy="45.5" r="2.5" fill="#D9803E" />
      <circle cx="44" cy="41" r="2.3" fill="#D9803E" />
    </svg>
  )
}
