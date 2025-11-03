import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import SignupSuccess from "@/pages/SignupSuccess";
import EmailConfirmation from "@/pages/EmailConfirmation";
import Home from "@/pages/Home";
import Operations from "@/pages/Operations";
import Integrations from "@/pages/Integrations";
import CloudExplorer from "@/pages/CloudExplorer";
import MyFiles from "@/pages/MyFiles";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminOperations from "@/pages/admin/Operations";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user, error } = useAuth();
  
  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Auth routes - available to all users */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/signup/success" component={SignupSuccess} />
      <Route path="/auth/confirm" component={EmailConfirmation} />
      
      {!isAuthenticated || error ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/shared-drives" component={() => <div>Drives Compartidos (En desarrollo)</div>} />
          <Route path="/operations" component={Operations} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/cloud-explorer" component={CloudExplorer} />
          <Route path="/my-files" component={MyFiles} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={Profile} />
          <Route path="/admin" component={() => {
            if (user?.role !== 'admin') {
              return <div className="p-6 max-w-7xl mx-auto"><h1 className="text-3xl font-bold mb-4">Acceso Denegado</h1><p>No tienes permisos para acceder a esta página.</p></div>;
            }
            return <AdminDashboard />;
          }} />
          <Route path="/admin/users" component={() => {
            if (user?.role !== 'admin') {
              return <div className="p-6 max-w-7xl mx-auto"><h1 className="text-3xl font-bold mb-4">Acceso Denegado</h1><p>No tienes permisos para acceder a esta página.</p></div>;
            }
            return <AdminUsers />;
          }} />
          <Route path="/admin/operations" component={() => {
            if (user?.role !== 'admin') {
              return <div className="p-6 max-w-7xl mx-auto"><h1 className="text-3xl font-bold mb-4">Acceso Denegado</h1><p>No tienes permisos para acceder a esta página.</p></div>;
            }
            return <AdminOperations />;
          }} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
