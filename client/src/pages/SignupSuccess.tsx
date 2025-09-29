import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import CloneDriveLogo from "@/components/CloneDriveLogo";

export default function SignupSuccess() {
  const { t } = useTranslation(['auth', 'common']);
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-600">
            {t('signupSuccess.title')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('signupSuccess.subtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                  {t('signupSuccess.checkEmailTitle')}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('signupSuccess.checkEmailDescription')}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              {t('signupSuccess.nextStepsTitle')}
            </h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">1</span>
                </div>
                <span>{t('signupSuccess.step1')}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">2</span>
                </div>
                <span>{t('signupSuccess.step2')}</span>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-foreground">3</span>
                </div>
                <span>{t('signupSuccess.step3')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => setLocation('/login')}
              className="w-full"
              data-testid="button-continue-login"
            >
              {t('signupSuccess.continueToLogin')}
            </Button>
            
            <Button 
              onClick={() => setLocation('/')}
              variant="outline"
              className="w-full"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('signupSuccess.backToHome')}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {t('signupSuccess.noEmail')}{' '}
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs"
                onClick={() => setLocation('/signup')}
                data-testid="button-signup-again"
              >
                {t('signupSuccess.tryAgain')}
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}