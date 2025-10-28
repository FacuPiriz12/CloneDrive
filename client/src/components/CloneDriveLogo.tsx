import logoUrl from '@/assets/logo.png';

export default function CloneDriveLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <img 
      src={logoUrl} 
      alt="CloneDrive Logo" 
      className={className}
      data-testid="logo-clone-drive"
    />
  );
}
