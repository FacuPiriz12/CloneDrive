import { Settings, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import GoogleDriveConnection from "@/components/GoogleDriveConnection";
import DropboxConnection from "@/components/DropboxConnection";
import GoogleDriveLogo from "@/components/GoogleDriveLogo";
import DropboxLogo from "@/components/DropboxLogo";
import { useTranslation } from "react-i18next";

export default function Integrations() {
  const { t } = useTranslation(['pages', 'common']);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Settings className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold text-gray-900">Integraciones</h1>
            </div>
            <p className="text-gray-600">
              Conecta tus servicios de almacenamiento en la nube para sincronizar y gestionar tus archivos.
            </p>
          </div>

          {/* Integration Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Google Drive Integration */}
            <Card className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <GoogleDriveLogo className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Google Drive</CardTitle>
                    <p className="text-sm text-gray-500">Almacenamiento en la nube de Google</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                  <p className="text-gray-600 text-sm">
                    Conecta tu cuenta de Google Drive para acceder y sincronizar archivos directamente desde nuestra plataforma.
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Características:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Sincronización automática
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Acceso a carpetas compartidas
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Gestión de permisos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <strong>Soporte máximo:</strong> 5TB por archivo individual
                      </li>
                    </ul>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <GoogleDriveConnection variant="card" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dropbox Integration */}
            <Card className="hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DropboxLogo className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Dropbox</CardTitle>
                    <p className="text-sm text-gray-500">Plataforma de almacenamiento colaborativo</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 flex-1 flex flex-col">
                <div className="space-y-4 flex-1">
                  <p className="text-gray-600 text-sm">
                    Integra tu cuenta de Dropbox para gestionar archivos y colaborar en documentos de forma eficiente.
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">Características:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Colaboración en tiempo real
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Historial de versiones
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Compartir enlaces seguros
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <strong>Soporte máximo:</strong> 350GB por archivo individual
                      </li>
                    </ul>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <DropboxConnection variant="card" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coming Soon - More Integrations */}
            <Card className="border-dashed border-2 border-gray-300 bg-gray-50/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Settings className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-500">Más integraciones</CardTitle>
                    <p className="text-sm text-gray-400">Próximamente disponibles</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  <p className="text-gray-500 text-sm">
                    Estamos trabajando en nuevas integraciones para expandir tus opciones de almacenamiento y colaboración.
                  </p>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-500">Próximamente:</h4>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        OneDrive
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        iCloud
                      </li>
                      <li className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                        Amazon S3
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Integration Status Summary */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-xl">Estado de Integraciones</CardTitle>
              <p className="text-gray-600">Resumen del estado actual de tus conexiones</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Google Drive</span>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-600">Verificando conexión...</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Estado de la conexión con tu cuenta de Google Drive
                  </p>
                </div>
                
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Dropbox</span>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-600">Verificando conexión...</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Estado de la conexión con tu cuenta de Dropbox
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}