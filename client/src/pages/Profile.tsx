import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import type { CopyOperation, DriveFile } from "@shared/schema";
import Header from "@/components/Header";
import { useLocation } from "wouter";
import { 
  User, 
  Mail, 
  Calendar, 
  Activity, 
  FileText, 
  Download, 
  Settings,
  Shield,
  Clock,
  HardDrive,
  Network
} from "lucide-react";
import GoogleDriveLogo from "@/components/GoogleDriveLogo";
import DropboxLogo from "@/components/DropboxLogo";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  // Fetch user statistics
  const { data: operations, isLoading: statsLoading } = useQuery<CopyOperation[]>({
    queryKey: ['/api/copy-operations'],
    enabled: !!user
  });

  const { data: filesData, isLoading: filesLoading } = useQuery<{files: DriveFile[], total: number, totalPages: number}>({
    queryKey: ['/api/drive-files'],
    enabled: !!user
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  const goToSettings = () => {
    setLocation('/settings');
  };

  // Calculate some basic stats
  const totalOperations = operations?.length || 0;
  const completedOperations = operations?.filter(op => op.status === 'completed')?.length || 0;
  const successRate = totalOperations > 0 ? Math.round((completedOperations / totalOperations) * 100) : 0;
  const totalFiles = filesData?.total || 0;

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto py-8 px-4 max-w-6xl pt-20 relative z-0">
        <div className="grid gap-6">
          {/* Profile Header */}
          <Card data-testid="card-profile-header">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <Avatar className="h-24 w-24" data-testid="avatar-profile">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary text-white text-2xl">
                    {user.firstName?.[0] || user.email?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground" data-testid="text-profile-name">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}`
                        : user.email?.split('@')[0] || 'Usuario'
                      }
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                      <Mail className="h-4 w-4" />
                      <span data-testid="text-profile-email">{user.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                      <Calendar className="h-4 w-4" />
                      <span data-testid="text-profile-joined">
                        Miembro desde {user.createdAt ? formatDate(user.createdAt) : 'hace tiempo'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {user.googleConnected && (
                      <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
                        Google Drive
                      </Badge>
                    )}
                    {user.dropboxConnected && (
                      <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                        <div className="w-3 h-3 bg-blue-700 rounded-full mr-2" />
                        Dropbox
                      </Badge>
                    )}
                    {!user.googleConnected && !user.dropboxConnected && (
                      <Badge variant="outline" className="text-gray-500">
                        Sin servicios conectados
                      </Badge>
                    )}
                  </div>
                </div>
                
                <Button onClick={goToSettings} data-testid="button-edit-profile">
                  <Settings className="h-4 w-4 mr-2" />
                  Editar Perfil
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Statistics Cards */}
            <div className="lg:col-span-2 space-y-6">
              {/* Activity Overview */}
              <Card data-testid="card-activity-overview">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Resumen de Actividad
                  </CardTitle>
                  <CardDescription>
                    Tu actividad reciente en CloneDrive
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading || filesLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="text-center p-4 bg-muted/50 rounded-lg animate-pulse">
                          <div className="h-8 bg-muted rounded mb-2"></div>
                          <div className="h-4 bg-muted rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary" data-testid="text-total-operations">
                          {totalOperations}
                        </div>
                        <div className="text-sm text-muted-foreground">Operaciones Totales</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600" data-testid="text-completed-operations">
                          {completedOperations}
                        </div>
                        <div className="text-sm text-muted-foreground">Completadas</div>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600" data-testid="text-total-files">
                          {totalFiles}
                        </div>
                        <div className="text-sm text-muted-foreground">Archivos Copiados</div>
                      </div>
                    </div>
                  )}
                  
                  {totalOperations > 0 && (
                    <div className="mt-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Tasa de Éxito</span>
                        <span data-testid="text-success-rate">{successRate}%</span>
                      </div>
                      <Progress value={successRate} className="h-2" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card data-testid="card-recent-activity">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>
                    Tus operaciones más recientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statsLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                          <div className="w-4 h-4 bg-muted rounded-full" />
                          <div className="h-4 bg-muted rounded flex-1" />
                        </div>
                      ))}
                    </div>
                  ) : operations && operations.length > 0 ? (
                    <div className="space-y-3">
                      {operations.slice(0, 5).map((operation) => (
                        <div key={operation.id} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`activity-item-${operation.id}`}>
                          <div className={`w-3 h-3 rounded-full ${
                            operation.status === 'completed' ? 'bg-green-500' :
                            operation.status === 'failed' ? 'bg-red-500' :
                            operation.status === 'in_progress' ? 'bg-blue-500' :
                            'bg-gray-400'
                          }`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {operation.copiedFileName || 'Operación de copia'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(operation.createdAt)} - {operation.status === 'completed' ? 'Completado' : 
                               operation.status === 'failed' ? 'Falló' :
                               operation.status === 'in_progress' ? 'En progreso' : operation.status}
                            </p>
                          </div>
                          {operation.totalFiles && (
                            <Badge variant="outline" className="text-xs">
                              {operation.completedFiles || 0}/{operation.totalFiles} archivos
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No hay actividad reciente</p>
                      <p className="text-sm">Comienza copiando algunos archivos para ver tu actividad aquí</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Account Info */}
              <Card data-testid="card-account-info">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Información de Cuenta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-1">ID de Usuario</div>
                    <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded" data-testid="text-user-id">
                      {user.id}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium mb-1">Estado de la Cuenta</div>
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                      Activa
                    </Badge>
                  </div>
                  
                  {user.updatedAt && (
                    <div>
                      <div className="text-sm font-medium mb-1">Última Actualización</div>
                      <div className="text-sm text-muted-foreground" data-testid="text-last-updated">
                        {formatDate(user.updatedAt)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Connected Services */}
              <Card data-testid="card-connected-services">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Servicios Conectados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-white border">
                        <GoogleDriveLogo className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Google Drive</div>
                        <div className="text-xs text-muted-foreground">
                          {user.googleConnected ? 'Conectado' : 'No conectado'}
                        </div>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${user.googleConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-white border">
                        <DropboxLogo className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Dropbox</div>
                        <div className="text-xs text-muted-foreground">
                          {user.dropboxConnected ? 'Conectado' : 'No conectado'}
                        </div>
                      </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${user.dropboxConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card data-testid="card-quick-actions">
                <CardHeader>
                  <CardTitle>Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={() => setLocation('/operations')}
                    data-testid="button-view-operations"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Ver Operaciones
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={() => setLocation('/my-files')}
                    data-testid="button-view-files"
                  >
                    <HardDrive className="h-4 w-4 mr-2" />
                    Mis Archivos
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={() => setLocation('/integrations')}
                    data-testid="button-manage-integrations"
                  >
                    <Network className="h-4 w-4 mr-2" />
                    Gestionar Integraciones
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}