import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare, Plus, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getMyTickets,
  getUnreadReplyCount,
  markTicketReplyRead,
  type SupportTicket,
} from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import AppLayout from '@/components/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type TicketType = 'bug' | 'feature' | 'question' | 'other';

const TICKET_TYPE_OPTIONS: { value: TicketType; label: string }[] = [
  { value: 'bug', label: '버그/오류' },
  { value: 'feature', label: '기능 요청' },
  { value: 'question', label: '사용 질문' },
  { value: 'other', label: '기타' },
];

const STATUS_LABEL: Record<string, string> = {
  open: '접수됨',
  in_progress: '처리중',
  resolved: '완료',
  closed: '종료',
};

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'outline'> = {
  open: 'secondary',
  in_progress: 'default',
  resolved: 'outline',
  closed: 'secondary',
};

export default function Support() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketType, setTicketType] = useState<TicketType>('question');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support_tickets'],
    queryFn: getMyTickets,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('로그인이 필요합니다.');

      const res = await supabase.functions.invoke('submit-ticket', {
        body: { ticket_type: ticketType, title, content },
      });

      if (res.error) throw res.error;
      const result = res.data as { ok: boolean; error?: string };
      if (!result.ok) throw new Error(result.error ?? '문의 접수 실패');
      return result;
    },
    onSuccess: () => {
      toast.success('문의가 접수되었습니다.');
      setTitle('');
      setContent('');
      setTicketType('question');
      setView('list');
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const readMutation = useMutation({
    mutationFn: (ticketId: string) => markTicketReplyRead(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['unread_reply_count'] });
    },
  });

  function openDetail(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setView('detail');
    if (ticket.admin_reply && !ticket.reply_read_at) {
      readMutation.mutate(ticket.id);
    }
  }

  return (
    <AppLayout title="문의하기">
      <div className="space-y-4">

        {/* 헤더 */}
        <div className="flex items-center gap-2">
          {view !== 'list' && (
            <Button variant="ghost" size="icon" onClick={() => setView('list')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <h1 className="font-display text-2xl font-bold">
            {view === 'list' ? '문의하기' : view === 'new' ? '새 문의' : '문의 상세'}
          </h1>
          {view === 'list' && (
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => setView('new')}
            >
              <Plus className="w-4 h-4 mr-1" />
              새 문의
            </Button>
          )}
        </div>

        {/* 목록 */}
        {view === 'list' && (
          <div className="space-y-3">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-8">불러오는 중...</p>
            )}
            {!isLoading && tickets.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  접수된 문의가 없습니다.
                </p>
                <Button size="sm" onClick={() => setView('new')}>
                  첫 문의 남기기
                </Button>
              </div>
            )}
            {tickets.map((ticket) => {
              const hasUnread = !!ticket.admin_reply && !ticket.reply_read_at;
              return (
                <Card
                  key={ticket.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => openDetail(ticket)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={STATUS_VARIANT[ticket.status] ?? 'secondary'} className="text-xs shrink-0">
                            {STATUS_LABEL[ticket.status] ?? ticket.status}
                          </Badge>
                          {hasUnread && (
                            <Badge variant="default" className="text-xs bg-blue-500 shrink-0">답변</Badge>
                          )}
                          <span className="text-sm font-medium truncate">{ticket.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(ticket.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* 새 문의 폼 */}
        {view === 'new' && (
          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">문의 유형</Label>
                <RadioGroup
                  value={ticketType}
                  onValueChange={(v) => setTicketType(v as TicketType)}
                  className="grid grid-cols-2 gap-2"
                >
                  {TICKET_TYPE_OPTIONS.map(({ value, label }) => (
                    <div key={value} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <RadioGroupItem value={value} id={`type-${value}`} />
                      <Label htmlFor={`type-${value}`} className="text-sm cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-title" className="text-sm font-medium">제목</Label>
                <Input
                  id="ticket-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="문의 제목을 입력하세요"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-content" className="text-sm font-medium">내용</Label>
                <Textarea
                  id="ticket-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="문의 내용을 자세히 입력해주세요"
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">{content.length}/2000</p>
              </div>

              <Button
                className="w-full"
                disabled={!title.trim() || !content.trim() || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                접수하기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 상세 */}
        {view === 'detail' && selectedTicket && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={STATUS_VARIANT[selectedTicket.status] ?? 'secondary'}>
                    {STATUS_LABEL[selectedTicket.status] ?? selectedTicket.status}
                  </Badge>
                  <CardTitle className="text-base">{selectedTicket.title}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedTicket.created_at).toLocaleString('ko-KR')}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{selectedTicket.content}</p>
              </CardContent>
            </Card>

            {/* 대화 스레드 */}
            <div className="space-y-3">
              {/* 내 문의 말풍선 */}
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3">
                  <p className="text-xs font-medium mb-1 opacity-80">나의 문의</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedTicket.content}</p>
                  <p className="text-xs opacity-60 mt-1.5 text-right">
                    {new Date(selectedTicket.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>

              {/* 개발팀 답변 말풍선 */}
              {selectedTicket.admin_reply ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] space-y-1">
                    <p className="text-xs text-muted-foreground pl-1">벧엘구역 개발팀</p>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm whitespace-pre-wrap">{selectedTicket.admin_reply}</p>
                      {selectedTicket.replied_at && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(selectedTicket.replied_at).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  아직 답변이 등록되지 않았습니다. 답변이 오면 알림을 보내드립니다.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
