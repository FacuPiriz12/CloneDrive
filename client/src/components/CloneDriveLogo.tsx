export default function CloneDriveLogo({ className = "h-10" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 200 60" 
      className={className}
      data-testid="logo-clone-drive"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700&display=swap');
          .logo-text {
            font-family: 'Montserrat', sans-serif;
            font-weight: 700;
            fill: #0061d5;
            letter-spacing: -4px;
          }
        `}
      </style>
      <text 
        x="10" 
        y="45" 
        className="logo-text"
        fontSize="48"
      >
        TERA
      </text>
    </svg>
  );
}
