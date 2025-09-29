import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Link } from "wouter";
import CloneDriveLogo from "@/components/CloneDriveLogo";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onReplitLogin: () => void;
}

export default function LoginForm({ onReplitLogin }: LoginFormProps) {
  const { t } = useTranslation(['auth', 'common']);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema.extend({
      email: z.string().email({ message: t('validation.invalidEmail') }),
      password: z.string().min(6, { message: t('validation.passwordTooShort') })
    })),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implementar login con email/password cuando esté disponible
      console.log('Login attempt:', data);
      // Por ahora usar Replit Auth
      onReplitLogin();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <CloneDriveLogo className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('login.title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('login.subtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Replit Auth Button - Primary Option */}
          <Button 
            onClick={onReplitLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 shadow-lg hover:shadow-xl transition-all duration-300"
            data-testid="button-replit-login"
          >
            <div className="w-5 h-5 bg-white rounded mr-2 flex items-center justify-center">
              <span className="text-blue-600 text-xs font-bold">R</span>
            </div>
            {t('login.continueWithReplit')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t('login.orContinueWith')}
              </span>
            </div>
          </div>

          {/* Traditional Login Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login.emailLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder={t('login.emailPlaceholder')}
                          className="pl-10"
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('login.passwordLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder={t('login.passwordPlaceholder')}
                          className="pl-10 pr-10"
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
                data-testid="button-login-submit"
              >
                {isLoading ? t('common:status.loading') : t('login.signInButton')}
              </Button>
            </form>
          </Form>

          <div className="text-center space-y-2">
            <Link href="/forgot-password">
              <Button variant="link" className="p-0 h-auto font-normal text-sm">
                {t('login.forgotPassword')}
              </Button>
            </Link>
            
            <div className="text-sm text-muted-foreground">
              {t('login.noAccount')}{' '}
              <Link href="/signup">
                <Button variant="link" className="p-0 h-auto font-normal text-sm">
                  {t('login.signUp')}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}