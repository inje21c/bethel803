import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Users, RefreshCw, Pencil, X, ChevronRight, Mail, KeyRound, Trash2, RotateCcw, AlertTriangle, Crown } from 'lucide-react';
import {
  getAllChurchesSuperAdmin, updateChurchSuperAdmin, resetMasterPassword,
  restoreChurchSuperAdmin, hardDeleteChurchSuperAdmin,
  getChurchMembersSuperAdmin, changeMasterSuperAdmin,
  type SuperAdminChurch, type ChurchMemberBasic,
} from '@/lib/api';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const PLAN_OPTIONS = ['legacy', 'free', 'starter', 'standard', 'premium'];
const STATUS_OPTIONS = ['active', 'trialing', 'past_due', 'suspended', 'archived'];
const BILLING_OPTIONS = ['manual', 'trialing', 'active', 'past_due', 'canceled'];
const UI_MODE_OPTIONS = ['simple', 'full'];
const QT_MODE_OPTIONS = [
  { value: 'simple',  label: 'simple',  desc: '자체 성경 구절' },
  { value: 'scraped', label: 'scraped', desc: '매일성경 스크래핑' },
];

const PLAN_COLORS: Record<string, string> = {
  legacy:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  free:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  starter:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  standard: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  premium:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};
const QT_MODE_COLORS: Record<string, string> = {
  simple:  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  scraped: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  admin:   'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
};
const STATUS_COLORS: Record<string, string> = {
  active:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  past_due: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  suspended:'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const cls = colorMap[value] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  );
}

function trialDaysLeft(endsAt: string | null): string {
  if (!endsAt) return '-';
  const diff = Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
  if (diff < 0) return '만료';
  return `D-${diff}`;
}

function toLocalDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

interface EditState {
  plan: string;
  status: string;
  billing_status: string;
  trial_ends_at: string;
  ui_mode: string;
  qt_mode: string;
}

