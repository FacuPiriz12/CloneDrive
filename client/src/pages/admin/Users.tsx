import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Ban, CheckCircle, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    users: User[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ['/api/admin/users', page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const updateLimitsMutation = useMutation({
    mutationFn: async ({ userId, limits }: { userId: string; limits: any }) => {
      return await apiRequest(`/api/admin/users/${userId}/limits`, {
        method: 'PUT',
        body: JSON.stringify(limits),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      setEditDialogOpen(false);
      toast({
        title: "Límites actualizados",
        description: "Los límites del usuario se han actualizado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron actualizar los límites",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Rol actualizado",
        description: "El rol del usuario se ha actualizado correctamente",
      });
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuario suspendido",
        description: "El usuario ha sido suspendido correctamente",
      });
    },
  });

  const activateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}/activate`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuario activado",
        description: "El usuario ha sido activado correctamente",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente",
      });
    },
  });

  const handleEditLimits = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleSubmitLimits = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;

    const formData = new FormData(e.currentTarget);
    const limits = {
      maxStorageBytes: parseInt(formData.get('maxStorageBytes') as string),
      maxConcurrentOperations: parseInt(formData.get('maxConcurrentOperations') as string),
      maxDailyOperations: parseInt(formData.get('maxDailyOperations') as string),
    };

    updateLimitsMutation.mutate({ userId: selectedUser.id, limits });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 GB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="page-admin-users">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        <div className="text-sm text-muted-foreground">
          Total: {data?.total || 0} usuarios
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-users">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Límites</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/50" data-testid={`row-user-${user.id}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">{user.firstName} {user.lastName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Select
                      value={user.role}
                      onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })}
                      data-testid={`select-role-${user.id}`}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuario</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Suspendido
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>Storage: {formatBytes(user.maxStorageBytes || 0)}</div>
                    <div>Ops: {user.maxConcurrentOperations || 0}/{user.maxDailyOperations || 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditLimits(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      {user.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => suspendUserMutation.mutate(user.id)}
                          data-testid={`button-suspend-${user.id}`}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => activateUserMutation.mutate(user.id)}
                          data-testid={`button-activate-${user.id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('¿Estás seguro de eliminar este usuario?')) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                        data-testid={`button-delete-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
              Página {page} de {data.totalPages}
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

      {/* Edit Limits Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-limits">
          <DialogHeader>
            <DialogTitle>Editar Límites de Usuario</DialogTitle>
            <DialogDescription>
              Modifica los límites para {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitLimits} className="space-y-4">
            <div>
              <Label htmlFor="maxStorageBytes">Almacenamiento Máximo (GB)</Label>
              <Input
                id="maxStorageBytes"
                name="maxStorageBytes"
                type="number"
                defaultValue={((selectedUser?.maxStorageBytes || 0) / (1024 * 1024 * 1024)).toFixed(0)}
                data-testid="input-max-storage"
              />
            </div>
            <div>
              <Label htmlFor="maxConcurrentOperations">Operaciones Concurrentes</Label>
              <Input
                id="maxConcurrentOperations"
                name="maxConcurrentOperations"
                type="number"
                defaultValue={selectedUser?.maxConcurrentOperations || 5}
                data-testid="input-max-concurrent"
              />
            </div>
            <div>
              <Label htmlFor="maxDailyOperations">Operaciones Diarias</Label>
              <Input
                id="maxDailyOperations"
                name="maxDailyOperations"
                type="number"
                defaultValue={selectedUser?.maxDailyOperations || 100}
                data-testid="input-max-daily"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateLimitsMutation.isPending} data-testid="button-save-limits">
                {updateLimitsMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
