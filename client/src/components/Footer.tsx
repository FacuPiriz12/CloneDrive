import CloneDriveLogo from "./CloneDriveLogo";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-border bg-muted/30" data-testid="footer-main">
      <div className="max-w-6xl mx-auto text-center">
        <p className="text-muted-foreground text-sm">
          {t('footer.copyright')}
        </p>
      </div>
    </footer>
  );
}