import { useQuery } from "@tanstack/react-query";
import { 
  Download, 
  FileText, 
  FileImage, 
  FileSpreadsheet, 
  Folder, 
  Archive,
  Search,
  Grid3x3,
  List,
  MoreVertical,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useState } from "react";
import type { DriveFile } from "@shared/schema";

export default function MyFiles() {
  const { t } = useTranslation(['pages', 'common']);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const { data: filesData = { files: [], total: 0, totalPages: 0 }, isLoading } = useQuery({
    queryKey: ["/api/drive-files", currentPage, itemsPerPage],
    queryFn: async ({ queryKey }) => {
      const [, page, limit] = queryKey;
      const response = await fetch(`/api/drive-files?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
    keepPreviousData: true,
  });

  const files = filesData.files || [];
  const total = filesData.total || 0;
  const totalPages = filesData.totalPages || 0;

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="w-6 h-6 text-gray-600" />;

    if (mimeType.includes('folder')) {
      return <Folder className="w-6 h-6 text-yellow-600" />;
    }
    if (mimeType.includes('image/')) {
      return <FileImage className="w-6 h-6 text-green-600" />;
    }
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FileText className="w-6 h-6 text-blue-600" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return <Archive className="w-6 h-6 text-purple-600" />;
    }
    return <FileText className="w-6 h-6 text-gray-600" />;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleDownload = (file: DriveFile) => {
    // Crear URL de descarga desde Google Drive
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.copiedFileId}`;
    window.open(downloadUrl, '_blank');
  };

  const filteredFiles = files.filter((file: DriveFile) =>
    file.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="min-h-screen bg-gray-50" data-testid="page-my-files">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-[1.5rem] font-semibold text-foreground mb-2">{t('myFiles.title')}</h1>
            <p className="text-muted-foreground">
              {t('myFiles.description')}
            </p>
          </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('myFiles.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex border border-border rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none border-l"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Files Grid/List */}
        {filteredFiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Folder className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? t('myFiles.noFilesFound') : t('myFiles.noFilesCopied')}
              </h3>
              <p className="text-muted-foreground text-center">
                {searchTerm 
                  ? t('myFiles.tryDifferentSearch')
                  : t('myFiles.filesWillAppearHere')
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' ? 
            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : 
            "space-y-2"
          }>
            {filteredFiles.map((file: DriveFile) => (
              <Card 
                key={file.id} 
                className="hover:shadow-md transition-shadow group"
              >
                <CardContent className={viewMode === 'grid' ? 'p-4' : 'p-3 flex items-center space-x-4'}>
                  <div className={viewMode === 'grid' ? 'space-y-3' : 'flex items-center space-x-3 flex-1'}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                        {getFileIcon(file.mimeType || undefined)}
                      </div>
                      <div className={viewMode === 'list' ? 'flex-1' : ''}>
                        <h3 className="font-medium text-sm truncate mb-1">
                          {file.fileName}
                        </h3>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.fileSize || undefined)}</span>
                          <span>•</span>
                          <span>{formatDate(file.createdAt!)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {viewMode === 'grid' && (
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {t('myFiles.copied')}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(file)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {viewMode === 'list' && (
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        {t('myFiles.copied')}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-4 py-3 border rounded-lg bg-white">
              <div className="flex items-center text-sm text-muted-foreground">
                <span data-testid={`text-showing-${Math.min((currentPage - 1) * itemsPerPage + 1, total)}-to-${Math.min(currentPage * itemsPerPage, total)}-of-${total}`}>
                  {t('myFiles.showing')} {Math.min((currentPage - 1) * itemsPerPage + 1, total)} {t('myFiles.to')} {Math.min(currentPage * itemsPerPage, total)} {t('myFiles.of')} {total} {t('myFiles.files')}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="flex items-center space-x-1"
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>{t('myFiles.previous')}</span>
                </Button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="flex items-center space-x-1"
                  data-testid="button-next-page"
                >
                  <span>{t('myFiles.next')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}