import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, CalendarDays, MessageSquareHeart, BookMarked, Settings, Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getBibleStudies, getSchedules, getPrayerRequests } from '@/lib/api';
import { useDistrict } from '@/lib/districtContext';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/authContext';

const NAV_ITEMS = [
  { label: '대시보드', path: '/dashboard', icon: Home },
  { label: '구역성경공부', path: '/bible-study', icon: BookOpen },
  { label: '주요일정', path: '/schedule', icon: CalendarDays },
  { label: '기도제목', path: '/prayer-requests', icon: MessageSquareHeart },
  { label: '성경읽기', path: '/bible-reading', icon: BookMarked },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentDistrictId } = useDistrict();

  // Cmd+K / Ctrl+K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const { data: studies = [] } = useQuery({
    queryKey: ['bible_studies', 'search_preview', currentDistrictId],
    queryFn: () => getBibleStudies(currentDistrictId, { limit: 5 }),
    enabled: open && !!currentDistrictId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', 'search_preview', currentDistrictId],
    queryFn: () => getSchedules(currentDistrictId, { limit: 5 }),
    enabled: open && !!currentDistrictId,
  });

  const { data: prayers = [] } = useQuery({
    queryKey: ['prayer_requests', 'search_preview', currentDistrictId],
    queryFn: () => getPrayerRequests(currentDistrictId, { limit: 5 }),
    enabled: open && !!currentDistrictId,
  });

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden md:flex items-center gap-2 text-muted-foreground text-xs h-8 px-3 w-40"
        onClick={() => setOpen(true)}
      >
        <Search className="w-3.5 h-3.5" />
        <span>검색</span>
        <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="검색어를 입력하세요..." />
        <CommandList>
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>

          {/* 메뉴 이동 */}
          <CommandGroup heading="메뉴">
            {NAV_ITEMS.map(item => (
              <CommandItem
                key={item.path}
                value={item.label}
                onSelect={() => handleSelect(item.path)}
              >
                <item.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
            {(user?.role === 'leader' || user?.role === 'master') && (
              <CommandItem value="관리자 대시보드" onSelect={() => handleSelect('/admin')}>
                <Settings className="w-4 h-4 mr-2 text-muted-foreground" />
                관리자 대시보드
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />

          {/* 성경공부 */}
          {studies.length > 0 && (
            <CommandGroup heading="성경공부">
              {studies.slice(0, 5).map(s => (
                <CommandItem
                  key={s.id}
                  value={`${s.title} ${s.scripture}`}
                  onSelect={() => handleSelect(`/bible-study/${s.id}`)}
                >
                  <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground text-xs ml-2">{s.scripture}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* 일정 */}
          {schedules.length > 0 && (
            <CommandGroup heading="일정">
              {schedules.slice(0, 5).map(s => (
                <CommandItem
                  key={s.id}
                  value={`${s.title} ${s.location}`}
                  onSelect={() => handleSelect('/schedule')}
                >
                  <CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-muted-foreground text-xs ml-2">{s.date}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {/* 기도제목 */}
          {prayers.length > 0 && (
            <CommandGroup heading="기도제목">
              {prayers.slice(0, 5).map(p => (
                <CommandItem
                  key={p.id}
                  value={`${p.content} ${p.userName}`}
                  onSelect={() => handleSelect('/prayer-requests')}
                >
                  <MessageSquareHeart className="w-4 h-4 mr-2 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground mr-1">{p.userName}</span>
                    <span className="text-sm truncate">{p.content}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
