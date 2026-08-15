import { useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PrintProfile } from '@/hooks/useBillboardPrintSettings';
import { FolderOpen, Plus, Trash2, Check, Star, Edit, Loader2 } from 'lucide-react';

interface ProfileManagerProps {
  profiles: PrintProfile[];
  activeProfile: PrintProfile | null;
  hasUnsavedChanges: boolean;
  onLoadProfile: (profile: PrintProfile) => void;
  onSaveProfile: () => void;
  onCreateProfile: (name: string, description?: string) => void;
  onDeleteProfile: (id: string) => void;
  onSetDefault: (id: string) => void;
  onUpdateInfo: (id: string, name: string, description?: string) => void;
  isSaving?: boolean;
  isCreating?: boolean;
}

export function ProfileManager({
  profiles,
  activeProfile,
  hasUnsavedChanges,
  onLoadProfile,
  onSaveProfile,
  onCreateProfile,
  onDeleteProfile,
  onSetDefault,
  onUpdateInfo,
  isSaving,
  isCreating,
}: ProfileManagerProps) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showProfilesDialog, setShowProfilesDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateProfile(newName.trim(), newDescription.trim() || undefined);
    setNewName('');
    setNewDescription('');
    setShowCreateDialog(false);
  };

  const handleStartEdit = (profile: PrintProfile) => {
    setEditingId(profile.id);
    setEditName(profile.profile_name);
    setEditDescription(profile.description || '');
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    onUpdateInfo(editingId, editName.trim(), editDescription.trim() || undefined);
    setEditingId(null);
  };

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              البروفايل
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setShowProfilesDialog(true)}
              >
                <FolderOpen className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-2">
          {activeProfile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{activeProfile.profile_name}</p>
                  {activeProfile.is_default && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 fill-amber-500" />
                      افتراضي
                    </span>
                  )}
                </div>
                {hasUnsavedChanges && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded">
                    غير محفوظ
                  </span>
                )}
              </div>
              
              <Button
                onClick={onSaveProfile}
                disabled={!hasUnsavedChanges || isSaving}
                className="w-full h-8"
                size="sm"
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin ml-1" />
                ) : (
                  <Check className="h-3 w-3 ml-1" />
                )}
                حفظ التغييرات
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              لا يوجد بروفايل محمل
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog لإنشاء بروفايل جديد */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إنشاء بروفايل جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم البروفايل</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: إعدادات العميل"
              />
            </div>
            <div className="space-y-2">
              <Label>الوصف (اختياري)</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="وصف مختصر للبروفايل"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isCreating}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog لعرض جميع البروفايلات */}
      <Dialog open={showProfilesDialog} onOpenChange={setShowProfilesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>البروفايلات</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {profiles.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  لا توجد بروفايلات
                </p>
              ) : (
                profiles.map((profile) => (
                  <Card
                    key={profile.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      activeProfile?.id === profile.id ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <CardContent className="p-3">
                      {editingId === profile.id ? (
                        <div className="space-y-2">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8"
                          />
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="الوصف"
                            className="h-8"
                          />
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                            >
                              إلغاء
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                            >
                              حفظ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div
                            className="flex-1 min-w-0"
                            onClick={() => {
                              onLoadProfile(profile);
                              setShowProfilesDialog(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{profile.profile_name}</p>
                              {profile.is_default && (
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              )}
                            </div>
                            {profile.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {profile.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {!profile.is_default && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetDefault(profile.id);
                                }}
                                title="تعيين كافتراضي"
                              >
                                <Star className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(profile);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا البروفايل؟', variant: 'destructive', confirmText: 'حذف' })) {
                                  onDeleteProfile(profile.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
