import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Edit, Power } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDistricts, createDistrict, updateDistrict, deactivateDistrict } from '@/lib/api';
import type { District } from '@/lib/districtContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function DistrictForm({ district, onSave, onClose }: {
  district?: District;
  onSave: (params: { name: string; description: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(district?.name ?? '');
  const [description, setDescription] = useState(district?.description ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('구역 이름을 입력해주세요.');
      return;
    }
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="district-name">구역 이름</Label>
        <Input id="district-name" value={name} onChange={e => setName(e.target.value)} placeholder="예: 킨텍스장성남" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="district-desc">설명 (선택)</Label>
        <Textarea id="district-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="구역 설명" rows={3} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        <Button type="submit">{district ? '수정' : '생성'}</Button>
      </div>
    </form>
  );
}

export default function DistrictManagement() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<District | undefined>();
  const [deactivateTarget, setDeactivateTarget] = useState<District | undefined>();

  const { data: districts = [], isLoading } = useQuery({
    queryKey: ['districts'],
    queryFn: getDistricts,
  });

  const createMutation = useMutation({
    mutationFn: createDistrict,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      toast.success('구역이 생성되었습니다.');
    },
    onError: () => toast.error('구역 생성에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...params }: { id: string; name: string; description: string }) =>
      updateDistrict({ id, ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      toast.success('구역이 수정되었습니다.');
    },
    onError: () => toast.error('구역 수정에 실패했습니다.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateDistrict,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      toast.success('구역이 비활성화되었습니다.');
    },
    onError: () => toast.error('구역 비활성화에 실패했습니다.'),
  });

  const handleSave = (params: { name: string; description: string }) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, ...params });
    } else {
      createMutation.mutate(params);
    }
  };

  const openCreate = () => { setEditTarget(undefined); setFormOpen(true); };
  const openEdit = (d: District) => { setEditTarget(d); setFormOpen(true); };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" /> 구역 관리
            </h1>
            <p className="text-muted-foreground text-sm mt-1">구역 생성, 수정, 비활성화</p>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> 새 구역
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">로딩 중...</div>
        ) : (
          <div className="space-y-3">
            {districts.map((d, idx) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {d.name}
                        <Badge variant={d.isActive ? 'default' : 'secondary'}>
                          {d.isActive ? '활성' : '비활성'}
                        </Badge>
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)} title="수정">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {d.isActive && (
                          <Button variant="ghost" size="icon" onClick={() => setDeactivateTarget(d)} title="비활성화">
                            <Power className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {d.description && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">{d.description}</p>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editTarget ? '구역 수정' : '새 구역 생성'}</DialogTitle>
            </DialogHeader>
            <DistrictForm
              district={editTarget}
              onSave={handleSave}
              onClose={() => setFormOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(undefined)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>구역 비활성화</AlertDialogTitle>
              <AlertDialogDescription>
                "{deactivateTarget?.name}" 구역을 비활성화하시겠습니까?
                구역원 데이터는 유지되지만 새 가입이 불가합니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deactivateTarget) deactivateMutation.mutate(deactivateTarget.id);
                  setDeactivateTarget(undefined);
                }}
              >
                비활성화
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
