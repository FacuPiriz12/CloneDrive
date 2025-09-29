import googleDriveIcon from '@assets/Google_Drive_icon_(2020).svg_1758485215720.png';

interface GoogleDriveLogoProps {
  className?: string;
  size?: number;
}

export default function GoogleDriveLogo({ className = "w-6 h-6", size }: GoogleDriveLogoProps) {
  const style = size ? { width: size, height: size } : {};
  
  return (
    <img 
      src={googleDriveIcon} 
      alt="Google Drive" 
      className={`${className} object-contain aspect-square`}
      style={style}
      data-testid="logo-google-drive"
    />
  );
}