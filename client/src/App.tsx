import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Operations from "@/pages/Operations";
import Integrations from "@/pages/Integrations";
import CloudExplorer from "@/pages/CloudExplorer";
import MyFiles from "@/pages/MyFiles";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
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
