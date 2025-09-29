import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Folder, 
  ArrowLeft,
  Home,
  Loader2
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface DriveFolder {
  id: string;
  name: string;
  parents?: string[];
}

interface DropboxFolder {
  id: string; // This will be the path for Dropbox
  name: string;
  mimeType?: string;
}

type Folder = DriveFolder | DropboxFolder;

interface FolderPath {
  id?: string;    // For Google Drive
  path?: string;  // For Dropbox
  name: string;
}

type Provider = 'google' | 'dropbox';

interface FolderBrowserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider;
  initialParentId?: string;
  onSelect: (folder: { id?: string; path?: string; name: string; provider: Provider }) => void;
}

export default function FolderBrowserModal({ 
  open, 
  onOpenChange, 
  provider,
  initialParentId,
  onSelect 
}: FolderBrowserModalProps) {
  // Set default initial parent based on provider
  const getDefaultParent = (provider: Provider) => {
    return provider === 'google' ? 'root' : '/';
  };

  const [currentParentId, setCurrentParentId] = useState(initialParentId || getDefaultParent(provider));
  const { toast } = useToast();

  // Reset to initial parent when modal opens with new initialParentId or provider
  useEffect(() => {
    if (open) {
      setCurrentParentId(initialParentId || getDefaultParent(provider));
    }
  }, [open, initialParentId, provider]);

  // Fetch folders in current directory
  const { 
    data: foldersData, 
    isLoading: isLoadingFolders, 
    error: foldersError,
    refetch: refetchFolders 
  } = useQuery({
    queryKey: [provider === 'google' ? "/api/drive/folders" : "/api/dropbox/folders", currentParentId, provider],
    queryFn: async ({ queryKey }) => {
      const [endpoint, currentId, currentProvider] = queryKey;
      
      if (currentProvider === 'google') {
        const response = await apiRequest('GET', `/api/drive/folders?parentId=${currentId}`);
        return response.json() as Promise<{ folders: DriveFolder[]; nextPageToken?: string }>;
      } else {
        const response = await apiRequest('GET', `/api/dropbox/folders?path=${encodeURIComponent(currentId as string)}`);
        return response.json() as Promise<{ folders: DropboxFolder[]; nextCursor?: string }>;
      }
    },
    enabled: open,
    retry: false
  });

  // Fetch breadcrumb path
  const { 
    data: pathData, 
    isLoading: isLoadingPath 
  } = useQuery({
    queryKey: [provider === 'google' ? "/api/drive/folders" : "/api/dropbox/folders", currentParentId, "path", provider],
    queryFn: async ({ queryKey }) => {
      const [endpoint, currentId, , currentProvider] = queryKey;
      
      if (currentProvider === 'google') {
        const response = await apiRequest('GET', `/api/drive/folders/${currentId}/path`);
        return response.json() as Promise<{ path: FolderPath[] }>;
      } else {
        const response = await apiRequest('GET', `/api/dropbox/folders/path?path=${encodeURIComponent(currentId as string)}`);
        return response.json() as Promise<{ path: FolderPath[] }>;
      }
    },
    enabled: open && ((provider === 'google' && currentParentId !== 'root') || (provider === 'dropbox' && currentParentId !== '/')),
    retry: false
  });

  const isLoading = isLoadingFolders || isLoadingPath;
  const folders = foldersData?.folders || [];
  
  // Build breadcrumb path based on provider
  const breadcrumbPath = (() => {
    if (provider === 'google') {
      return currentParentId === 'root' 
        ? [{ id: 'root', name: 'Mi Drive' }] 
        : pathData?.path || [];
    } else {
      return currentParentId === '/' 
        ? [{ path: '/', name: 'Mi Dropbox' }] 
        : pathData?.path || [];
    }
  })();

  const handleFolderClick = (folderId: string) => {
    setCurrentParentId(folderId);
  };

  const handleBreadcrumbClick = (item: FolderPath) => {
    if (provider === 'google' && item.id) {
      setCurrentParentId(item.id);
    } else if (provider === 'dropbox' && item.path) {
      setCurrentParentId(item.path);
    }
  };

  const handleSelectCurrentFolder = () => {
    const currentFolder = breadcrumbPath[breadcrumbPath.length - 1];
    if (currentFolder) {
      if (provider === 'google') {
        onSelect({
          id: currentFolder.id,
          name: currentFolder.name,
          provider: 'google'
        });
      } else {
        onSelect({
          path: currentFolder.path,
          name: currentFolder.name,
          provider: 'dropbox'
        });
      }
      onOpenChange(false);
    }
  };

  const handleGoBack = () => {
    if (breadcrumbPath.length > 1) {
      const parentFolder = breadcrumbPath[breadcrumbPath.length - 2];
      if (provider === 'google' && parentFolder.id) {
        setCurrentParentId(parentFolder.id);
      } else if (provider === 'dropbox' && parentFolder.path) {
        setCurrentParentId(parentFolder.path);
      }
    }
  };

  // Handle errors
  if (foldersError) {
    if (isUnauthorizedError(foldersError)) {
      toast({
        title: "No autorizado",
        description: "Iniciando sesión de nuevo...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return null;
    }

    const errorMessage = foldersError instanceof Error ? foldersError.message : 'Error desconocido';
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-folder-browser-error">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-red-500" />
              Error al cargar carpetas
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300" data-testid="text-error-message">
                {errorMessage}
              </p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-close-error"
              >
                Cerrar
              </Button>
              <Button 
                onClick={() => refetchFolders()}
                data-testid="button-retry-folders"
              >
                Reintentar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]" data-testid="dialog-folder-browser">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-600" />
            Seleccionar Carpeta de Destino
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Breadcrumb data-testid="breadcrumb-path">
              <BreadcrumbList>
                {breadcrumbPath.map((item, index) => {
                  const itemKey = provider === 'google' ? item.id : item.path;
                  return (
                    <BreadcrumbItem key={itemKey}>
                      {index === breadcrumbPath.length - 1 ? (
                        <BreadcrumbPage className="flex items-center gap-1">
                          {index === 0 && <Home className="w-4 h-4" />}
                          <span data-testid={`breadcrumb-current-${itemKey}`}>
                            {item.name}
                          </span>
                        </BreadcrumbPage>
                      ) : (
                        <>
                          <BreadcrumbLink
                            onClick={() => handleBreadcrumbClick(item)}
                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600"
                            data-testid={`breadcrumb-link-${itemKey}`}
                          >
                            {index === 0 && <Home className="w-4 h-4" />}
                            {item.name}
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      )}
                    </BreadcrumbItem>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleGoBack}
              disabled={breadcrumbPath.length <= 1}
              className="flex items-center gap-2"
              data-testid="button-go-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>

            <Button
              onClick={handleSelectCurrentFolder}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-select-current"
            >
              Seleccionar esta carpeta
            </Button>
          </div>

          {/* Folders list */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    <p className="text-sm text-muted-foreground" data-testid="text-loading-folders">
                      Cargando carpetas...
                    </p>
                  </div>
                </div>
              ) : folders.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground" data-testid="text-no-folders">
                    No hay subcarpetas en esta ubicación
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => handleFolderClick(folder.id)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                      data-testid={`folder-item-${folder.id.replace(/[\/\\:*?"<>|]/g, '-')}`}
                    >
                      <Folder className="w-5 h-5 text-yellow-600" />
                      <span className="flex-1 text-sm font-medium">
                        {folder.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-selection"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}