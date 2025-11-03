import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { 
  Home, 
  Cloud, 
  Copy, 
  Folder, 
  BarChart3, 
  Check, 
  Loader2,
  Settings,
  ArrowRightLeft,
  Shield
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "react-i18next";
import type { CopyOperation, User } from "@shared/schema";

export default function Sidebar() {
  const { t } = useTranslation(['common']);
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const prevCompletedCount = useRef<number>(0);
  
  const { data: operations = [] } = useQuery({
    queryKey: ["/api/copy-operations"],
    refetchInterval: 5000, // Poll every 5 seconds for active operations
  });

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Track completed operations to invalidate drive-files cache
  useEffect(() => {
    const completedOps = operations.filter((op: CopyOperation) => op.status === 'completed');
    if (completedOps.length > prevCompletedCount.current) {
      console.log('✅ Sidebar: New operations completed, invalidating drive-files cache');
      queryClient.invalidateQueries({ queryKey: ["/api/drive-files"] });
    }
    prevCompletedCount.current = completedOps.length;
  }, [operations, queryClient]);

  const activeOperations = operations.filter((op: CopyOperation) => 
    op.status === 'in_progress' || op.status === 'pending'
  );

  const recentOperations = operations
    .filter((op: CopyOperation) => op.status === 'completed')
    .slice(0, 3);

  const navItems = [
    { path: "/", icon: Home, label: t('navigation.home') },
    { path: "/shared-drives", icon: Cloud, label: t('navigation.sharedDrives') },
    { path: "/operations", icon: Copy, label: t('navigation.operations') },
    { path: "/integrations", icon: Settings, label: t('navigation.integrations') },
    { path: "/cloud-explorer", icon: ArrowRightLeft, label: "Explorador Multi-nube" },
    { path: "/my-files", icon: Folder, label: t('navigation.myFiles') },
    { path: "/analytics", icon: BarChart3, label: t('navigation.analytics') },
  ];

  // Admin-only navigation - only show if user is loaded and is admin
  const adminNavItems = !userLoading && user?.role === 'admin' ? [
    { path: "/admin", icon: Shield, label: "Panel Admin" },
  ] : [];

  return (
    <aside 
      className="group w-[70px] hover:w-[250px] bg-white shadow-[2px_0_5px_rgba(0,0,0,0.05)] overflow-y-auto overflow-x-hidden sticky top-[65px] h-[calc(100vh-65px)] transition-all duration-300 ease-in-out" 
      data-testid="sidebar-main"
    >
      {/* Navigation Menu */}
      <nav className="py-6">
        <ul className="space-y-0">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-all duration-200 text-muted-foreground ${
                    isActive 
                      ? "bg-primary/10 text-primary border-l-3 border-l-primary" 
                      : "hover:bg-primary/10 hover:text-primary"
                  }`}
                  data-testid={`link-nav-${item.path.substring(1) || 'home'}`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.label}</span>
                </Link>
              </li>
            );
          })}
          
          {/* Admin Navigation - Only visible for admin users */}
          {adminNavItems.map((item) => {
            const isActive = location.startsWith(item.path);
            return (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`flex items-center gap-4 px-6 py-3 cursor-pointer transition-all duration-200 text-muted-foreground border-t border-border ${
                    isActive 
                      ? "bg-primary/10 text-primary border-l-3 border-l-primary" 
                      : "hover:bg-primary/10 hover:text-primary"
                  }`}
                  data-testid="link-nav-admin"
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* Storage Status */}
      <div className="px-6 mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="text-[0.9rem] mb-2 text-muted-foreground whitespace-nowrap">{t('sidebar.storage')}</h3>
        <div className="mb-2">
          <div className="h-[6px] bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full w-[65%]"></div>
          </div>
        </div>
        <div className="text-[0.8rem] text-muted-foreground whitespace-nowrap">
          {t('sidebar.storageUsed', { used: '8.2 GB', total: '15 GB' })}
        </div>
      </div>
      
      {/* Recent Activities */}
      <div className="px-6 mt-8 border-t border-border pt-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="text-[0.9rem] font-medium mb-3 text-muted-foreground whitespace-nowrap">{t('sidebar.recentActivity')}</h3>
        <div className="space-y-3">
          {/* Active Operations */}
          {activeOperations.map((operation: CopyOperation) => (
            <div key={operation.id} className="flex items-start space-x-3" data-testid={`activity-operation-${operation.id}`}>
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {t('sidebar.copyingFiles')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('sidebar.filesProgress', { completed: operation.completedFiles || 0, total: operation.totalFiles || 0 })}
                </p>
              </div>
            </div>
          ))}
          
          {/* Recent Completed Operations */}
          {recentOperations.map((operation: CopyOperation) => (
            <div key={operation.id} className="flex items-start space-x-3" data-testid={`activity-completed-${operation.id}`}>
              <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {t('sidebar.operationCompleted')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(operation.updatedAt!).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {activeOperations.length === 0 && recentOperations.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">
                {t('sidebar.noRecentActivity')}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
