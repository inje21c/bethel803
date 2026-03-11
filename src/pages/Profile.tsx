import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Save } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { updateUserName } from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export default function Profile() {
  const { user, updatePassword, refreshProfile } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [nameLoading, setNameLoading] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleNameSave = async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setNameLoading(true);
    try {
      await updateUserName(user!.id, name.trim());
      await refreshProfile();
      toast.success('이름이 변경되었습니다.');
    } catch {
      toast.error('이름 변경에 실패했습니다.');
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPw.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setPwLoading(true);
    try {
      await updatePassword(newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      toast.success('비밀번호가 변경되었습니다.');
    } catch {
      toast.error('비밀번호 변경에 실패했습니다. 다시 로그인 후 시도해 주세요.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">내 프로필</h1>
          <p className="text-sm text-muted-foreground mt-1">계정 정보를 확인하고 변경하세요.</p>
        </div>

        {/* 계정 정보 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                계정 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">{user?.name?.slice(0, 1)}</span>
                </div>
                <div>
                  <p className="font-medium">{user?.name}</p>
                  <Badge variant={user?.role === 'leader' ? 'default' : 'secondary'} className="text-xs mt-0.5">
                    {user?.role === 'leader' ? '구역장' : '구역원'}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="name">이름 변경</Label>
                <div className="flex gap-2">
                  <Input
                    id="name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="변경할 이름"
                    maxLength={20}
                  />
                  <Button
                    size="sm"
                    disabled={nameLoading || !name.trim() || name.trim() === user?.name}
                    onClick={handleNameSave}
                    className="shrink-0 gap-1"
                  >
                    {nameLoading
                      ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      : <Save className="w-4 h-4" />
                    }
                    저장
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 비밀번호 변경 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="w-4 h-4" />
                비밀번호 변경
              </CardTitle>
              <CardDescription>6자 이상의 새 비밀번호를 입력하세요.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPw">새 비밀번호</Label>
                  <Input
                    id="newPw"
                    type="password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    placeholder="새 비밀번호 (6자 이상)"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPw">새 비밀번호 확인</Label>
                  <Input
                    id="confirmPw"
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="새 비밀번호 재입력"
                    minLength={6}
                    required
                  />
                  {confirmPw && newPw !== confirmPw && (
                    <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={pwLoading || !newPw || newPw !== confirmPw}>
                  {pwLoading
                    ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    : null
                  }
                  비밀번호 변경
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
