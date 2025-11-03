import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CopyOperation } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Filter, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function AdminOperations() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    userId: '',
    status: '',
    provider: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    operations: CopyOperation[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ['/api/admin/operations', filters, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.provider && { provider: filters.provider }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });
      const response = await fetch(`/api/admin/operations?${params}`);
      if (!response.ok) throw new Error('Failed to fetch operations');
      return response.json();
    },
  });

  const retryOperationMutation = useMutation({
    mutationFn: async (operationId: string) => {
      return await apiRequest(`/api/admin/operations/${operationId}/retry`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/operations'] });
      toast({
        title: "Operación reintentada",
        description: "La operación ha sido reintentada correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo reintentar la operación",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || statusStyles.pending}`}>
        {status}
      </span>
    );
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      status: '',
      provider: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando operaciones...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="page-admin-operations">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Logs de Operaciones</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="p-6 mb-6" data-testid="card-filters">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="userId">ID de Usuario</Label>
              <Input
                id="userId"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                placeholder="Filtrar por usuario"
                data-testid="input-filter-user-id"
              />
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                  <SelectItem value="failed">Fallido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="provider">Proveedor</Label>
              <Select
                value={filters.provider}
                onValueChange={(value) => setFilters({ ...filters, provider: value })}
              >
                <SelectTrigger data-testid="select-filter-provider">
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="google">Google Drive</SelectItem>
                  <SelectItem value="dropbox">Dropbox</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                data-testid="input-filter-start-date"
              />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                data-testid="input-filter-end-date"
              />
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full" data-testid="button-clear-filters">
                <X className="w-4 h-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-operations">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Archivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Progreso</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.operations.map((operation) => (
                <tr key={operation.id} className="hover:bg-muted/50" data-testid={`row-operation-${operation.id}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    {operation.id.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                    {operation.userId.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate">
                    <div className="text-sm">{operation.fileName || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">{operation.sourceProvider || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(operation.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      {operation.progressPct !== null ? `${operation.progressPct}%` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {format(new Date(operation.createdAt), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {operation.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryOperationMutation.mutate(operation.id)}
                        disabled={retryOperationMutation.isPending}
                        data-testid={`button-retry-${operation.id}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data?.operations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No se encontraron operaciones con los filtros aplicados
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex justify-between items-center px-6 py-4 border-t">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              data-testid="button-prev-page"
            >
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {data.totalPages} (Total: {data.total})
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              data-testid="button-next-page"
            >
              Siguiente
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
