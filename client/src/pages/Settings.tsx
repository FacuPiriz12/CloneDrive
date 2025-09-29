import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { User, Mail, Camera, Save, Shield, Trash2 } from "lucide-react";
import GoogleDriveLogo from "@/components/GoogleDriveLogo";
import DropboxLogo from "@/components/DropboxLogo";

// Schema for user settings form
const settingsSchema = z.object({
  firstName: z.string().min(1, "El nombre es requerido").max(50, "El nombre es muy largo"),
  lastName: z.string().min(1, "El apellido es requerido").max(50, "El apellido es muy largo"),
  email: z.string().email("Email inválido")
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: ""
    }
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || ""
      });
    }
  }, [user?.id, form]);

  const updateUserMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("/api/user/update", {
        method: "PATCH",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Información actualizada",
        description: "Tus datos han sido actualizados exitosamente."
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la información",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: SettingsFormData) => {
    updateUserMutation.mutate(data);
  };

  const handleCancel = () => {
    form.reset({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || ""
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando configuraciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto py-8 px-4 max-w-4xl pt-20 relative z-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-settings-title">
            Configuraciones
          </h1>
          <p className="text-muted-foreground">
            Gestiona tu información personal y preferencias de cuenta
          </p>
        </div>

        <div className="grid gap-6">
          {/* Profile Information Card */}
          <Card data-testid="card-profile-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Información Personal
              </CardTitle>
              <CardDescription>
                Actualiza tu información personal y datos de perfil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20" data-testid="avatar-settings">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary text-white text-lg">
                    {user.firstName?.[0] || user.email?.[0] || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Foto de Perfil</h3>
                  <p className="text-sm text-muted-foreground">
                    Tu foto de perfil actual
                  </p>
                  <Button variant="outline" size="sm" disabled data-testid="button-change-photo">
                    <Camera className="h-4 w-4 mr-2" />
                    Cambiar Foto (Próximamente)
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Form Section */}
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled={!isEditing}
                              data-testid="input-first-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellido</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              disabled={!isEditing}
                              data-testid="input-last-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="email"
                            disabled={!isEditing}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    {!isEditing ? (
                      <Button 
                        type="button" 
                        onClick={() => setIsEditing(true)}
                        data-testid="button-edit-profile"
                      >
                        <User className="h-4 w-4 mr-2" />
                        Editar Información
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button 
                          type="submit" 
                          disabled={updateUserMutation.isPending}
                          data-testid="button-save-changes"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {updateUserMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCancel}
                          data-testid="button-cancel-edit"
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Account Information Card */}
          <Card data-testid="card-account-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Información de Cuenta
              </CardTitle>
              <CardDescription>
                Detalles de tu cuenta y servicios conectados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">ID de Usuario</Label>
                  <p className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded" data-testid="text-user-id">
                    {user.id}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fecha de Registro</Label>
                  <p className="text-sm text-muted-foreground" data-testid="text-created-at">
                    {user.createdAt 
                      ? new Date(user.createdAt).toLocaleDateString('es-ES')
                      : 'No disponible'
                    }
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Servicios Conectados</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-white border">
                        <GoogleDriveLogo className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Google Drive</p>
                        <p className="text-xs text-muted-foreground">
                          {user.googleConnected ? 'Conectado' : 'No conectado'}
                        </p>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${user.googleConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-white border">
                        <DropboxLogo className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Dropbox</p>
                        <p className="text-xs text-muted-foreground">
                          {user.dropboxConnected ? 'Conectado' : 'No conectado'}
                        </p>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${user.dropboxConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone Card */}
          <Card className="border-red-300 dark:border-red-800" data-testid="card-danger-zone">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400 font-semibold">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                Zona Peligrosa
              </CardTitle>
              <CardDescription>
                Acciones irreversibles para tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <h4 className="text-sm font-medium mb-2">Eliminar Cuenta</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Esta acción eliminará permanentemente tu cuenta y todos los datos asociados. 
                    Esta acción no se puede deshacer.
                  </p>
                  <Button variant="destructive" disabled data-testid="button-delete-account">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar Cuenta (Próximamente)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}