import React from 'react';
import { Button } from "@/components/ui/button";
import { Download, Trash2, Edit, Eye } from "lucide-react";
import { getFileNameWithoutExtension } from "@/lib/utils";
import type { MediaAsset, ReferenceFile } from "@shared/schema";

interface ResourceListItemProps {
  file: MediaAsset | ReferenceFile;
  type: 'image' | 'audio' | 'video' | 'document';
  getFileIcon: (mimetype: string) => React.ReactNode;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void; // Placeholder for edit functionality
  onPreview: (url: string) => void; // Placeholder for preview functionality
}

export const ResourceListItem: React.FC<ResourceListItemProps> = ({
  file,
  type,
  getFileIcon,
  onDelete,
  onEdit,
  onPreview,
}) => {
  const fileNameWithoutExtension = getFileNameWithoutExtension(file.originalName);
  const fileUrl = /^https?:\/\//i.test(file.filename) ? file.filename : `/uploads/${file.filename}`;

  return (
    <div className="flex items-center justify-between p-3 border-b last:border-b-0">
      <div className="flex items-center space-x-3 flex-grow">
        {getFileIcon(file.mimetype)}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{fileNameWithoutExtension}</p>
          <p className="text-sm text-muted-foreground">
            {(parseInt(file.size) / 1024).toFixed(2)} KB
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        {type === 'image' && (
          <Button variant="ghost" size="icon" onClick={() => onPreview(fileUrl)}>
            <Eye className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => window.open(fileUrl, '_blank')}>
          <Download className="h-4 w-4" />
        </Button>
        {type === 'document' ? (
          <Button variant="ghost" size="icon" onClick={() => onPreview(fileUrl)}>
            <Eye className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={() => onEdit(file.id)}>
            <Edit className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => onDelete(file.id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
};
