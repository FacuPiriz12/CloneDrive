import logoUrl from '@/assets/logo-tera.png';

export default function CloneDriveLogo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <img 
      src={logoUrl} 
      alt="TERA Logo" 
      className={className}
      data-testid="logo-clone-drive"
    />
  );
}
