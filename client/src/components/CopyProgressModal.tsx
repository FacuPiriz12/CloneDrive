import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { X, Check, Loader2, FileText, Folder, Clock, Zap, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { CopyOperation } from "@shared/schema";

interface CopyProgressModalProps {
  operationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper functions for calculations
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
};

const formatSpeed = (filesPerSecond: number): string => {
  if (filesPerSecond < 1) return `${(filesPerSecond * 60).toFixed(1)} archivos/min`;
  return `${filesPerSecond.toFixed(1)} archivos/s`;
};

export default function CopyProgressModal({ 
  operationId, 
  open, 
  onOpenChange 
}: CopyProgressModalProps) {
  const [transferStats, setTransferStats] = useState({
    speed: 0,
    estimatedTimeRemaining: 0,
    startTime: Date.now()
  });
  
  const previousProgress = useRef<{completedFiles: number, timestamp: number}>({
    completedFiles: 0,
    timestamp: Date.now()
  });

  const { data: operation } = useQuery({
    queryKey: ["/api/copy-operations", operationId],
    enabled: !!operationId && open,
    refetchInterval: operation?.status === 'in_progress' ? 1000 : false,
  });

  // Calculate transfer speed and ETA
  useEffect(() => {
    if (!operation || operation.status !== 'in_progress') return;

    const now = Date.now();
    const currentCompleted = operation.completedFiles || 0;
    const totalFiles = operation.totalFiles || 1;
    
    // Update speed calculation every second
    if (now - previousProgress.current.timestamp >= 1000) {
      const timeDiff = (now - previousProgress.current.timestamp) / 1000;
      const filesDiff = currentCompleted - previousProgress.current.completedFiles;
      const speed = filesDiff / timeDiff;
      
      // Calculate ETA
      const remainingFiles = totalFiles - currentCompleted;
      const eta = speed > 0 ? remainingFiles / speed : 0;
      
      setTransferStats({
        speed,
        estimatedTimeRemaining: eta,
        startTime: transferStats.startTime
      });
      
      previousProgress.current = {
        completedFiles: currentCompleted,
        timestamp: now
      };
    }
  }, [operation, transferStats.startTime]);

  if (!operation) return null;

  const progress = operation.totalFiles 
    ? Math.round((operation.completedFiles / operation.totalFiles) * 100)
    : 0;

  const isCompleted = operation.status === 'completed';
  const isFailed = operation.status === 'failed';
  const isActive = operation.status === 'in_progress';
  const isPending = operation.status === 'pending';

  // Calculate elapsed time for completed operations
  const elapsedTime = operation.duration || 
    (isActive ? (Date.now() - transferStats.startTime) / 1000 : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="modal-copy-progress">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isCompleted && <Check className="w-5 h-5 text-green-500" />}
              {isFailed && <AlertTriangle className="w-5 h-5 text-red-500" />}
              {isActive && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
              {isPending && <Clock className="w-5 h-5 text-yellow-500" />}
              <span>
                {isCompleted ? 'Copia Completada' : 
                 isFailed ? 'Error en la Copia' : 
                 isPending ? 'Copia Pendiente' :
                 'Copiando archivos'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-progress"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Overall Progress */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progreso general</span>
              <span data-testid="text-progress-percentage">{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" data-testid="progress-overall" />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span data-testid="text-progress-status">
                {operation.completedFiles || 0} de {operation.totalFiles || 0} archivos
              </span>
              {isActive && transferStats.speed > 0 && (
                <span data-testid="text-transfer-speed">
                  {formatSpeed(transferStats.speed)}
                </span>
              )}
            </div>
          </div>

          {/* Transfer Stats */}
          {isActive && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Velocidad</p>
                  <p className="text-sm font-medium" data-testid="text-speed-detail">
                    {transferStats.speed > 0 ? formatSpeed(transferStats.speed) : 'Calculando...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo restante</p>
                  <p className="text-sm font-medium" data-testid="text-eta">
                    {transferStats.estimatedTimeRemaining > 0 ? 
                      formatDuration(transferStats.estimatedTimeRemaining) : 
                      'Calculando...'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Completed Stats */}
          {(isCompleted || isFailed) && elapsedTime > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Tiempo total</p>
                  <p className="text-sm font-medium" data-testid="text-elapsed-time">
                    {formatDuration(elapsedTime)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {isCompleted && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center space-x-2 text-green-700 dark:text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">
                  ¡Copia completada exitosamente!
                </span>
              </div>
              {operation.copiedFileUrl && (
                <div className="mt-2">
                  <p className="text-xs text-green-600 dark:text-green-500 mb-1">
                    Archivo copiado disponible en:
                  </p>
                  <a 
                    href={operation.copiedFileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                    data-testid="link-copied-file"
                  >
                    {operation.copiedFileUrl}
                  </a>
                </div>
              )}
            </div>
          )}

          {isFailed && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center space-x-2 text-red-700 dark:text-red-400 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">Error durante la copia</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">{operation.errorMessage}</p>
            </div>
          )}

          {isPending && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-400">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Copia en cola, será procesada pronto
                </span>
              </div>
            </div>
          )}

          {isActive && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">
                  Transfiriendo archivos...
                </span>
              </div>
              {transferStats.speed > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  Procesando a {formatSpeed(transferStats.speed)}
                </p>
              )}
            </div>
          )}

          {/* Source and Destination Info */}
          <div className="space-y-3">
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Folder className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  Origen
                </p>
              </div>
              <p className="text-sm break-all" data-testid="text-source-url">
                {operation.sourceUrl}
              </p>
            </div>
            
            {operation.fileName && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">
                    Archivo/Carpeta
                  </p>
                </div>
                <p className="text-sm" data-testid="text-file-name">
                  {operation.fileName}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              {isActive && (
                <Badge variant="secondary" className="text-xs">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  En progreso
                </Badge>
              )}
              {isPending && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  En cola
                </Badge>
              )}
            </div>
            
            <div className="flex space-x-2">
              {isCompleted && operation.copiedFileUrl && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(operation.copiedFileUrl, '_blank')}
                  data-testid="button-open-file"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Abrir archivo
                </Button>
              )}
              
              <Button 
                variant={isCompleted ? "default" : "outline"} 
                size="sm"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-modal"
              >
                {isCompleted ? 'Perfecto' : 
                 isFailed ? 'Cerrar' : 
                 'Cerrar'}
              </Button>
              
              {isFailed && (
                <Button 
                  size="sm"
                  onClick={() => {
                    // Retry logic could be implemented here
                    onOpenChange(false);
                  }}
                  data-testid="button-retry"
                >
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
