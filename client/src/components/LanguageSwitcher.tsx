import { useTranslation } from 'react-i18next';
import { Globe, Languages } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const languages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
];

interface LanguageSwitcherProps {
  variant?: 'select' | 'button' | 'icon';
}

export default function LanguageSwitcher({ variant = 'select' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  
  const changeLanguage = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };
  
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];
  
  if (variant === 'button') {
    return (
      <div className="flex items-center gap-2">
        {languages.map((lang) => (
          <Button
            key={lang.code}
            variant={i18n.language === lang.code ? 'default' : 'ghost'}
            size="sm"
            onClick={() => changeLanguage(lang.code)}
            className="flex items-center gap-1"
            data-testid={`button-language-${lang.code}`}
          >
            <span className="text-sm">{lang.flag}</span>
            <span className="text-xs">{lang.code.toUpperCase()}</span>
          </Button>
        ))}
      </div>
    );
  }
  
  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 w-9 p-0 hover:bg-muted"
            data-testid="button-language-icon"
            aria-label={t('language.switchLanguage')}
            title={t('language.switchLanguage')}
          >
            <Languages className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {languages.map((lang) => (
            <DropdownMenuItem 
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex items-center gap-2 cursor-pointer ${
                i18n.language === lang.code ? 'bg-accent text-accent-foreground' : ''
              }`}
              data-testid={`menu-language-${lang.code}`}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
              {i18n.language === lang.code && (
                <span className="ml-auto text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <Select value={i18n.language} onValueChange={changeLanguage}>
        <SelectTrigger className="w-[140px]" data-testid="select-language">
          <SelectValue>
            <div className="flex items-center gap-2">
              <span>{currentLanguage.flag}</span>
              <span className="text-sm">{currentLanguage.name}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem 
              key={lang.code} 
              value={lang.code}
              data-testid={`option-language-${lang.code}`}
            >
              <div className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}