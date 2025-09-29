import { useState } from "react";
import { 
  Folder, 
  FileText, 
  FileImage, 
  FileSpreadsheet,
  Archive,
  MoreVertical,
  Grid3x3,
  List,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  mimeType?: string;
  size?: number;
  modifiedTime: string;
}

interface FileGridProps {
  files?: FileItem[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

const mockFiles: FileItem[] = [
  {
    id: '1',
    name: 'Presentaciones Marketing',
    type: 'folder',
    modifiedTime: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    name: 'Propuesta_Proyecto_Q4.docx',
    type: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 2500000,
    modifiedTime: '2024-01-14T15:45:00Z'
  },
  {
    id: '3',
    name: 'Presupuesto_2024.xlsx',
    type: 'file',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1800000,
    modifiedTime: '2024-01-12T09:20:00Z'
  },
  {
    id: '4',
    name: 'Manual_Usuario_v2.pdf',
    type: 'file',
    mimeType: 'application/pdf',
    size: 5200000,
    modifiedTime: '2024-01-08T14:10:00Z'
  },
  {
    id: '5',
    name: 'Logo_Empresa_2024.png',
    type: 'file',
    mimeType: 'image/png',
    size: 890000,
    modifiedTime: '2024-01-01T11:00:00Z'
  },
  {
    id: '6',
    name: 'Backup_Proyecto_Final.zip',
    type: 'file',
    mimeType: 'application/zip',
    size: 25700000,
    modifiedTime: '2023-12-15T16:30:00Z'
  }
];

function getFileIcon(file: FileItem) {
  if (file.type === 'folder') {
    return <Folder className="w-6 h-6 text-yellow-600" />;
  }

  if (!file.mimeType) return <FileText className="w-6 h-6 text-gray-600" />;

  if (file.mimeType.includes('image/')) {
    return <FileImage className="w-6 h-6 text-green-600" />;
  }
  
  if (file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel')) {
    return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
  }
  
  if (file.mimeType.includes('word') || file.mimeType.includes('document')) {
    return <FileText className="w-6 h-6 text-blue-600" />;
  }
  
  if (file.mimeType.includes('zip') || file.mimeType.includes('archive')) {
    return <Archive className="w-6 h-6 text-purple-600" />;
  }

  return <FileText className="w-6 h-6 text-gray-600" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatModifiedTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'ayer';
  if (diffDays <= 7) return `hace ${diffDays} días`;
  if (diffDays <= 30) return `hace ${Math.ceil(diffDays / 7)} semana${Math.ceil(diffDays / 7) > 1 ? 's' : ''}`;
  return `hace ${Math.ceil(diffDays / 30)} mes${Math.ceil(diffDays / 30) > 1 ? 'es' : ''}`;
}

export default function FileGrid({ files = mockFiles, onSelectionChange }: FileGridProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('name');
  const [driveUrl, setDriveUrl] = useState('');

  const handleFileSelection = (fileId: string, checked: boolean) => {
    const newSelection = checked 
      ? [...selectedFiles, fileId]
      : selectedFiles.filter(id => id !== fileId);
    
    setSelectedFiles(newSelection);
    onSelectionChange?.(newSelection);
  };

  return (
    <div className="h-full flex flex-col">
      {/* URL Input Section */}
      <div className="bg-card border-b border-border p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-muted-foreground mb-4">
            Pega una URL de Google Drive para comenzar a copiar archivos y carpetas
          </p>
          
          <div className="flex space-x-2">
            <Input
              id="drive-url"
              type="url"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              className="flex-1"
              data-testid="input-drive-url"
            />
            <Button 
              disabled={!driveUrl.trim()}
              data-testid="button-start-copy"
            >
              Iniciar Copia
            </Button>
          </div>
        </div>
      </div>
      
      {/* File Browser */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-2"}>
          {files.map((file) => (
            <div
              key={file.id}
              className={`bg-card border border-border rounded-lg hover:shadow-md transition-shadow cursor-pointer group ${
                viewMode === 'grid' ? 'p-4' : 'p-3 flex items-center space-x-3'
              }`}
              data-testid={`file-item-${file.id}`}
            >
              <div className={`flex items-${viewMode === 'grid' ? 'start' : 'center'} justify-between ${viewMode === 'grid' ? 'mb-3' : ''} ${viewMode === 'list' ? 'flex-1' : ''}`}>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    onCheckedChange={(checked) => handleFileSelection(file.id, checked as boolean)}
                    data-testid={`checkbox-file-${file.id}`}
                  />
                  <div className={`${viewMode === 'grid' ? 'w-10 h-10' : 'w-8 h-8'} bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center`}>
                    {getFileIcon(file)}
                  </div>
                  <div className={viewMode === 'list' ? 'flex-1' : ''}>
                    <h3 className={`font-medium ${viewMode === 'grid' ? 'text-sm mb-1' : 'text-sm'} truncate`}>
                      {file.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {file.type === 'folder' ? '12 elementos' : formatFileSize(file.size || 0)} • 
                      Modificado {formatModifiedTime(file.modifiedTime)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-file-menu-${file.id}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {files.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Folder className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No hay archivos para mostrar
            </h3>
            <p className="text-muted-foreground">
              Ingresa una URL de Google Drive para comenzar a copiar archivos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
