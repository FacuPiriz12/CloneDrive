export default function CloneDriveLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="currentColor" 
      viewBox="0 0 24 24"
      data-testid="logo-clone-drive"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.8"/>
        </linearGradient>
      </defs>
      <path 
        fill="url(#logoGradient)" 
        d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.61 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
      />
      <path 
        fill="currentColor" 
        d="M14 13v4h-4v-4H7l5-5 5 5h-3z" 
        opacity="0.9"
      />
      <circle cx="16" cy="8" r="2" fill="currentColor" opacity="0.6"/>
      <circle cx="20" cy="10" r="1.5" fill="currentColor" opacity="0.4"/>
    </svg>
  );
}
