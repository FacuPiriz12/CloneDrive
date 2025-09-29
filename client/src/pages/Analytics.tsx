import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  Files, 
  Clock, 
  CheckCircle,
  XCircle,
  BarChart3,
  Calendar,
  Target
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import type { CopyOperation } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function Analytics() {
  const { t } = useTranslation(['pages', 'common']);
  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["/api/copy-operations"],
  });

  // Cálculo de estadísticas
  const totalOperations = operations.length;
  const completedOperations = operations.filter((op: CopyOperation) => op.status === 'completed').length;
  const failedOperations = operations.filter((op: CopyOperation) => op.status === 'failed').length;
  const inProgressOperations = operations.filter((op: CopyOperation) => op.status === 'in_progress').length;
  
  const totalFiles = operations.reduce((sum: number, op: CopyOperation) => sum + (op.completedFiles || 0), 0);
  const successRate = totalOperations > 0 ? (completedOperations / totalOperations) * 100 : 0;
  
  // Cálculo de tiempo promedio (solo operaciones completadas)
  const completedOps = operations.filter((op: CopyOperation) => op.status === 'completed');
  const averageTime = completedOps.length > 0 
    ? completedOps.reduce((sum: number, op: CopyOperation) => {
        const duration = new Date(op.updatedAt!).getTime() - new Date(op.createdAt!).getTime();
        return sum + duration;
      }, 0) / completedOps.length / 1000 // en segundos
    : 0;

  // Operaciones por día (últimos 7 días)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayOperations = operations.filter((op: CopyOperation) => {
      const opDate = new Date(op.createdAt!);
      return opDate.toDateString() === date.toDateString();
    }).length;
    
    last7Days.push({
      date: date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
      operations: dayOperations
    });
  }

  const maxDayOperations = Math.max(...last7Days.map(day => day.operations), 1);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="page-analytics">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[1.5rem] font-semibold text-foreground mb-2">{t('analytics.title')}</h1>
            <p className="text-muted-foreground">
              {t('analytics.description')}
            </p>
          </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.totalOperations')}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOperations}</div>
              <p className="text-xs text-muted-foreground">
                {inProgressOperations > 0 && `${inProgressOperations} ${t('analytics.inProgress')}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.filesCopied')}</CardTitle>
              <Files className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalFiles}</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.totalFilesProcessed')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.successRate')}</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
              <Progress value={successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('analytics.averageTime')}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(averageTime)}</div>
              <p className="text-xs text-muted-foreground">
                {t('analytics.perCompletedOperation')}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>{t('analytics.operationStatus')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{t('analytics.completed')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{completedOperations}</span>
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-green-500 rounded-full" 
                        style={{ width: `${totalOperations > 0 ? (completedOperations / totalOperations) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm">{t('analytics.failed')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{failedOperations}</span>
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-red-500 rounded-full" 
                        style={{ width: `${totalOperations > 0 ? (failedOperations / totalOperations) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{t('analytics.inProgressStatus')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{inProgressOperations}</span>
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-blue-500 rounded-full" 
                        style={{ width: `${totalOperations > 0 ? (inProgressOperations / totalOperations) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>{t('analytics.activityLast7Days')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {last7Days.map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{day.date}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 h-2 bg-gray-200 rounded-full">
                        <div 
                          className="h-2 bg-blue-500 rounded-full transition-all duration-300" 
                          style={{ width: `${(day.operations / maxDayOperations) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-6 text-right">{day.operations}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Performance */}
        {totalOperations === 0 && (
          <Card className="mt-6">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {t('analytics.noDataTitle')}
              </h3>
              <p className="text-muted-foreground text-center">
                {t('analytics.noDataMessage')}
              </p>
            </CardContent>
          </Card>
          )}
        </main>
      </div>
    </div>
  );
}