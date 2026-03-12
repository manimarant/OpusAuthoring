import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Image, Music, Video, FileText, Download, Trash2 } from "lucide-react";
import type { MediaAsset, ReferenceFile } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResourceListItem } from "@/components/course/resource-list-item";

const getStoredFileUrl = (storageKey: string) =>
  /^https?:\/\//i.test(storageKey) ? storageKey : `/uploads/${storageKey}`;

export default function Resources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedDocumentFile, setSelectedDocumentFile] = useState<File | null>(null);

  // Fetch available courses to get a courseId
  const { data: courses, isLoading: isLoadingCourses } = useQuery<any[]>({
    queryKey: ['courses'],
    queryFn: () => apiRequest("GET", `/api/courses`).then(res => res.json()),
  });

  const courseId = courses && courses.length > 0 ? courses[0].id : undefined;
  const isUploadDisabled = !courseId || isLoadingCourses;

  // Fetch existing media assets
  const { data: mediaAssets, isLoading: isLoadingMediaAssets } = useQuery<MediaAsset[]>({
    queryKey: ['mediaAssets', courseId],
    queryFn: () => apiRequest("GET", `/api/courses/${courseId}/media-assets`).then(res => res.json()),
    enabled: !!courseId,
  });

  // Fetch existing reference files (documents)
  const { data: referenceFiles, isLoading: isLoadingReferenceFiles } = useQuery<ReferenceFile[]>({
    queryKey: ['referenceFiles', courseId],
    queryFn: () => apiRequest("GET", `/api/courses/${courseId}/files`).then(res => res.json()),
    enabled: !!courseId,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: 'image' | 'audio' | 'video' | 'document' }) => {
      const formData = new FormData();
      
      let url = '';
      if (type === 'document') {
        url = `/api/courses/${courseId}/upload`; // Existing document upload endpoint
        formData.append('files', file); // Existing endpoint expects 'files'
      } else {
        url = `/api/courses/${courseId}/media-upload`; // New endpoint
        formData.append('file', file); // Multer expects 'file'
        formData.append('assetType', type); // For media assets
      }

      const response = await apiRequest("POST", url, formData);
      if (!response.ok) {
        throw new Error(`Failed to upload ${type}`);
      }
      return response.json();
    },
    onSuccess: async (data, variables) => {
      toast({
        title: "Upload Successful",
        description: `${variables.type} "${variables.file.name}" uploaded.`,
      });
      // Invalidate and refetch queries to update resource lists
      if (variables.type === 'document') {
        await queryClient.invalidateQueries({ queryKey: ['referenceFiles', courseId], refetchType: 'active' });
      } else {
        await queryClient.invalidateQueries({ queryKey: ['mediaAssets', courseId], refetchType: 'active' });
      }
      // Clear selected file
      switch (variables.type) {
        case 'image': setSelectedImageFile(null); break;
        case 'audio': setSelectedAudioFile(null); break;
        case 'video': setSelectedVideoFile(null); break;
        case 'document': setSelectedDocumentFile(null); break;
      }
    },
    onError: (error, variables) => {
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${variables.type}: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMediaAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("DELETE", `/api/media-assets/${assetId}`);
      if (!response.ok) {
        throw new Error("Failed to delete media asset");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mediaAssets', courseId], refetchType: 'active' });
      toast({ title: "Deleted", description: "Media asset deleted successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to delete media asset: ${error.message}`, variant: "destructive" });
    }
  });

  const deleteReferenceFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await apiRequest("DELETE", `/api/reference-files/${fileId}`);
      if (!response.ok) {
        throw new Error("Failed to delete reference file");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['referenceFiles', courseId], refetchType: 'active' });
      toast({ title: "Deleted", description: "Reference file deleted successfully." });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to delete reference file: ${error.message}`, variant: "destructive" });
    }
  });

  const handleFileUpload = (file: File | null, type: 'image' | 'audio' | 'video' | 'document') => {
    if (file) {
      uploadFileMutation.mutate({ file, type });
    } else {
      toast({
        title: "No file selected",
        description: `Please select a ${type} file to upload.`,
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image')) return <Image className="h-5 w-5" />;
    if (mimetype.startsWith('audio')) return <Music className="h-5 w-5" />;
    if (mimetype.startsWith('video')) return <Video className="h-5 w-5" />;
    // Fallback to generic FileText for all document types due to import issues
    if (mimetype.includes('pdf') || mimetype.includes('wordprocessingml') || mimetype.includes('msword') || mimetype.includes('spreadsheetml') || mimetype.includes('excel') || mimetype.includes('text/plain')) return <FileText className="h-5 w-5" />;
    return <FileText className="h-5 w-5" />;
  };

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <div className="container mx-auto">
      <h1 className="text-3xl font-bold mb-6">Course Resources</h1>

      <Tabs defaultValue="images" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="audio">Audio</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        {/* Images Tab */}
        <TabsContent value="images">
          <Card>
            <CardHeader>
              <CardTitle>Upload Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <Label htmlFor="image-upload">Image File</Label>
                <Input 
                  id="image-upload" 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setSelectedImageFile(e.target.files ? e.target.files[0] : null)} 
                />
                <Button 
                  onClick={() => handleFileUpload(selectedImageFile, 'image')} 
                  disabled={!selectedImageFile || uploadFileMutation.isPending || isUploadDisabled}
                >
                  {uploadFileMutation.isPending && selectedImageFile?.type.startsWith('image') ? "Uploading..." : "Upload Image"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-4">Images ({mediaAssets?.filter(asset => asset.assetType === 'image').length || 0})</h2>
            {isLoadingMediaAssets || isUploadDisabled ? (
              isUploadDisabled && !isLoadingCourses ? (
                <p className="text-muted-foreground">Please create a course first to upload resources.</p>
              ) : (
                <p>Loading images...</p>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediaAssets?.filter(asset => asset.assetType === 'image').map(asset => (
                  <Card key={asset.id} className="overflow-hidden">
                    <div className="aspect-video bg-muted relative">
                      <img 
                        src={getStoredFileUrl(asset.filename)} 
                        alt={asset.originalName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                        }}
                      />
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{asset.originalName}</p>
                          <p className="text-sm text-muted-foreground">{(parseInt(asset.size) / 1024).toFixed(2)} KB</p>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <Button variant="ghost" size="icon" onClick={() => window.open(getStoredFileUrl(asset.filename), '_blank')}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMediaAssetMutation.mutate(asset.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {mediaAssets?.filter(asset => asset.assetType === 'image').length === 0 && (
                  <p className="text-muted-foreground col-span-full">No images uploaded yet.</p>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Audio Tab */}
        <TabsContent value="audio">
          <Card>
            <CardHeader>
              <CardTitle>Upload Audio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <Label htmlFor="audio-upload">Audio File</Label>
                <Input 
                  id="audio-upload" 
                  type="file" 
                  accept="audio/*" 
                  onChange={(e) => setSelectedAudioFile(e.target.files ? e.target.files[0] : null)} 
                />
                <Button 
                  onClick={() => handleFileUpload(selectedAudioFile, 'audio')} 
                  disabled={!selectedAudioFile || uploadFileMutation.isPending || isUploadDisabled}
                >
                  {uploadFileMutation.isPending && selectedAudioFile?.type.startsWith('audio') ? "Uploading..." : "Upload Audio"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-4">Audio ({mediaAssets?.filter(asset => asset.assetType === 'audio').length || 0})</h2>
            {isLoadingMediaAssets || isUploadDisabled ? (
              isUploadDisabled && !isLoadingCourses ? (
                <p className="text-muted-foreground">Please create a course first to upload resources.</p>
              ) : (
                <p>Loading audio...</p>
              )
            ) : (
              <div className="border rounded-md">
                {mediaAssets?.filter(asset => asset.assetType === 'audio').length === 0 ? (
                  <p className="p-4 text-muted-foreground">No audio uploaded yet.</p>
                ) : (
                  mediaAssets?.filter(asset => asset.assetType === 'audio').map(asset => (
                    <ResourceListItem
                      key={asset.id}
                      file={asset}
                      type="audio"
                      getFileIcon={getFileIcon}
                      onDelete={(id) => deleteMediaAssetMutation.mutate(id)}
                      onEdit={(id) => toast({ title: "Edit Audio", description: `Edit functionality for audio ${id} not yet implemented.` })}
                      onPreview={(url) => window.open(url, '_blank')}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Video Tab */}
        <TabsContent value="video">
          <Card>
            <CardHeader>
              <CardTitle>Upload Video</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <Label htmlFor="video-upload">Video File</Label>
                <Input 
                  id="video-upload" 
                  type="file" 
                  accept="video/*" 
                  onChange={(e) => setSelectedVideoFile(e.target.files ? e.target.files[0] : null)} 
                />
                <Button 
                  onClick={() => handleFileUpload(selectedVideoFile, 'video')} 
                  disabled={!selectedVideoFile || uploadFileMutation.isPending || isUploadDisabled}
                >
                  {uploadFileMutation.isPending && selectedVideoFile?.type.startsWith('video') ? "Uploading..." : "Upload Video"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-4">Videos ({mediaAssets?.filter(asset => asset.assetType === 'video').length || 0})</h2>
            {isLoadingMediaAssets || isUploadDisabled ? (
              isUploadDisabled && !isLoadingCourses ? (
                <p className="text-muted-foreground">Please create a course first to upload resources.</p>
              ) : (
                <p>Loading videos...</p>
              )
            ) : (
              <div className="border rounded-md">
                {mediaAssets?.filter(asset => asset.assetType === 'video').length === 0 ? (
                  <p className="p-4 text-muted-foreground">No videos uploaded yet.</p>
                ) : (
                  mediaAssets?.filter(asset => asset.assetType === 'video').map(asset => (
                    <ResourceListItem
                      key={asset.id}
                      file={asset}
                      type="video"
                      getFileIcon={getFileIcon}
                      onDelete={(id) => deleteMediaAssetMutation.mutate(id)}
                      onEdit={(id) => toast({ title: "Edit Video", description: `Edit functionality for video ${id} not yet implemented.` })}
                      onPreview={(url) => window.open(url, '_blank')}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Upload Document</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid w-full items-center gap-4">
                <Label htmlFor="document-upload">Document File</Label>
                <Input 
                  id="document-upload" 
                  type="file" 
                  accept="application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain" 
                  onChange={(e) => setSelectedDocumentFile(e.target.files ? e.target.files[0] : null)} 
                />
                <Button 
                  onClick={() => handleFileUpload(selectedDocumentFile, 'document')} 
                  disabled={!selectedDocumentFile || uploadFileMutation.isPending || isUploadDisabled}
                >
                  {uploadFileMutation.isPending && (selectedDocumentFile?.type.startsWith('application') || selectedDocumentFile?.type.startsWith('text')) ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-4">Documents ({referenceFiles?.length || 0})</h2>
            {isLoadingReferenceFiles || isUploadDisabled ? (
              isUploadDisabled && !isLoadingCourses ? (
                <p className="text-muted-foreground">Please create a course first to upload resources.</p>
              ) : (
                <p>Loading documents...</p>
              )
            ) : (
              <div className="border rounded-md">
                {referenceFiles?.length === 0 ? (
                  <p className="p-4 text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  referenceFiles?.map(file => (
                    <ResourceListItem
                      key={file.id}
                      file={file}
                      type="document"
                      getFileIcon={getFileIcon}
                      onDelete={(id) => deleteReferenceFileMutation.mutate(id)}
                      onEdit={(id) => toast({ title: "Edit Document", description: `Edit functionality for document ${id} not yet implemented.` })}
                      onPreview={(url) => window.open(url, '_blank')}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </main>
  );
}
