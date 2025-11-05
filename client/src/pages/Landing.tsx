import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Copy, Shield, Zap } from "lucide-react";
import CloneDriveLogo from "@/components/CloneDriveLogo";
import Footer from "@/components/Footer";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { motion } from "framer-motion";

export default function Landing() {
  const { t } = useTranslation(['landing', 'common']);
  const [, setLocation] = useLocation();
  
  const handleLogin = () => {
    setLocation("/login");
  };

  const handleSignup = () => {
    setLocation("/signup");
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <CloneDriveLogo className="h-12" />
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher variant="icon" />
              <Button variant="outline" onClick={handleSignup} data-testid="button-signup">
                Sign Up
              </Button>
              <Button onClick={handleLogin} data-testid="button-login">
                Log In
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Aurora Background */}
      <AuroraBackground>
        <motion.div
          initial={{ opacity: 0.0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="relative flex flex-col gap-4 items-center justify-center px-4"
        >
          <h1 className="text-3xl md:text-7xl font-bold dark:text-white text-center">
            {t('hero.title')}
            <span className="text-primary block">{t('hero.subtitle')}</span>
          </h1>
          <p className="font-extralight text-base md:text-4xl dark:text-neutral-200 py-4 text-center max-w-2xl">
            {t('hero.description')}
          </p>
          <Button 
            size="lg" 
            onClick={handleLogin}
            className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300"
            data-testid="button-get-started"
          >
            {t('hero.ctaButton')}
          </Button>
        </motion.div>
      </AuroraBackground>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {t('features.title')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {t('features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Copy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">{t('features.smartCopy.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('features.smartCopy.description')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Cloud className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">{t('features.driveCompatible.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('features.driveCompatible.description')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">{t('features.fast.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('features.fast.description')}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-lg">{t('features.secure.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  {t('features.secure.description')}
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              {t('howItWorks.title')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {t('howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('howItWorks.step1.title')}</h3>
              <p className="text-muted-foreground">
                {t('howItWorks.step1.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('howItWorks.step2.title')}</h3>
              <p className="text-muted-foreground">
                {t('howItWorks.step2.description')}
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('howItWorks.step3.title')}</h3>
              <p className="text-muted-foreground">
                {t('howItWorks.step3.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-xl mb-8 opacity-90">
            {t('cta.subtitle')}
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={handleLogin}
            className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all duration-300"
            data-testid="button-cta"
          >
            {t('cta.button')}
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
