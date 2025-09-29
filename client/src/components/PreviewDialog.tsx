import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Folder, 
  Clock, 
  HardDrive, 
  Files,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FolderBrowserModal from "./FolderBrowserModal";

interface OperationPreview {
  name: string;
  type: 'file' | 'folder';
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  estimatedDurationSeconds: number;
  fileTypes: { [key: string]: number };
  structure: {
    name: string;
    type: 'file' | 'folder';
    size?: number;
    children?: any[];
  };
}

type Provider = 'google' | 'dropbox';

interface DestinationFolder {
  id?: string;
  path?: string;
  name: string;
  provider: Provider | null;
}

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceUrl: string;
  includeSubfolders: boolean;
  destinationFolder: DestinationFolder;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onDestinationChange?: (folder: DestinationFolder) => void;
}

export default function PreviewDialog({ 
  open, 
  onOpenChange, 
  sourceUrl, 
  includeSubfolders,
  destinationFolder,
  isSubmitting = false,
  onConfirm, 
  onCancel,
  onDestinationChange
}: PreviewDialogProps) {
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch preview data
  const { 
    data: preview, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ["/api/copy-operations/preview", sourceUrl, includeSubfolders],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/copy-operations/preview', {
        sourceUrl,
        includeSubfolders
      });
      return response.json() as Promise<OperationPreview>;
    },
    enabled: open && !!sourceUrl,
    retry: false
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds} segundos`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutos`;
    return `${Math.ceil(seconds / 3600)} horas`;
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleFolderSelect = (folder: { id?: string; path?: string; name: string; provider: Provider }) => {
    if (onDestinationChange) {
      onDestinationChange(folder);
    }
    setShowFolderBrowser(false);
  };

  if (error) {
    // Handle unauthorized errors by redirecting to login
    if (isUnauthorizedError(error)) {
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

    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-preview-error">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Error al obtener vista previa
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
                onClick={handleCancel}
                data-testid="button-cancel-error"
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => refetch()}
                data-testid="button-retry"
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
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {preview?.type === 'folder' ? (
              <Folder className="w-5 h-5 text-yellow-600" />
            ) : (
              <FileText className="w-5 h-5 text-blue-600" />
            )}
            Vista Previa de Copia
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
              <p className="text-sm text-muted-foreground" data-testid="text-loading">
                Analizando archivos y carpetas...
              </p>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-6">
            {/* Información general */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  {preview.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Files className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                    <div className="font-semibold text-lg" data-testid="text-total-files">
                      {preview.totalFiles}
                    </div>
                    <div className="text-xs text-muted-foreground">Archivos</div>
                  </div>
                  
                  {preview.totalFolders > 0 && (
                    <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <Folder className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
                      <div className="font-semibold text-lg" data-testid="text-total-folders">
                        {preview.totalFolders}
                      </div>
                      <div className="text-xs text-muted-foreground">Carpetas</div>
                    </div>
                  )}
                  
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <HardDrive className="w-6 h-6 mx-auto mb-2 text-green-600" />
                    <div className="font-semibold text-lg" data-testid="text-total-size">
                      {formatFileSize(preview.totalSize)}
                    </div>
                    <div className="text-xs text-muted-foreground">Tamaño Total</div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                    <div className="font-semibold text-lg" data-testid="text-estimated-duration">
                      {formatDuration(preview.estimatedDurationSeconds)}
                    </div>
                    <div className="text-xs text-muted-foreground">Tiempo Estimado</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tipos de archivos */}
            {Object.keys(preview.fileTypes).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tipos de archivos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preview.fileTypes).map(([type, count]) => (
                      <Badge 
                        key={type} 
                        variant="secondary" 
                        className="text-xs"
                        data-testid={`badge-filetype-${type}`}
                      >
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Destino de copia */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-green-600" />
                    Destino de copia
                  </div>
                  {onDestinationChange && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFolderBrowser(true)}
                      className="flex items-center gap-2"
                      data-testid="button-change-destination"
                    >
                      <Edit2 className="w-4 h-4" />
                      Cambiar
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <Folder className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200" data-testid="text-destination-folder">
                      {destinationFolder.name}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Los archivos se copiarán a esta carpeta
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advertencias */}
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Información importante
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• Los archivos se copiarán a tu Google Drive personal</li>
                    <li>• El tiempo estimado puede variar según el tamaño y la conexión</li>
                    <li>• Recibirás una notificación por email al completarse</li>
                    {preview.totalSize > 100 * 1024 * 1024 && (
                      <li className="font-medium">• Copia de gran tamaño - puede tomar tiempo considerable</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                data-testid="button-cancel-preview"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-confirm-copy"
              >
                {isSubmitting ? "Iniciando copia..." : "Confirmar y Copiar"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
      
      {/* Folder Browser Modal */}
      {onDestinationChange && destinationFolder.provider && (
        <FolderBrowserModal
          open={showFolderBrowser}
          onOpenChange={setShowFolderBrowser}
          provider={destinationFolder.provider}
          initialParentId={destinationFolder.provider === 'google' 
            ? (destinationFolder.id !== 'root' ? destinationFolder.id : 'root')
            : (destinationFolder.path !== '/' ? destinationFolder.path : '/')}
          onSelect={handleFolderSelect}
        />
      )}
    </Dialog>
  );
}