function EditModal({
  church,
  onClose,
}: {
  church: SuperAdminChurch;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EditState>({
    plan:           church.plan,
    status:         church.status,
    billing_status: church.billing_status,
    trial_ends_at:  toLocalDateInput(church.trial_ends_at),
    ui_mode:        church.ui_mode,
    qt_mode:        church.qt_mode ?? 'simple',
  });

  const mutation = useMutation({
    mutationFn: () =>
      updateChurchSuperAdmin({
        churchId:      church.id,
        plan:          form.plan,
        status:        form.status,
        billingStatus: form.billing_status,
        trialEndsAt:   form.trial_ends_at ? `${form.trial_ends_at}T00:00:00Z` : null,
        uiMode:        form.ui_mode,
        qtMode:        form.qt_mode,
      }),
    onSuccess: () => {
      toast.success(`${church.name} 업데이트 완료`);
      qc.invalidateQueries({ queryKey: ['superadmin_churches'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(key: keyof EditState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{church.name}</p>
            <p className="text-xs text-muted-foreground">{church.slug}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* plan */}
          <div className="space-y-1">
            <Label className="text-xs">Plan</Label>
            <select
              value={form.plan}
              onChange={e => set('plan', e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {PLAN_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* status */}
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* billing_status */}
          <div className="space-y-1">
            <Label className="text-xs">Billing Status</Label>
            <select
              value={form.billing_status}
              onChange={e => set('billing_status', e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {BILLING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* trial_ends_at */}
          <div className="space-y-1">
            <Label className="text-xs">Trial 종료일 (비우면 제거)</Label>
            <Input
              type="date"
              value={form.trial_ends_at}
              onChange={e => set('trial_ends_at', e.target.value)}
            />
          </div>

          {/* ui_mode */}
          <div className="space-y-1">
            <Label className="text-xs">UI Mode</Label>
            <div className="flex gap-2">
              {UI_MODE_OPTIONS.map(o => (
                <button
                  key={o}
                  onClick={() => set('ui_mode', o)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    form.ui_mode === o
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* qt_mode */}
          <div className="space-y-1">
            <Label className="text-xs">QT 방식</Label>
            <div className="flex gap-2">
              {QT_MODE_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => set('qt_mode', o.value)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    form.qt_mode === o.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="block">{o.label}</span>
                  <span className="block text-[10px] font-normal opacity-70">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button
          className="w-full"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? '저장 중...' : '저장'}
          {!mutation.isPending && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}

function MasterChangeModal({
  church,
  onClose,
}: {
  church: SuperAdminChurch;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const { data: members = [], isLoading } = useQuery<ChurchMemberBasic[]>({
    queryKey: ['church_members_superadmin', church.id],
    queryFn: () => getChurchMembersSuperAdmin(church.id),
  });

  const mutation = useMutation({
    mutationFn: () => changeMasterSuperAdmin(church.id, selectedId),
    onSuccess: () => {
      toast.success('마스터가 변경되었습니다.');
      qc.invalidateQueries({ queryKey: ['superadmin_churches'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedMember = members.find(m => m.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-500" />
              마스터 강제 변경
            </p>
            <p className="text-xs text-muted-foreground">{church.name}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">새 마스터 선택</Label>
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setConfirmed(false); }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <option value="">-- 선택 --</option>
                {members.filter(m => m.role !== 'master').map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role === 'leader' ? '구역장' : '구역원'}) — {m.district_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedMember && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 space-y-1 dark:bg-amber-900/20 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">변경 내용</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  현 마스터({church.master_name ?? '-'}) → 구역장 강등
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {selectedMember.name} → 마스터 승격
                </p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-xs text-amber-800 dark:text-amber-300 font-medium">변경 사항을 확인했습니다</span>
                </label>
              </div>
            )}

            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              disabled={!selectedId || !confirmed || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? '변경 중...' : '마스터 변경'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuperAdmin() {
  const [editing, setEditing] = useState<SuperAdminChurch | null>(null);
  const [masterChanging, setMasterChanging] = useState<SuperAdminChurch | null>(null);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const qc = useQueryClient();

  async function handleRestore(churchId: string) {
    setActionLoading(`restore-${churchId}`);
    try {
      await restoreChurchSuperAdmin(churchId);
      toast.success('교회 복구 완료');
      qc.invalidateQueries({ queryKey: ['superadmin_churches'] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setActionLoading(null); }
  }

  async function handleHardDelete(church: SuperAdminChurch) {
    if (!confirm(`[${church.name}] 데이터를 영구 삭제합니다. 되돌릴 수 없습니다. 계속하시겠습니까?`)) return;
    setActionLoading(`delete-${church.id}`);
    try {
      await hardDeleteChurchSuperAdmin(church.id);
      toast.success(`${church.name} 영구 삭제 완료`);
      qc.invalidateQueries({ queryKey: ['superadmin_churches'] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setActionLoading(null); }
  }

  async function handleResetPassword(email: string) {
    setResettingEmail(email);
    try {
      await resetMasterPassword(email);
      toast.success(`${email}으로 비밀번호 재설정 이메일을 발송했습니다`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResettingEmail(null);
    }
  }

  const { data: churches = [], isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin_churches'],
    queryFn: getAllChurchesSuperAdmin,
    staleTime: 1000 * 30,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="text-center py-20 space-y-2">
          <p className="font-semibold text-destructive">접근 권한이 없습니다</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {editing && <EditModal church={editing} onClose={() => setEditing(null)} />}
      {masterChanging && <MasterChangeModal church={masterChanging} onClose={() => setMasterChanging(null)} />}

      <div className="space-y-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">슈퍼어드민</h1>
            <p className="text-sm text-muted-foreground">교회 {churches.length}개</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            새로고침
          </Button>
        </div>

        {/* 교회 목록 */}
        <div className="space-y-3">
          {churches.map(church => (
            <div key={church.id} className="rounded-2xl border bg-card p-4 space-y-3">
              {/* 상단: 교회명 + 편집 */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold truncate">{church.name}</p>
                  <p className="text-xs text-muted-foreground">{church.slug}</p>
                </div>
                <button
                  onClick={() => setEditing(church)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* 뱃지 */}
              <div className="flex flex-wrap gap-1.5">
                <Badge value={church.plan} colorMap={PLAN_COLORS} />
                <Badge value={church.status} colorMap={STATUS_COLORS} />
                <Badge value={church.qt_mode ?? 'simple'} colorMap={QT_MODE_COLORS} />
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  church.ui_mode === 'simple'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {church.ui_mode}
                </span>
              </div>

              {/* 마스터 정보 */}
              {church.master_name && (
                <div className="rounded-lg bg-muted/50 px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{church.master_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {church.master_email}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {church.master_email && (
                        <button
                          onClick={() => handleResetPassword(church.master_email!)}
                          disabled={resettingEmail === church.master_email}
                          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          <KeyRound className="w-3 h-3" />
                          {resettingEmail === church.master_email ? '발송 중...' : 'PW 초기화'}
                        </button>
                      )}
                      <button
                        onClick={() => setMasterChanging(church)}
                        className="flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-[11px] font-medium text-amber-600 hover:bg-amber-50 transition-colors dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20"
                      >
                        <Crown className="w-3 h-3" />
                        마스터 변경
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 삭제 예정 상태 */}
              {church.deleted_at && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-destructive font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    삭제 예정 — {new Date(church.deleted_at).toLocaleDateString('ko-KR')} 영구 삭제
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRestore(church.id)}
                      disabled={actionLoading === `restore-${church.id}`}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-primary/30 bg-primary/5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {actionLoading === `restore-${church.id}` ? '복구 중...' : '복구'}
                    </button>
                    <button
                      onClick={() => handleHardDelete(church)}
                      disabled={actionLoading === `delete-${church.id}`}
                      className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {actionLoading === `delete-${church.id}` ? '삭제 중...' : '영구 삭제'}
                    </button>
                  </div>
                </div>
              )}

              {/* 수치 */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  구역 {church.district_count}개
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  구역원 {church.member_count}명
                </span>
                {church.trial_ends_at && (
                  <span className={`font-medium ${
                    trialDaysLeft(church.trial_ends_at) === '만료'
                      ? 'text-destructive'
                      : 'text-primary'
                  }`}>
                    Trial {trialDaysLeft(church.trial_ends_at)}
                  </span>
                )}
                <span className="ml-auto">
                  {new Date(church.created_at).toLocaleDateString('ko-KR')} 가입
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
