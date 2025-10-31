import { useEffect } from "react";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  HardDrive
} from "lucide-react";
import GoogleDriveLogo from "@/components/GoogleDriveLogo";

interface GoogleDriveConnectionProps {
  variant?: 'header' | 'card' | 'inline' | 'sidebar';
}

export default function GoogleDriveConnection({ variant = 'header' }: GoogleDriveConnectionProps) {
  const { 
    isConnected, 
    hasValidToken, 
    connect, 
    disconnect, 
    isConnecting, 
    isDisconnecting,
    isLoadingStatus,
    checkOAuthCallback 
  } = useGoogleAuth();
  const { toast } = useToast();

  // Check for OAuth callback results
  useEffect(() => {
    const result = checkOAuthCallback();
    if (result?.success) {
      toast({
        title: "¡Conectado exitosamente!",
        description: "Tu cuenta de Google Drive ha sido conectada.",
      });
    } else if (result?.error) {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar tu cuenta de Google Drive. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [checkOAuthCallback, toast]);

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: "Cuenta desconectada",
      description: "Tu cuenta de Google Drive ha sido desconectada.",
    });
  };

  // Header variant - compact status indicator
  if (variant === 'header') {
    if (isLoadingStatus) {
      return (
        <div className="flex items-center gap-2" data-testid="google-drive-loading">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={(isConnected && hasValidToken) ? undefined : handleConnect}
              disabled={isConnecting || isDisconnecting}
              className="flex items-center gap-2 h-8 px-2"
              data-testid="google-drive-status"
            >
              <GoogleDriveLogo className="w-4 h-4" />
              {isConnected ? (
                hasValidToken ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                )
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isConnected ? (
              hasValidToken ? "Google Drive conectado" : "Token expirado - reconectar necesario"
            ) : (
              "Conectar Google Drive"
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Card variant - full connection management
  if (variant === 'card') {
    return (
      <div className="flex items-center justify-between" data-testid="google-drive-card">
        <div className="flex gap-2">
          {isConnected ? (
            <>
              {!hasValidToken && (
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  size="sm"
                  className="px-8"
                  data-testid="button-reconnect-google"
                >
                  {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Reconectar
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-8"
                    disabled={isDisconnecting}
                    data-testid="button-disconnect-google"
                  >
                    {isDisconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Desconectar Google Drive?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esto eliminará el acceso a tu cuenta de Google Drive. No podrás copiar archivos hasta que vuelvas a conectar tu cuenta.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect} data-testid="confirm-disconnect">
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              size="sm"
              className="px-8"
              data-testid="button-connect-google"
            >
              {isConnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Conectar
            </Button>
          )}
        </div>

        <div className="ml-8">
          {isConnected ? (
            hasValidToken ? (
              <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="default" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Token expirado
              </Badge>
            )
          ) : (
            <Badge variant="default" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
              <XCircle className="w-3 h-3 mr-1" />
              Desconectado
            </Badge>
          )}
        </div>
      </div>
    );
  }

  // Sidebar variant - compact with full status info
  if (variant === 'sidebar') {
    if (isLoadingStatus) {
      return (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/20" data-testid="google-drive-sidebar-loading">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Verificando...</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 hover:bg-muted/30 transition-colors" data-testid="google-drive-sidebar">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <HardDrive className="w-4 h-4 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate">Google Drive</div>
            <div className="text-xs text-muted-foreground">
              {isConnected ? (
                hasValidToken ? (
                  <span className="text-green-600">Conectado</span>
                ) : (
                  <span className="text-orange-600">Token expirado</span>
                )
              ) : (
                <span className="text-muted-foreground">Desconectado</span>
              )}
            </div>
          </div>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-1">
            {hasValidToken ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <Button
                onClick={handleConnect}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                disabled={isConnecting}
                data-testid="button-reconnect-google-sidebar"
              >
                {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reconectar"}
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={isConnecting}
            data-testid="button-connect-google-sidebar"
          >
            {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Conectar"}
          </Button>
        )}
      </div>
    );
  }

  // Inline variant - simple button
  return (
    <Button
      onClick={isConnected ? undefined : handleConnect}
      disabled={isConnecting || isDisconnecting}
      variant={isConnected ? "default" : "outline"}
      size="sm"
      className="flex items-center gap-2"
      data-testid="button-google-drive-inline"
    >
      {(isConnecting || isDisconnecting) && <Loader2 className="w-4 h-4 animate-spin" />}
      <HardDrive className="w-4 h-4" />
      {isConnected ? "Drive Conectado" : "Conectar Drive"}
      {isConnected && (
        hasValidToken ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-orange-500" />
        )
      )}
    </Button>
  );
}