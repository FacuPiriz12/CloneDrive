import dropboxIcon from '@assets/Dropbox_Icon.svg_1758485215717.png';

interface DropboxLogoProps {
  className?: string;
  size?: number;
}

export default function DropboxLogo({ className = "w-6 h-6", size }: DropboxLogoProps) {
  const style = size ? { width: size, height: size } : {};
  
  return (
    <img 
      src={dropboxIcon} 
      alt="Dropbox" 
      className={`${className} object-contain aspect-square`}
      style={style}
      data-testid="logo-dropbox"
    />
  );
}