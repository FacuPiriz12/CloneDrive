import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import CloneDriveLogo from "./CloneDriveLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Search, LogOut, Settings, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";

export default function Header() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      // Clear all queries from cache
      queryClient.clear();
      
      // Use POST method for logout
      const response = await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Use client-side navigation instead of full page reload
        setLocation('/');
      } else {
        console.error('Error al cerrar sesión');
        // Fallback: use client-side navigation
        setLocation('/');
      }
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      // Fallback: use client-side navigation  
      setLocation('/');
    }
  };

  const goToDashboard = () => {
    setLocation('/');
  };

  const goToSettings = () => {
    setLocation('/settings');
  };

  const goToProfile = () => {
    setLocation('/profile');
  };

  return (
    <header className="sticky top-0 z-[9999] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] border-b border-border" data-testid="header-main">
      <div className="px-8 h-[65px] flex justify-between items-center">
        {/* Logo */}
        <button 
          onClick={goToDashboard}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          data-testid="button-logo-dashboard"
        >
          <CloneDriveLogo className="h-10" />
        </button>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-[40%] mx-8 hidden md:block">
          <div className="relative flex items-center bg-muted rounded-lg px-4 py-[0.6rem]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('actions.searchPlaceholder')}
              className="ml-2 w-full border-none bg-transparent text-[0.95rem] focus:outline-none focus:ring-0 shadow-none"
              data-testid="input-search"
            />
          </div>
        </div>
        
        {/* User Actions */}
        <div className="flex items-center gap-5">
          {/* User Profile */}
          {user && (
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-[0.6rem] h-auto p-0 hover:opacity-80" data-testid="button-user-menu">
                    <Avatar className="w-9 h-9 bg-primary text-white">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary text-white font-semibold">
                        {user.firstName?.[0] || user.email?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-foreground" data-testid="text-user-name">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user.email?.split('@')[0] || t('user.fallbackName')
                      }
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t('user.myAccount')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={goToProfile} data-testid="menu-profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>{t('user.profile')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={goToSettings} data-testid="menu-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t('user.settings')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('auth.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Language Switcher */}
              <LanguageSwitcher variant="icon" />
              
              {/* Settings Icon */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={goToSettings}
                className="h-9 w-9 p-0 hover:bg-muted"
                data-testid="button-settings-icon"
                aria-label={t('user.settings')}
                title={t('user.settings')}
              >
                <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
