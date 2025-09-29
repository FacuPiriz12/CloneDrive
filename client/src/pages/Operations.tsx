import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Clock, CheckCircle, XCircle, Loader2, Calendar, Files, Timer, ExternalLink, Eye, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import CopyProgressModal from "@/components/CopyProgressModal";
import type { CopyOperation } from "@shared/schema";

export default function Operations() {
  const { t } = useTranslation(['pages', 'common']);
  const queryClient = useQueryClient();
  const prevCompletedCount = useRef<number>(0);
  const [selectedOperation, setSelectedOperation] = useState<string | undefined>();
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  
  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["/api/copy-operations"],
    refetchInterval: 5000,
  });

  // Track completed operations to invalidate drive-files cache
  useEffect(() => {
    const completedOps = operations.filter((op: CopyOperation) => op.status === 'completed');
    if (completedOps.length > prevCompletedCount.current) {
      console.log('✅ New operations completed, invalidating drive-files cache');
      queryClient.invalidateQueries({ queryKey: ["/api/drive-files"] });
    }
    prevCompletedCount.current = completedOps.length;
  }, [operations, queryClient]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('common:status.completed');
      case 'failed':
        return t('operations.error');
      case 'in_progress':
        return t('common:status.inProgress');
      case 'pending':
        return t('common:status.pending');
      default:
        return t('operations.error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (startDate: string, endDate?: string) => {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-operations">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="mb-6">
            <h1 className="text-[1.5rem] font-semibold text-foreground mb-2">{t('operations.title')}</h1>
            <p className="text-muted-foreground">
              {t('operations.description')}
            </p>
          </div>

          {operations.length === 0 ? (
            <Card className="bg-white rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Files className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {t('operations.noOperations')}
                </h3>
                <p className="text-muted-foreground text-center">
                  {t('operations.operationsWillAppear')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {operations.map((operation: CopyOperation) => (
                <Card key={operation.id} className="bg-white rounded-[10px] shadow-[0_2px_10px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow" data-testid={`operation-${operation.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center space-x-2">
                        {getStatusIcon(operation.status)}
                        <span>{t('operations.copyOperation')}</span>
                      </CardTitle>
                      <Badge className={getStatusColor(operation.status)}>
                        {getStatusText(operation.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t('operations.date')}</p>
                          <p className="text-sm font-medium">
                            {formatDate(operation.createdAt!)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Files className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t('pages:myFiles.files')}</p>
                          <p className="text-sm font-medium">
                            {operation.completedFiles || 0} / {operation.totalFiles || 0}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Timer className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t('operations.duration')}</p>
                          <p className="text-sm font-medium">
                            {calculateDuration(operation.createdAt!, operation.updatedAt)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                        <div>
                          <p className="text-xs text-muted-foreground">{t('operations.state')}</p>
                          <p className="text-sm font-medium">
                            {operation.status === 'completed' ? 'Exitoso' : 
                             operation.status === 'in_progress' ? 'En curso' : 
                             operation.status === 'failed' ? 'Error' : 'Pendiente'}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {operation.sourceUrl && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">URL de origen:</p>
                        <p className="text-sm font-mono break-all">
                          {operation.sourceUrl}
                        </p>
                      </div>
                    )}
                    
                    {operation.errorMessage && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-xs text-red-600 dark:text-red-400 mb-1">Error:</p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          {operation.errorMessage}
                        </p>
                      </div>
                    )}

                    {operation.status === 'completed' && operation.copiedFileUrl && (
                      <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                Copia completada exitosamente
                              </p>
                            </div>
                            {operation.copiedFileName && (
                              <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                                Archivo copiado: <span className="font-medium">{operation.copiedFileName}</span>
                              </p>
                            )}
                            <p className="text-xs text-green-600 dark:text-green-400">
                              Enlace a la carpeta copiada en tu Drive:
                            </p>
                          </div>
                        </div>
                        <a
                          href={operation.copiedFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm font-medium"
                          data-testid={`link-copied-file-${operation.id}`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Abrir en Google Drive</span>
                        </a>
                      </div>
                    )}

                    {/* Progress Bar for Active Operations */}
                    {operation.status === 'in_progress' && operation.totalFiles && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progreso de transferencia</span>
                          <span className="font-medium">
                            {Math.round(((operation.completedFiles || 0) / operation.totalFiles) * 100)}%
                          </span>
                        </div>
                        <Progress 
                          value={((operation.completedFiles || 0) / operation.totalFiles) * 100}
                          className="h-2"
                          data-testid={`progress-${operation.id}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{operation.completedFiles || 0} de {operation.totalFiles} archivos</span>
                          <div className="flex items-center space-x-1">
                            <Zap className="w-3 h-3" />
                            <span>En progreso</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-4 flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOperation(operation.id);
                          setProgressModalOpen(true);
                        }}
                        data-testid={`button-view-details-${operation.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver detalles
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
      
      {/* Progress Modal */}
      <CopyProgressModal
        operationId={selectedOperation}
        open={progressModalOpen}
        onOpenChange={setProgressModalOpen}
      />
    </div>
  );
}