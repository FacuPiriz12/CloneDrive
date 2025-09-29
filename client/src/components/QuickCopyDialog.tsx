import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Folder } from "lucide-react";
import PreviewDialog from "./PreviewDialog";
import FolderBrowserModal from "./FolderBrowserModal";

type Provider = 'google' | 'dropbox' | null;

interface QuickCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DestinationFolder {
  id?: string;  // Google Drive uses IDs
  path?: string; // Dropbox uses paths
  name: string;
  provider: Provider;
}

export default function QuickCopyDialog({ open, onOpenChange }: QuickCopyDialogProps) {
  const { t } = useTranslation(['copy', 'common']);
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<Provider>(null);
  const [destinationFolder, setDestinationFolder] = useState<DestinationFolder>({
    id: "root",
    path: "",
    name: "",
    provider: null
  });
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [pendingCopyData, setPendingCopyData] = useState<{
    sourceUrl: string;
    destinationFolder: DestinationFolder;
    includeSubfolders: boolean;
  } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Function to detect provider from URL
  const detectProvider = (url: string): Provider => {
    if (!url.trim()) return null;
    
    const lowerUrl = url.toLowerCase();
    
    // Google Drive patterns
    if (lowerUrl.includes('drive.google.com') || 
        lowerUrl.includes('docs.google.com') || 
        lowerUrl.includes('sheets.google.com') || 
        lowerUrl.includes('slides.google.com')) {
      return 'google';
    }
    
    // Dropbox patterns (including user content domains)
    if (lowerUrl.includes('dropbox.com') || 
        lowerUrl.includes('dropboxusercontent.com')) {
      return 'dropbox';
    }
    
    return null;
  };

  // Update provider when URL changes
  useEffect(() => {
    const detectedProvider = detectProvider(url);
    if (detectedProvider !== provider) {
      setProvider(detectedProvider);
      
      // Reset destination folder when provider changes
      if (detectedProvider === 'google') {
        setDestinationFolder({
          id: "root",
          path: undefined,
          name: "",
          provider: 'google'
        });
      } else if (detectedProvider === 'dropbox') {
        setDestinationFolder({
          id: undefined,
          path: "/",
          name: "",
          provider: 'dropbox'
        });
      } else {
        setDestinationFolder({
          id: undefined,
          path: undefined,
          name: "",
          provider: null
        });
      }
    }
  }, [url, provider]);

  const startCopyMutation = useMutation({
    mutationFn: async (data: { sourceUrl: string; destinationFolder: DestinationFolder; includeSubfolders: boolean }) => {
      const payload: any = {
        sourceUrl: data.sourceUrl,
        includeSubfolders: data.includeSubfolders,
        provider: data.destinationFolder.provider
      };
      
      // Add the appropriate destination field based on provider
      if (data.destinationFolder.provider === 'google') {
        payload.destinationFolderId = data.destinationFolder.id;
      } else if (data.destinationFolder.provider === 'dropbox') {
        payload.destinationPath = data.destinationFolder.path;
      }

      const response = await apiRequest('POST', '/api/copy-operations', payload);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('operations.started'),
        description: t('operations.startedMessage'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/copy-operations"] });
      onOpenChange(false);
      setUrl("");
      setProvider(null);
      setDestinationFolder({
        id: undefined,
        path: undefined,
        name: "",
        provider: null
      });
      setIncludeSubfolders(true);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "No autorizado",
          description: "Iniciando sesión de nuevo...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "No se pudo iniciar la operación de copia. Verifica la URL del Drive.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({
        title: t('errors.validation.urlRequired'),
        description: t('errors.validation.invalidUrl'),
        variant: "destructive",
      });
      return;
    }

    // Validate that we have a supported provider
    if (!provider) {
      toast({
        title: "URL no soportada",
        description: "Por favor ingresa un enlace válido de Google Drive o Dropbox",
        variant: "destructive",
      });
      return;
    }

    // Preparar datos para el preview
    const copyData = {
      sourceUrl: url.trim(),
      destinationFolder,
      includeSubfolders,
    };
    
    setPendingCopyData(copyData);
    setShowPreview(true);
  };

  const handleConfirmCopy = () => {
    if (pendingCopyData) {
      startCopyMutation.mutate(pendingCopyData);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPendingCopyData(null);
  };

  const handleFolderSelect = (folder: DestinationFolder) => {
    setDestinationFolder(folder);
    setShowFolderBrowser(false);
  };

  const handleDestinationChangeFromPreview = (folder: DestinationFolder) => {
    setDestinationFolder(folder);
    if (pendingCopyData) {
      setPendingCopyData({
        ...pendingCopyData,
        destinationFolder: folder
      });
    }
  };

  // Get display labels based on provider
  const getUILabels = () => {
    switch (provider) {
      case 'google':
        return {
          urlLabel: t('quickCopy.googleUrlLabel'),
          urlPlaceholder: t('quickCopy.googleUrlPlaceholder'),
          destinationDefault: t('folderBrowser.myDrive')
        };
      case 'dropbox':
        return {
          urlLabel: t('quickCopy.dropboxUrlLabel'),
          urlPlaceholder: t('quickCopy.dropboxUrlPlaceholder'),
          destinationDefault: t('folderBrowser.myDropbox')
        };
      default:
        return {
          urlLabel: t('quickCopy.urlLabel'),
          urlPlaceholder: t('quickCopy.urlPlaceholder'),
          destinationDefault: t('folderBrowser.selectFolder')
        };
    }
  };

  const uiLabels = getUILabels();

  return (
    <>
      {/* Floating Action Button */}
      <Button
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 z-40"
        size="icon"
        onClick={() => onOpenChange(true)}
        title="Copia Rápida"
        data-testid="button-quick-copy"
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-quick-copy">
          <DialogHeader>
            <DialogTitle>{t('quickCopy.title')}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shared-url">{uiLabels.urlLabel}</Label>
              <Input
                id="shared-url"
                type="url"
                placeholder={uiLabels.urlPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                data-testid="input-shared-url"
              />
              {provider && (
                <p className="text-xs text-muted-foreground">
                  {provider === 'google' ? '📁 Google Drive detectado' : '📦 Dropbox detectado'}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="destination">{t('quickCopy.destinationLabel')}</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFolderBrowser(true)}
                className="w-full justify-start h-10"
                data-testid="button-select-destination"
                disabled={!provider}
              >
                <Folder className="w-4 h-4 mr-2" />
                {!provider 
                  ? uiLabels.destinationDefault
                  : !destinationFolder.name
                  ? uiLabels.destinationDefault
                  : destinationFolder.name
                }
              </Button>
              {!provider && (
                <p className="text-xs text-muted-foreground">
                  Primero ingresa una URL válida para seleccionar carpeta de destino
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-subfolders"
                checked={includeSubfolders}
                onCheckedChange={(checked) => setIncludeSubfolders(checked as boolean)}
                data-testid="checkbox-include-subfolders"
              />
              <Label htmlFor="include-subfolders" className="text-sm">
                {t('quickCopy.includeSubfolders')}
              </Label>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                {t('common:buttons.cancel')}
              </Button>
              <Button 
                type="submit" 
                disabled={startCopyMutation.isPending}
                data-testid="button-preview"
              >
                {startCopyMutation.isPending ? t('quickCopy.starting') : t('quickCopy.preview')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <PreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        sourceUrl={pendingCopyData?.sourceUrl || ""}
        includeSubfolders={pendingCopyData?.includeSubfolders ?? true}
        destinationFolder={pendingCopyData?.destinationFolder || destinationFolder}
        isSubmitting={startCopyMutation.isPending}
        onConfirm={handleConfirmCopy}
        onCancel={handleCancelPreview}
        onDestinationChange={handleDestinationChangeFromPreview}
      />

      {/* Folder Browser Modal */}
      {provider && (
        <FolderBrowserModal
          open={showFolderBrowser}
          onOpenChange={setShowFolderBrowser}
          onSelect={handleFolderSelect}
          provider={provider}
        />
      )}
    </>
  );
}
