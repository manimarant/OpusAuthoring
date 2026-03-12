import { GripVertical, MoreVertical, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Module } from "@shared/schema";

interface ModuleCardProps {
  module: Module;
  onEdit: () => void;
  draggable?: boolean;
}

export default function ModuleCard({ module, onEdit, draggable = false }: ModuleCardProps) {

  return (
    <Card className="bg-background border border-border rounded-lg p-4 content-block" data-testid={`card-module-${module.id}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          {draggable && (
            <div className="drag-handle text-muted-foreground cursor-grab" data-testid="drag-handle">
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-medium" data-testid={`text-module-title-${module.id}`}>
              {parseInt(module.order) + 1}. {module.title}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid={`text-module-description-${module.id}`}>
              {module.description}
            </p>
          </div>
          <div className="text-sm text-muted-foreground" data-testid={`text-module-duration-${module.id}`}>
            {module.duration}
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          <Button
            onClick={onEdit}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-primary transition-colors"
            data-testid={`button-edit-module-${module.id}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            data-testid={`button-module-menu-${module.id}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
