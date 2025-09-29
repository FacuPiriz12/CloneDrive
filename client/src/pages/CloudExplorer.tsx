import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, RefreshCw, Download, History, ArrowRightLeft, Folder, File, Settings, ChevronLeft, Home, ChevronRight, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import GoogleDriveLogo from "@/components/GoogleDriveLogo";
import DropboxLogo from "@/components/DropboxLogo";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

interface CloudAccount {
  id: string;
  provider: 'google' | 'dropbox';
  name: string;
  connected: boolean;
}

interface CloudFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  path?: string;
  isFolder: boolean;
}

interface TransferJob {
  id: string;
  fileName: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  sourceProvider: string;
  targetProvider: string;
  errorMessage?: string;
  copiedFileUrl?: string;
  createdAt: string;
}

interface TransferOptions {
  dedupe: boolean;
  preserveTimestamps: boolean;
  convertGoogleDocs: 'docx' | 'pdf' | 'odt';
}

export default function CloudExplorer() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation(['copy', 'common', 'errors']);
  const [, setLocation] = useLocation();
  const [selectedAccount, setSelectedAccount] = useState<CloudAccount | null>(null);
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [pathHistory, setPathHistory] = useState<Array<{name: string, path: string}>>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [destAccount, setDestAccount] = useState<CloudAccount | null>(null);
  const [transferOptions, setTransferOptions] = useState<TransferOptions>({
    dedupe: true,
    preserveTimestamps: true,
    convertGoogleDocs: 'docx'
  });
  const [jobs, setJobs] = useState<TransferJob[]>([]);

  // Server-Sent Events connection for real-time job updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const eventSource = new EventSource('/api/transfer-jobs/events');
    
    eventSource.onopen = () => {
      console.log('SSE connection established');
    };

    eventSource.addEventListener('connected', (event) => {
      console.log('SSE connected:', JSON.parse(event.data));
    });

    eventSource.addEventListener('progress', (event) => {
      const jobData = JSON.parse(event.data);
      setJobs(prev => prev.map(job => 
        job.id === jobData.jobId 
          ? { ...job, status: 'in_progress', progress: jobData.progressPct }
          : job
      ));
    });

    eventSource.addEventListener('completed', (event) => {
      const jobData = JSON.parse(event.data);
      setJobs(prev => prev.map(job => 
        job.id === jobData.jobId 
          ? { ...job, status: 'completed', progress: 100, copiedFileUrl: jobData.copiedFileUrl }
          : job
      ));
      
      // Show success toast
      toast({
        title: "Transferencia completada",
        description: `${jobData.fileName} transferido exitosamente`,
      });
    });

    eventSource.addEventListener('failed', (event) => {
      const jobData = JSON.parse(event.data);
      setJobs(prev => prev.map(job => 
        job.id === jobData.jobId 
          ? { ...job, status: 'failed', errorMessage: jobData.errorMessage }
          : job
      ));
      
      // Show error toast
      toast({
        title: "Error en transferencia",
        description: jobData.errorMessage || `Error al transferir ${jobData.fileName}`,
        variant: "destructive"
      });
    });

    eventSource.addEventListener('cancelled', (event) => {
      const jobData = JSON.parse(event.data);
      setJobs(prev => prev.map(job => 
        job.id === jobData.jobId 
          ? { ...job, status: 'cancelled' }
          : job
      ));
      
      toast({
        title: "Transferencia cancelada",
        description: `${jobData.fileName} cancelado por el usuario`,
        variant: "destructive"
      });
    });

    eventSource.addEventListener('retry', (event) => {
      const jobData = JSON.parse(event.data);
      setJobs(prev => prev.map(job => 
        job.id === jobData.jobId 
          ? { ...job, status: 'queued' } // Back to queued for retry
          : job
      ));
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
    };
  }, [isAuthenticated, toast]);

  // Get connection status for both providers
  const { data: googleStatus } = useQuery({
    queryKey: ['/api/auth/google/status'],
    enabled: isAuthenticated
  });

  const { data: dropboxStatus } = useQuery({
    queryKey: ['/api/auth/dropbox/status'],
    enabled: isAuthenticated
  });

  // Build accounts list from connection status
  const accounts: CloudAccount[] = [
    {
      id: 'google-drive',
      provider: 'google',
      name: 'Google Drive',
      connected: googleStatus?.connected || false
    },
    {
      id: 'dropbox',
      provider: 'dropbox', 
      name: 'Dropbox',
      connected: dropboxStatus?.connected || false
    }
  ].filter(account => account.connected);

  // Set first connected account as default and reset path
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0]);
    }
  }, [accounts.length]);

  // Reset path when changing account
  useEffect(() => {
    setCurrentPath('');
    setPathHistory([]);
    setSelectedFile(null);
  }, [selectedAccount?.id]);

  // Get files for selected account and current path
  const { data: files = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ['/api/cloud-files', selectedAccount?.id, currentPath],
    queryFn: async () => {
      if (!selectedAccount) return [];
      
      if (selectedAccount.provider === 'google') {
        const response = await apiRequest({
          url: '/api/drive/list-files',
          method: 'POST',
          body: { fileId: currentPath || '' } // Use current path as folderId
        });
        return response.map((file: any) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size ? parseInt(file.size) : undefined,
          path: file.parents?.[0] ? `${currentPath}/${file.name}` : `/${file.name}`,
          isFolder: file.mimeType === 'application/vnd.google-apps.folder'
        }));
      } else if (selectedAccount.provider === 'dropbox') {
        const response = await apiRequest({
          url: `/api/dropbox/files?path=${encodeURIComponent(currentPath)}`,
          method: 'GET'
        });
        return response.map((file: any) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          path: currentPath ? `${currentPath}/${file.name}` : `/${file.name}`,
          // Fixed: Dropbox folders are identified by mimeType
          isFolder: file.mimeType === 'application/vnd.dropbox.folder'
        }));
      }
      return [];
    },
    enabled: !!selectedAccount && isAuthenticated
  });

  // Filter files by search query
  const filteredFiles = files.filter((file: CloudFile) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    refetchFiles();
  };

  const navigateToFolder = (folder: CloudFile) => {
    if (!folder.isFolder) return;
    
    // Add current folder to history  
    const currentLocation = {
      name: folder.name, // Store the folder name we're navigating TO
      path: currentPath
    };
    
    if (selectedAccount?.provider === 'google') {
      setCurrentPath(folder.id); // Google uses fileId
    } else {
      // Dropbox uses path - normalize leading slashes
      const newPath = currentPath ? `${currentPath}/${folder.name}` : `/${folder.name}`;
      setCurrentPath(newPath);
    }
    
    setPathHistory(prev => [...prev, currentLocation]);
    setSelectedFile(null);
  };

  const navigateBack = () => {
    if (pathHistory.length === 0) return;
    
    const previousLocation = pathHistory[pathHistory.length - 1];
    setCurrentPath(previousLocation.path);
    setPathHistory(prev => prev.slice(0, -1));
    setSelectedFile(null);
  };

  const navigateToRoot = () => {
    setCurrentPath('');
    setPathHistory([]);
    setSelectedFile(null);
  };

  const openTransferModal = () => {
    if (!selectedFile) {
      toast({
        title: t('errors:general.error'),
        description: t('copy:select_file_to_transfer'),
        variant: "destructive"
      });
      return;
    }
    
    const availableDestinations = accounts.filter(acc => acc.id !== selectedAccount?.id);
    if (availableDestinations.length > 0) {
      setDestAccount(availableDestinations[0]);
    }
    setTransferOpen(true);
  };

  // Transfer mutation - Now creates async jobs
  const transferMutation = useMutation({
    mutationFn: async ({ sourceProvider, sourceFileId, sourceFilePath, targetProvider, targetPath, fileName }: {
      sourceProvider: string;
      sourceFileId?: string;
      sourceFilePath?: string;
      targetProvider: string;
      targetPath?: string;
      fileName: string;
    }) => {
      return apiRequest({
        url: '/api/transfer-files',
        method: 'POST',
        body: {
          sourceProvider,
          sourceFileId,
          sourceFilePath,
          targetProvider,
          targetPath,
          fileName
        }
      });
    },
    onSuccess: (data) => {
      // New: data contains jobId instead of immediate result
      toast({
        title: "Transferencia iniciada",
        description: `${selectedFile?.name} en cola para transferencia. Revisa el progreso abajo.`,
      });
      setTransferOpen(false);
      
      // Add job to local state for tracking
      if (data.jobId) {
        setJobs(prev => [...prev, {
          id: data.jobId,
          fileName: selectedFile?.name || 'Unknown',
          status: 'queued',
          progress: 0,
          sourceProvider: selectedAccount?.provider || '',
          targetProvider: destAccount?.provider || '',
          createdAt: new Date().toISOString()
        }]);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error iniciando transferencia",
        description: error.message || "No se pudo iniciar la transferencia",
        variant: "destructive"
      });
    }
  });

  const handleTransfer = async () => {
    if (!selectedFile || !destAccount || !selectedAccount) return;

    // Block folder transfers until implemented
    if (selectedFile.isFolder) {
      toast({
        title: "No soportado",
        description: "Las transferencias de carpetas no están soportadas aún. Selecciona un archivo.",
        variant: "destructive"
      });
      return;
    }

    // Check if user has PRO membership using real user data
    const userMembership = user?.membershipPlan || 'free';
    const membershipExpiry = user?.membershipExpiry ? new Date(user.membershipExpiry) : null;
    const isExpired = membershipExpiry && membershipExpiry < new Date();
    
    if (userMembership === 'free' || isExpired) {
      toast({
        title: "Función Premium",
        description: isExpired 
          ? "Tu suscripción PRO ha expirado. ¡Renueva tu plan para continuar!"
          : "Las transferencias entre nubes requieren una suscripción PRO. ¡Actualiza tu plan!",
        variant: "destructive"
      });
      return;
    }

    // Prepare transfer parameters
    const sourceProvider = selectedAccount.provider;
    const targetProvider = destAccount.provider;
    
    let sourceFileId: string | undefined;
    let sourceFilePath: string | undefined;
    
    if (sourceProvider === 'google') {
      sourceFileId = selectedFile.id;
    } else {
      sourceFilePath = selectedFile.path || (currentPath ? `${currentPath}/${selectedFile.name}` : `/${selectedFile.name}`);
    }

    transferMutation.mutate({
      sourceProvider,
      sourceFileId,
      sourceFilePath,
      targetProvider,
      targetPath: '', // Root path for now
      fileName: selectedFile.name
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  const renderProviderLogo = (provider: string) => {
    switch (provider) {
      case 'google':
        return <GoogleDriveLogo className="w-5 h-5" />;
      case 'dropbox':
        return <DropboxLogo className="w-5 h-5" />;
      default:
        return <Settings className="w-5 h-5" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-96">
            <CardContent className="pt-6">
              <p className="text-center text-gray-600">
                Debes iniciar sesión para acceder al explorador multinube.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-cloud-explorer">
      <Header />
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <ArrowRightLeft className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold text-gray-900">Explorador Multi-nube</h1>
            </div>
            <p className="text-gray-600">
              Visualiza y transfiere archivos entre tus servicios de almacenamiento en la nube.
            </p>
          </div>

          {/* No connections message */}
          {accounts.length === 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No hay conexiones activas
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Conecta tus servicios de almacenamiento para comenzar a usar el explorador.
                  </p>
                  <Button onClick={() => setLocation('/integrations')} data-testid="button-manage-integrations">
                    Administrar Integraciones
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Explorer Grid */}
          {accounts.length > 0 && (
            <div className="grid grid-cols-12 gap-6">
              {/* Accounts Sidebar */}
              <aside className="col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Conexiones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {accounts.map(account => (
                        <div
                          key={account.id}
                          className={`p-3 rounded-md cursor-pointer transition-colors ${
                            selectedAccount?.id === account.id 
                              ? 'bg-primary/10 border border-primary/20' 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedAccount(account)}
                          data-testid={`account-${account.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {renderProviderLogo(account.provider)}
                              <div>
                                <div className="font-medium text-sm">{account.name}</div>
                                <div className="text-xs text-gray-500 capitalize">{account.provider}</div>
                              </div>
                            </div>
                            <Badge variant={account.connected ? "default" : "secondary"} className="text-xs">
                              {account.connected ? 'Conectado' : 'Desconectado'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => setLocation('/integrations')}
                      data-testid="button-manage-connections"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Administrar
                    </Button>
                  </CardContent>
                </Card>
              </aside>

              {/* File Explorer */}
              <div className="col-span-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {selectedAccount ? selectedAccount.name : 'Selecciona una cuenta'}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                          <Input
                            placeholder="Buscar archivos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 w-64"
                            data-testid="input-search"
                          />
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Navigation Breadcrumbs */}
                    <div className="flex items-center gap-2 mt-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={navigateToRoot}
                        disabled={currentPath === ''}
                        data-testid="button-home"
                      >
                        <Home className="w-4 h-4" />
                      </Button>
                      
                      {pathHistory.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={navigateBack}
                          data-testid="button-back"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Atrás
                        </Button>
                      )}
                      
                      <div className="flex items-center text-sm text-gray-600">
                        <span className={currentPath === '' ? 'font-medium' : ''}>Raíz</span>
                        {pathHistory.map((location, index) => (
                          <div key={index} className="flex items-center">
                            <ChevronRight className="w-3 h-3 mx-1" />
                            <span className={index === pathHistory.length - 1 ? 'font-medium' : ''}>
                              {location.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="min-h-[400px] max-h-[500px] overflow-auto">
                      {filesLoading && (
                        <div className="text-center py-8 text-gray-500">
                          Cargando archivos...
                        </div>
                      )}
                      
                      {!filesLoading && filteredFiles.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          {searchQuery ? 'No se encontraron archivos' : 'No hay archivos'}
                        </div>
                      )}

                      <div className="space-y-1">
                        {filteredFiles.map((file: CloudFile) => (
                          <div
                            key={file.id}
                            className={`p-3 rounded-md cursor-pointer transition-colors ${
                              selectedFile?.id === file.id 
                                ? 'bg-primary/10 border border-primary/20' 
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedFile(file)}
                            onDoubleClick={() => file.isFolder && navigateToFolder(file)}
                            data-testid={`file-${file.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {file.isFolder ? (
                                  <Folder className="w-5 h-5 text-blue-500" />
                                ) : (
                                  <File className="w-5 h-5 text-gray-500" />
                                )}
                                <div>
                                  <div className="font-medium text-sm">{file.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {file.isFolder ? 'Carpeta' : file.mimeType}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-400">
                                {formatFileSize(file.size)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="flex gap-2">
                      {selectedFile?.isFolder ? (
                        <Button 
                          onClick={() => navigateToFolder(selectedFile)} 
                          data-testid="button-open-folder"
                        >
                          <Folder className="w-4 h-4 mr-2" />
                          Abrir Carpeta
                        </Button>
                      ) : null}
                      
                      <Button 
                        onClick={openTransferModal} 
                        disabled={!selectedFile}
                        data-testid="button-transfer"
                      >
                        <ArrowRightLeft className="w-4 h-4 mr-2" />
                        Transferir
                      </Button>
                      <Button variant="outline" disabled={!selectedFile} data-testid="button-download">
                        <Download className="w-4 h-4 mr-2" />
                        Descargar
                      </Button>
                      <Button variant="outline" data-testid="button-history">
                        <History className="w-4 h-4 mr-2" />
                        Historial
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview Panel */}
              <aside className="col-span-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Vista Previa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedFile ? (
                      <div className="text-sm text-gray-500">
                        Selecciona un archivo para ver los detalles.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium text-sm mb-2">{selectedFile.name}</h4>
                          <div className="text-xs text-gray-500 space-y-1">
                            <div>Tipo: {selectedFile.isFolder ? 'Carpeta' : selectedFile.mimeType}</div>
                            <div>Ruta: {selectedFile.path}</div>
                            {selectedFile.size && (
                              <div>Tamaño: {formatFileSize(selectedFile.size)}</div>
                            )}
                          </div>
                        </div>

                        <Separator />

                        <div>
                          <h5 className="font-medium text-sm mb-2">Opciones</h5>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>• Descargar</div>
                            <div>• Ver historial</div>
                            <div>• Buscar duplicados</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <Separator className="my-4" />

                    <div>
                      <h5 className="font-medium text-sm mb-2">Transferencias Activas</h5>
                      {jobs.length === 0 ? (
                        <div className="text-xs text-gray-500">Sin transferencias activas.</div>
                      ) : (
                        <div className="space-y-3">
                          {jobs.slice(0, 5).map(job => (
                            <div key={job.id} className="p-3 border rounded-md bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium truncate">{job.fileName}</span>
                                <Badge 
                                  variant={
                                    job.status === 'completed' ? 'default' :
                                    job.status === 'failed' || job.status === 'cancelled' ? 'destructive' :
                                    job.status === 'in_progress' ? 'secondary' : 'outline'
                                  } 
                                  className="text-xs"
                                >
                                  {job.status === 'in_progress' ? 'En progreso' :
                                   job.status === 'completed' ? 'Completado' :
                                   job.status === 'failed' ? 'Error' :
                                   job.status === 'cancelled' ? 'Cancelado' :
                                   'En cola'}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                                {renderProviderLogo(job.sourceProvider)}
                                <ArrowRight className="w-3 h-3" />
                                {renderProviderLogo(job.targetProvider)}
                              </div>
                              
                              {(job.status === 'in_progress' || job.status === 'queued') && (
                                <div className="space-y-1">
                                  <Progress value={job.progress} className="h-2" />
                                  <div className="text-xs text-gray-500">{job.progress}%</div>
                                </div>
                              )}
                              
                              {job.status === 'failed' && job.errorMessage && (
                                <div className="text-xs text-red-600 mt-1">
                                  {job.errorMessage}
                                </div>
                              )}
                              
                              {job.status === 'completed' && job.copiedFileUrl && (
                                <div className="mt-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-6 text-xs"
                                    onClick={() => window.open(job.copiedFileUrl, '_blank')}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    Ver archivo
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </aside>
            </div>
          )}

          {/* Transfer Modal */}
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Transferir Archivo</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    {selectedFile ? `Transferir: ${selectedFile.name}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Origen</label>
                    <div className="p-3 border rounded-md bg-gray-50">
                      <div className="flex items-center gap-2">
                        {selectedAccount && renderProviderLogo(selectedAccount.provider)}
                        <span className="text-sm">{selectedAccount?.name}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Destino</label>
                    <Select
                      value={destAccount?.id || ''}
                      onValueChange={(value) => setDestAccount(accounts.find(a => a.id === value) || null)}
                    >
                      <SelectTrigger data-testid="select-destination">
                        <SelectValue placeholder="Selecciona destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts
                          .filter(acc => acc.id !== selectedAccount?.id)
                          .map(account => (
                            <SelectItem key={account.id} value={account.id}>
                              <div className="flex items-center gap-2">
                                {renderProviderLogo(account.provider)}
                                <span>{account.name}</span>
                              </div>
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Opciones</label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="dedupe"
                        checked={transferOptions.dedupe}
                        onCheckedChange={(checked) => 
                          setTransferOptions(prev => ({ ...prev, dedupe: checked as boolean }))
                        }
                      />
                      <label htmlFor="dedupe" className="text-sm">Omitir duplicados</label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="preserveTimestamps"
                        checked={transferOptions.preserveTimestamps}
                        onCheckedChange={(checked) => 
                          setTransferOptions(prev => ({ ...prev, preserveTimestamps: checked as boolean }))
                        }
                      />
                      <label htmlFor="preserveTimestamps" className="text-sm">Conservar fechas originales</label>
                    </div>
                    
                    <div>
                      <label className="block text-sm mb-1">Convertir documentos de Google:</label>
                      <Select
                        value={transferOptions.convertGoogleDocs}
                        onValueChange={(value: 'docx' | 'pdf' | 'odt') => 
                          setTransferOptions(prev => ({ ...prev, convertGoogleDocs: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="docx">Microsoft Word (.docx)</SelectItem>
                          <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                          <SelectItem value="odt">OpenDocument (.odt)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setTransferOpen(false)} data-testid="button-cancel-transfer">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleTransfer} 
                    disabled={!destAccount || transferMutation.isPending} 
                    data-testid="button-start-transfer"
                  >
                    {transferMutation.isPending ? 'Transfiriendo...' : 'Iniciar Transferencia'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}