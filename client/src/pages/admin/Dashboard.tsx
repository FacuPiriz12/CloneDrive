import { useQuery } from "@tanstack/react-query";
import { Users, Activity, CheckCircle2, XCircle, Clock, TrendingUp, HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const { data: metrics, isLoading } = useQuery<{
    totalUsers: number;
    activeUsers: number;
    totalOperations: number;
    operationsToday: number;
    successRate: number;
    avgDuration: number;
    totalStorage: number;
    operationsByStatus: { status: string; count: number }[];
    operationsByProvider: { provider: string; count: number }[];
  }>({
    queryKey: ['/api/admin/metrics'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando métricas...</div>
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}m ${secs}s`;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="page-admin-dashboard">
      <h1 className="text-3xl font-bold mb-6">Panel de Administración</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6" data-testid="card-total-users">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Usuarios</p>
              <p className="text-3xl font-bold">{metrics?.totalUsers || 0}</p>
            </div>
            <Users className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-6" data-testid="card-active-users">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Usuarios Activos</p>
              <p className="text-3xl font-bold">{metrics?.activeUsers || 0}</p>
            </div>
            <Activity className="w-10 h-10 text-green-500" />
          </div>
        </Card>

        <Card className="p-6" data-testid="card-operations-today">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Operaciones Hoy</p>
              <p className="text-3xl font-bold">{metrics?.operationsToday || 0}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6" data-testid="card-success-rate">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tasa de Éxito</p>
              <p className="text-3xl font-bold">{metrics?.successRate.toFixed(1) || 0}%</p>
            </div>
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6" data-testid="card-total-operations">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Operaciones</p>
              <p className="text-2xl font-bold">{metrics?.totalOperations || 0}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-500" />
          </div>
        </Card>

        <Card className="p-6" data-testid="card-avg-duration">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Duración Promedio</p>
              <p className="text-2xl font-bold">{formatDuration(metrics?.avgDuration || 0)}</p>
            </div>
            <Activity className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6" data-testid="card-total-storage">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Almacenamiento Total</p>
              <p className="text-2xl font-bold">{formatBytes(metrics?.totalStorage || 0)}</p>
            </div>
            <HardDrive className="w-8 h-8 text-indigo-500" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operations by Status */}
        <Card className="p-6" data-testid="chart-operations-status">
          <h2 className="text-xl font-bold mb-4">Operaciones por Estado</h2>
          {metrics && metrics.operationsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={metrics.operationsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {metrics.operationsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </Card>

        {/* Operations by Provider */}
        <Card className="p-6" data-testid="chart-operations-provider">
          <h2 className="text-xl font-bold mb-4">Operaciones por Proveedor</h2>
          {metrics && metrics.operationsByProvider.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metrics.operationsByProvider}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="provider" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Operaciones" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
