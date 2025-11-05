import { useState } from "react";
import { supabasePromise } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import CloneDriveLogo from "@/components/CloneDriveLogo";

interface SignupFormProps {
  onReplitLogin: () => void;
}

export default function SignupForm({ onReplitLogin }: SignupFormProps) {
  const { t } = useTranslation(['auth', 'common']);
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Create schema inside component to access translations
  const signupSchema = z.object({
    name: z.string().min(2, { message: t('validation.nameRequired') }),
    email: z.string().email({ message: t('validation.invalidEmail') }),
    password: z.string().min(6, { message: t('validation.passwordTooShort') }),
    confirmPassword: z.string().min(6, { message: t('validation.passwordTooShort') }),
    acceptTerms: z.boolean().refine(val => val === true, {
      message: t('validation.acceptTermsRequired')
    })
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.passwordsDoNotMatch'),
    path: ["confirmPassword"]
  });

  type SignupFormData = z.infer<typeof signupSchema>;

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false
    }
  });

  const { toast } = useToast();

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const supabase = await supabasePromise;
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.protocol}//${window.location.host}/auth/confirm`,
          data: {
            first_name: data.name.split(' ')[0],
            last_name: data.name.split(' ').slice(1).join(' ') || '',
            name: data.name
          }
        }
      });

      if (error) {
        toast({
          title: t('errors.signupFailed'),
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: t('signup.success'),
        description: t('signup.checkEmail')
      });
      
      // Redirect to success page
      setTimeout(() => {
        setLocation('/signup/success');
      }, 1500);
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: t('errors.signupFailed'),
        description: t('errors.tryAgain'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <CloneDriveLogo className="h-16 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold">{t('signup.title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t('signup.subtitle')}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Replit Auth Button - Secondary Option */}
          <Button 
            onClick={onReplitLogin}
            variant="outline"
            className="w-full font-medium py-3 shadow-sm hover:shadow-md transition-all duration-300"
            data-testid="button-replit-signup"
          >
            <div className="w-5 h-5 bg-blue-600 rounded mr-2 flex items-center justify-center">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            {t('signup.continueWithReplit')}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t('signup.orCreateAccountWith')}
              </span>
            </div>
          </div>

          {/* Traditional Signup Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signup.nameLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="text"
                          placeholder={t('signup.namePlaceholder')}
                          className="pl-10"
                          data-testid="input-name"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signup.emailLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder={t('signup.emailPlaceholder')}
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
                    <FormLabel>{t('signup.passwordLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder={t('signup.passwordPlaceholder')}
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

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('signup.confirmPasswordLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={t('signup.confirmPasswordPlaceholder')}
                          className="pl-10 pr-10"
                          data-testid="input-confirm-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-8 w-8 p-0"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? (
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

              <FormField
                control={form.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-accept-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm text-muted-foreground">
                        {t('signup.acceptTerms.part1')}{' '}
                        <Link href="/terms">
                          <Button variant="link" className="p-0 h-auto font-normal text-sm underline">
                            {t('signup.acceptTerms.termsLink')}
                          </Button>
                        </Link>
                        {' '}{t('signup.acceptTerms.and')}{' '}
                        <Link href="/privacy">
                          <Button variant="link" className="p-0 h-auto font-normal text-sm underline">
                            {t('signup.acceptTerms.privacyLink')}
                          </Button>
                        </Link>
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
                data-testid="button-signup-submit"
              >
                {isLoading ? t('common:status.loading') : t('signup.createAccountButton')}
              </Button>
            </form>
          </Form>

          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {t('signup.hasAccount')}{' '}
              <Link href="/login">
                <Button variant="link" className="p-0 h-auto font-normal text-sm">
                  {t('signup.signIn')}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}