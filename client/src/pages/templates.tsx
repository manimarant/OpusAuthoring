import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BlockTemplate {
  id: string;
  name: string;
  description: string;
  blockType: string;
  templateData: any;
  isPublic: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function Templates() {
  const { data: templates, isLoading } = useQuery<BlockTemplate[]> ({
    queryKey: ["/api/block-templates"],
  });

  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="text-templates-title">
            Block Templates
          </h1>
          <p className="text-muted-foreground mt-2" data-testid="text-templates-description">
            Reusable content blocks for your courses
          </p>
        </div>
        <Button size="lg" className="shadow-md" data-testid="button-create-template">
          <Plus className="mr-2 h-5 w-5" />
          Create Template
        </Button>
      </div>

      {/* Templates Grid */}
      <Card className="shadow-sm border-border" data-testid="card-templates-container">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="border border-border rounded-lg p-4 animate-pulse" data-testid={`skeleton-template-${i}`}>
                  <div className="w-full h-32 bg-muted rounded-lg mb-3"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-3 bg-muted rounded mb-2 w-2/3"></div>
                  <div className="h-5 bg-muted rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : templates && templates.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template, index) => (
                <div
                  key={template.id}
                  className="group block border border-black/10 dark:border-white/10 rounded-xl p-6 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:border-black/20 dark:hover:border-white/20 transition-all duration-300 shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
                  data-testid={`card-template-${template.id}`}
                >
                  <div className="w-full aspect-[16/9] bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-black border border-black/10 dark:border-white/10 rounded-lg mb-4 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-300">
                    <FileText className="text-black/70 dark:text-white/70 h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-tight leading-snug line-clamp-2 mb-2 text-foreground group-hover:text-black dark:group-hover:text-white transition-colors" data-testid={`text-template-name-${template.id}`}>
                    {template.name}
                  </h3>
                  <div className="space-y-1 mb-4">
                    <p className="text-[13px] leading-5 text-muted-foreground" data-testid={`text-template-description-${template.id}`}>
                      {template.description || "No description"}
                    </p>
                    <p className="text-[13px] leading-5 text-muted-foreground" data-testid={`text-template-type-${template.id}`}>
                      Type: {template.blockType}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <Badge
                      variant={template.isPublic === "true" ? "default" : "secondary"}
                      className="text-[11px] uppercase tracking-wider font-medium"
                      data-testid={`badge-template-visibility-${template.id}`}
                    >
                      {template.isPublic === "true" ? "Public" : "Private"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      data-testid={`button-preview-template-${template.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-templates-title">No templates yet</h3>
              <p className="text-muted-foreground mb-4" data-testid="text-no-templates-description">
                Create your first reusable content block template to speed up course creation.
              </p>
              <Button data-testid="button-create-first-template">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Template
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
