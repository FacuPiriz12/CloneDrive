import CloneDriveLogo from "./CloneDriveLogo";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border bg-muted/30" data-testid="footer-main">
      <div className="max-w-6xl mx-auto text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <CloneDriveLogo className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">CloneDrive</span>
        </div>
        <p className="text-muted-foreground text-sm">
          {t('footer.copyright')}
        </p>
      </div>
    </footer>
  );
}