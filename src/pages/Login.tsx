import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { store, UserRole } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, UserPlus, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      toast.error('이름과 비밀번호를 입력해주세요.');
      return;
    }
    // Prototype: leader if name contains "구역장"
    const role: UserRole = name.includes('구역장') ? 'leader' : 'member';
    store.setUser({ id: name, name: name.replace('구역장', '').trim() || name, role });
    navigate('/dashboard');
    toast.success(`환영합니다, ${name}님!`);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('구역원 등록 요청이 전달되었습니다. 구역장 승인 후 로그인 가능합니다.');
    setShowRegister(false);
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('비밀번호가 초기화되었습니다. 새 비밀번호로 로그인해주세요.');
    setShowReset(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center shadow-lg">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">벧엘교회</h1>
          <p className="text-muted-foreground text-sm mt-1">킨텍스장성남 구역</p>
        </div>

        {/* Login Form */}
        {!showRegister && !showReset && (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleLogin}
            className="card-elevated p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="이름을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호"
              />
            </div>
            <Button type="submit" className="w-full bg-primary text-primary-foreground">
              로그인
            </Button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowRegister(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <UserPlus className="w-3 h-3" />
                신규 등록 요청
              </button>
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <KeyRound className="w-3 h-3" />
                비밀번호 초기화
              </button>
            </div>
          </motion.form>
        )}

        {/* Register Form */}
        {showRegister && (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleRegister}
            className="card-elevated p-6 space-y-4"
          >
            <h2 className="font-display font-semibold text-lg">신규 구역원 등록 요청</h2>
            <div className="space-y-2">
              <Label>이름</Label>
              <Input value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="이름" />
            </div>
            <div className="space-y-2">
              <Label>연락처</Label>
              <Input value={registerPhone} onChange={e => setRegisterPhone(e.target.value)} placeholder="010-0000-0000" />
            </div>
            <Button type="submit" className="w-full">등록 요청</Button>
            <button type="button" onClick={() => setShowRegister(false)} className="text-xs text-muted-foreground w-full text-center">
              ← 로그인으로 돌아가기
            </button>
          </motion.form>
        )}

        {/* Reset Form */}
        {showReset && (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleReset}
            className="card-elevated p-6 space-y-4"
          >
            <h2 className="font-display font-semibold text-lg">비밀번호 초기화</h2>
            <div className="space-y-2">
              <Label>이름</Label>
              <Input placeholder="등록된 이름을 입력하세요" />
            </div>
            <Button type="submit" className="w-full">초기화 요청</Button>
            <button type="button" onClick={() => setShowReset(false)} className="text-xs text-muted-foreground w-full text-center">
              ← 로그인으로 돌아가기
            </button>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
}
