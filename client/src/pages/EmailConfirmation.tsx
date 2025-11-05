import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabasePromise } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import CloneDriveLogo from "@/components/CloneDriveLogo";

export default function EmailConfirmation() {
  const { t } = useTranslation(['auth', 'common']);
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // Get the hash from URL (contains the confirmation token)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (type === 'signup' && accessToken && refreshToken) {
          const supabase = await supabasePromise;
          
          // Set the session with the tokens from the URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            setStatus('error');
            setMessage(error.message);
            return;
          }

          setStatus('success');
          setMessage(t('emailConfirmation.success'));
          
          // Redirect to home after 3 seconds
          setTimeout(() => {
            setLocation('/');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(t('emailConfirmation.invalidLink'));
        }
      } catch (error) {
        console.error('Email confirmation error:', error);
        setStatus('error');
        setMessage(t('emailConfirmation.error'));
      }
    };

    confirmEmail();
  }, [t, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center mx-auto mb-4">
            <CloneDriveLogo className="h-14" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && t('emailConfirmation.verifying')}
            {status === 'success' && t('emailConfirmation.confirmed')}
            {status === 'error' && t('emailConfirmation.failed')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {status === 'loading' && t('emailConfirmation.verifyingDescription')}
            {status === 'success' && t('emailConfirmation.confirmedDescription')}
            {status === 'error' && t('emailConfirmation.failedDescription')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex justify-center">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-primary animate-spin" data-testid="icon-loading" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-16 w-16 text-green-500" data-testid="icon-success" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-16 w-16 text-red-500" data-testid="icon-error" />
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground" data-testid="text-message">
              {message}
            </p>
          </div>

          {status === 'success' && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {t('emailConfirmation.redirecting')}
              </p>
              <Button 
                onClick={() => setLocation('/')}
                className="w-full"
                data-testid="button-continue"
              >
                {t('emailConfirmation.continueToApp')}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Button 
                onClick={() => setLocation('/signup')}
                className="w-full"
                data-testid="button-signup-again"
              >
                {t('emailConfirmation.signupAgain')}
              </Button>
              <Button 
                onClick={() => setLocation('/login')}
                variant="outline"
                className="w-full"
                data-testid="button-login"
              >
                {t('emailConfirmation.tryLogin')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}