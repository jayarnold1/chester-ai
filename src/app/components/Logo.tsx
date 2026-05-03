type Props = { size?: number; withWordmark?: boolean; className?: string };

export function Logo({ size = 40, withWordmark = false, className = "" }: Props) {
  const id = `chester-grad-${size}`;
  const id2 = `chester-grad-c-${size}`;
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Chester AI logo"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="55%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id={id2} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>
        </defs>

        {/* Rounded squircle badge */}
        <rect x="2" y="2" width="60" height="60" rx="16" fill={`url(#${id})`} />

        {/* Subtle inner highlight */}
        <rect x="2" y="2" width="60" height="30" rx="16" fill="white" opacity="0.08" />

        {/* Stylised "C" mark */}
        <path
          d="M44 22.5c-2.6-3-6.5-4.8-10.7-4.8-7.9 0-13.8 6-13.8 14.3S25.4 46.3 33.3 46.3c4.2 0 8.1-1.8 10.7-4.8"
          stroke={`url(#${id2})`}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Neural / spark accent dots */}
        <circle cx="46" cy="20" r="3" fill="#fde68a" />
        <circle cx="46" cy="20" r="1.2" fill="#fff" />
        <circle cx="50" cy="44" r="2" fill="#a5f3fc" />
        <circle cx="20" cy="44" r="1.5" fill="#fbcfe8" />

        {/* Connecting lines hinting at AI nodes */}
        <line x1="46" y1="20" x2="50" y2="44" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
        <line x1="50" y1="44" x2="20" y2="44" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" />
      </svg>

      {withWordmark && (
        <div className="leading-tight">
          <div className="bg-gradient-to-r from-blue-600 via-violet-600 to-pink-500 bg-clip-text text-transparent tracking-tight">
            Chester
          </div>
          <div className="text-[10px] tracking-[0.25em] text-gray-500 -mt-0.5">AI STUDIO</div>
        </div>
      )}
    </div>
  );
}
