import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, CheckCircle2, Circle, Pencil } from 'lucide-react';
import { store, PrayerRequest } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { toast } from 'sonner';

export default function PrayerRequests() {
  const user = store.getUser();
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    setPrayers(store.getPrayers());
  }, []);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    const newPrayer: PrayerRequest = {
      id: Date.now().toString(),
      userId: user?.id || '',
      userName: user?.name || '',
      content: newContent.trim(),
      response: '',
      answered: false,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const updated = [newPrayer, ...prayers];
    setPrayers(updated);
    store.savePrayers(updated);
    setNewContent('');
    toast.success('기도제목이 등록되었습니다.');
  };

  const handleResponse = (id: string) => {
    const updated = prayers.map(p =>
      p.id === id ? { ...p, response: responseText, answered: true, updatedAt: new Date().toISOString().slice(0, 10) } : p
    );
    setPrayers(updated);
    store.savePrayers(updated);
    setEditingId(null);
    setResponseText('');
    toast.success('기도 응답이 기록되었습니다!');
  };

  return (
    <AppLayout>
      <div className="space-y-5 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-bold">기도제목</h1>

        {/* Add new */}
        <div className="card-elevated p-4 space-y-3">
          <Input
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="새 기도제목을 입력하세요..."
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Button onClick={handleAdd} size="sm" className="gap-1">
            <Plus className="w-3.5 h-3.5" /> 등록
          </Button>
        </div>

        {/* List */}
        <div className="space-y-3">
          {prayers.map((prayer, i) => (
            <motion.div
              key={prayer.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card-elevated p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {prayer.answered ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{prayer.userName}</span>
                    <span className="text-xs text-muted-foreground">{prayer.createdAt}</span>
                  </div>
                  <p className="text-sm">{prayer.content}</p>

                  {prayer.answered && prayer.response && (
                    <div className="mt-2 bg-success/10 rounded-md p-2.5">
                      <p className="text-xs font-medium text-success mb-0.5">🙏 응답</p>
                      <p className="text-xs text-foreground">{prayer.response}</p>
                    </div>
                  )}

                  {editingId === prayer.id && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder="기도 응답 내용을 작성하세요..."
                        className="text-sm min-h-[60px]"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleResponse(prayer.id)}>저장</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                      </div>
                    </div>
                  )}

                  {!prayer.answered && editingId !== prayer.id && (
                    <button
                      onClick={() => { setEditingId(prayer.id); setResponseText(prayer.response); }}
                      className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> 응답 기록
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
