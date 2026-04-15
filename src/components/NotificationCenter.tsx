import { useEffect, useState } from 'react';
import { Bell, Trash2, Plus, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/authContext';
import { useDistrict } from '@/lib/districtContext';
import {
  getNotifications,
  markNotificationRead,
  createNotification,
  deleteNotification,
  dispatchNotificationPush,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function NotificationCenter() {
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [canLoadNotifications, setCanLoadNotifications] = useState(false);

  useEffect(() => {
    setCanLoadNotifications(false);

    if (!user?.id || !currentDistrictId) return;

    const timer = window.setTimeout(() => setCanLoadNotifications(true), 1200);
    return () => window.clearTimeout(timer);
  }, [user?.id, currentDistrictId]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.id, currentDistrictId],
    queryFn: () => getNotifications(user!.id, currentDistrictId),
    enabled: !!user && !!currentDistrictId && canLoadNotifications,
    refetchInterval: open ? 60_000 : false,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id, user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const notification = await createNotification({
        title: newTitle.trim(),
        body: newBody.trim(),
        createdBy: user!.id,
        districtId: currentDistrictId,
      });

      try {
        const dispatch = await dispatchNotificationPush(notification.id);
        return { pushSent: dispatch.sentCount ?? dispatch.targetCount ?? 0 };
      } catch (error) {
        const message = error instanceof Error ? error.message : '푸시 발송에 실패했습니다.';
        return { pushSent: 0, pushError: message };
      }
    },
    onSuccess: ({ pushSent, pushError }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setNewTitle('');
      setNewBody('');
      setShowForm(false);
      if (pushError) {
        toast.warning(`알림은 저장됐지만 푸시 발송은 실패했습니다. ${pushError}`);
        return;
      }
      toast.success(pushSent > 0 ? `알림을 발행하고 ${pushSent}건 푸시를 보냈습니다.` : '알림을 발행했습니다.');
    },
    onError: () => toast.error('알림 발행에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // 안 읽은 알림을 순차적으로 읽음 처리 (동시 N개 요청 방지)
      const unread = notifications.filter(n => !n.isRead);
      unread.reduce(
        (chain, n) => chain.then(() => markNotificationRead(n.id, user!.id)),
        Promise.resolve()
      ).then(() => {
        if (unread.length > 0) queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }).catch(() => {});
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">알림</span>
          {(user?.role === 'leader' || user?.role === 'master') && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => setShowForm(v => !v)}
            >
              {showForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {showForm ? '취소' : '발행'}
            </Button>
          )}
        </div>

        {showForm && (
          <div className="p-4 border-b space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">제목</Label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="알림 제목"
                className="h-8 text-sm"
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">내용</Label>
              <Textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                placeholder="알림 내용"
                className="text-sm"
                rows={3}
                maxLength={500}
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!newTitle.trim() || !newBody.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              발행
            </Button>
          </div>
        )}

        <div className="max-h-72 overflow-y-auto divide-y">
          {notifications.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">알림이 없습니다.</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className={`px-4 py-3 flex gap-3 ${n.isRead ? '' : 'bg-primary/5'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(n.createdAt), 'MM/dd HH:mm')}
                  </p>
                </div>
                {(user?.role === 'leader' || user?.role === 'master') && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(n.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
