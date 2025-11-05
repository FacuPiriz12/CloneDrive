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
  Shield,
  Users,
  FileText
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
    { path: "/admin/users", icon: Users, label: "Gestión de Usuarios" },
    { path: "/admin/operations", icon: FileText, label: "Logs de Operaciones" },
  ] : [];

  return (
    <aside 
      className="group w-[80px] hover:w-[250px] bg-[#0061D5] overflow-y-auto overflow-x-hidden sticky top-[65px] h-[calc(100vh-65px)] transition-all duration-300 ease-in-out" 
      data-testid="sidebar-main"
    >
      {/* Navigation Menu */}
      <nav className="py-6">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <li key={item.path}>
                <Link 
                  href={item.path}
                  className={`flex items-center gap-3 px-[18px] group-hover:px-4 py-[14px] cursor-pointer transition-all duration-200 rounded-2xl ${
                    isActive 
                      ? "bg-[#0074E8] text-white" 
                      : "text-white/50 hover:bg-[#0052B3] hover:text-white/90"
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
          {adminNavItems.map((item, index) => {
            const isActive = location === item.path;
            return (
              <li key={item.path} className={index === 0 ? 'border-t border-white/20 mt-2 pt-2' : ''}>
                <Link 
                  href={item.path}
                  className={`flex items-center gap-3 px-[18px] group-hover:px-4 py-[14px] cursor-pointer transition-all duration-200 rounded-2xl ${
                    isActive 
                      ? "bg-[#0074E8] text-white" 
                      : "text-white/50 hover:bg-[#0052B3] hover:text-white/90"
                  }`}
                  data-testid={`link-nav-admin-${item.path.split('/').pop()}`}
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
      <div className="px-6 mt-auto pb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <h3 className="text-[0.9rem] mb-2 text-white/80 whitespace-nowrap">{t('sidebar.storage')}</h3>
        <div className="mb-2">
          <div className="h-[6px] bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full w-[65%]"></div>
          </div>
        </div>
        <div className="text-[0.8rem] text-white/70 whitespace-nowrap">
          {t('sidebar.storageUsed', { used: '8.2 GB', total: '15 GB' })}
        </div>
      </div>
    </aside>
  );
}
