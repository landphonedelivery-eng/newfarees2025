import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, CreditCard as Edit, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/Layout/MainLayout';
import { MultiSelect } from '@/components/ui/multi-select';
import { Textarea } from '@/components/ui/textarea';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes?: string[]; // legacy names
  sizes_ids?: string[]; // new: ids from sizes table (as strings)
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

type SizeRow = { id: string | number; name: string; width: number | null; height: number | null; description: string | null };

export default function InstallationTeams() {
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<InstallationTeam | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    team_name: '',
    sizesIds: [] as string[],
    notes: '' as string,
  });
  const [sizes, setSizes] = useState<SizeRow[]>([]);

  const loadAvailableSizes = async () => {
    try {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, width, height, description')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      setSizes((data || []).map((r: any) => ({
        id: r.id,
        name: String(r.name || ''),
        width: r.width ?? null,
        height: r.height ?? null,
        description: r.description ?? null,
      })));
    } catch (error) {
      console.error('Error loading sizes:', error);
      toast.error('خطأ في تحميل المقاسات');
    }
  };

  const loadTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('installation_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (error) throw error;

      if (data) {
        setTeams(data.map((team: any) => ({
          id: String(team.id),
          team_name: String(team.team_name || ''),
          sizes: Array.isArray(team.sizes) ? team.sizes : undefined,
          sizes_ids: Array.isArray(team.sizes_ids) ? team.sizes_ids.map((x: any) => String(x)) : undefined,
          notes: team.notes ?? null,
          created_at: team.created_at,
          updated_at: team.updated_at,
        })));
      }
    } catch (error) {
      const msg = (error as any)?.message || JSON.stringify(error);
      console.error('Error loading teams:', msg);
      toast.error('خطأ في تحميل فرق التركيب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
    loadAvailableSizes();
  }, []);

  const handleOpenDialog = (team?: InstallationTeam) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        team_name: team.team_name,
        sizesIds: (team.sizes_ids ?? []).map(String),
        notes: String(team.notes ?? ''),
      });
    } else {
      setEditingTeam(null);
      setFormData({
        team_name: '',
        sizesIds: [],
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTeam(null);
    setFormData({
      team_name: '',
      sizesIds: [],
      notes: '',
    });
  };

  const handleSaveTeam = async () => {
    if (!formData.team_name.trim()) {
      toast.error('يرجى إدخال اسم الفرقة');
      return;
    }

    // Prepare payloads: prefer sizes_ids + notes; fallback to legacy sizes (names)
    const idToName = new Map(sizes.map((s) => [String(s.id), s.name] as const));
    const legacyNames = formData.sizesIds.map((id) => idToName.get(id)).filter(Boolean) as string[];

    try {
      if (editingTeam) {
        // Try new schema first
        const { error } = await supabase
          .from('installation_teams')
          .update({
            team_name: formData.team_name,
            sizes_ids: formData.sizesIds,
            notes: formData.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTeam.id);

        if (error) {
          // Retry legacy columns
          const { error: err2 } = await supabase
            .from('installation_teams')
            .update({
              team_name: formData.team_name,
              sizes: legacyNames,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editingTeam.id);
          if (err2) throw err2;
        }
        toast.success('تم تحديث الفرقة بنجاح');
      } else {
        // Insert new schema first
        const { error } = await supabase
          .from('installation_teams')
          .insert([{ team_name: formData.team_name, sizes_ids: formData.sizesIds, notes: formData.notes || null }]);

        if (error) {
          // Retry legacy insert
          const { error: err2 } = await supabase
            .from('installation_teams')
            .insert([{ team_name: formData.team_name, sizes: legacyNames }]);
          if (err2) throw err2;
        }
        toast.success('تم إضافة الفرقة بنجاح');
      }

      handleCloseDialog();
      loadTeams();
    } catch (error) {
      console.error('Error saving team:', error);
      toast.error('خطأ في حفظ الفرقة');
    }
  };

  const handleDeleteTeam = async () => {
    if (!deletingTeamId) return;

    try {
      const { error } = await supabase
        .from('installation_teams')
        .delete()
        .eq('id', deletingTeamId);

      if (error) throw error;

      toast.success('تم حذف الفرقة بنجاح');
      setIsDeleteDialogOpen(false);
      setDeletingTeamId(null);
      loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      toast.error('خطأ في حذف الفرقة');
    }
  };

  const handleOpenDeleteDialog = (teamId: string) => {
    setDeletingTeamId(teamId);
    setIsDeleteDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">إدارة فرق التركيب</h1>
              <p className="text-muted-foreground">إدارة فرق التركيب والمقاسات المرتبطة بها</p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة فرقة جديدة
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة فرق التركيب</CardTitle>
            <CardDescription>
              عرض وإدارة جميع فرق التركيب في ال��ظام
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">لا توجد فرق تركيب حالياً</p>
                <Button onClick={() => handleOpenDialog()} className="mt-4">
                  إضافة فرقة جديدة
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم الفرقة</TableHead>
                    <TableHead>المقاسات المختصة</TableHead>
                    <TableHead>الملاحظات</TableHead>
                    <TableHead>عدد المقاسات</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => {
                    const idToLabel = new Map(
                      sizes.map((s) => [String(s.id), `${s.name}${s.width && s.height ? ` (${s.width}x${s.height})` : ''}${s.description ? ` — ${s.description}` : ''}`] as const),
                    );
                    const labels = (team.sizes_ids ?? []).map((id) => idToLabel.get(String(id))).filter(Boolean) as string[];
                    const legacyLabels = team.sizes ?? [];
                    const display = labels.length ? labels : legacyLabels;
                    return (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium">{team.team_name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {display.slice(0, 3).map((lab, index) => (
                              <span
                                key={index}
                                className="inline-block px-2 py-1 text-xs bg-primary/10 text-primary rounded"
                              >
                                {lab}
                              </span>
                            ))}
                            {display.length > 3 && (
                              <span className="inline-block px-2 py-1 text-xs bg-muted text-muted-foreground rounded">
                                +{display.length - 3}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{team.notes || ''}</TableCell>
                        <TableCell>{display.length}</TableCell>
                        <TableCell>
                          {new Date(team.created_at).toLocaleDateString('ar-LY')}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(team)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDeleteDialog(team.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? 'تعديل فرقة التركيب' : 'إضافة فرقة تركيب جديدة'}
              </DialogTitle>
              <DialogDescription>
                قم بإدخال اسم الفرقة واختيار المقاسات المرتبطة بها
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="team_name">اسم الفرقة</Label>
                <Input
                  id="team_name"
                  placeholder="مثال: فرقة ال��ركيب الأولى"
                  value={formData.team_name}
                  onChange={(e) => setFormData({ ...formData, team_name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
              <Label htmlFor="sizes">المقاسات المرتبطة</Label>
              <MultiSelect
                options={sizes.map((s) => ({
                  value: String(s.id),
                  label: `${s.name}${s.width && s.height ? ` (${s.width}x${s.height})` : ''}${s.description ? ` — ${s.description}` : ''}`,
                }))}
                value={formData.sizesIds}
                onChange={(next) => setFormData({ ...formData, sizesIds: next })}
                placeholder="اختر المقاسات..."
              />
              <p className="text-xs text-muted-foreground">
                اختر المقاسات التي ستقوم هذه الفرقة بتركيبها
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">الملاحظات</Label>
              <Textarea
                id="notes"
                placeholder="ملاحظات إضافية عن الفرقة أو المهام"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                إلغاء
              </Button>
              <Button onClick={handleSaveTeam}>
                {editingTeam ? 'حفظ التعديلات' : 'إضافة الفرقة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه الفرقة؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingTeamId(null)}>
                إلغاء
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
