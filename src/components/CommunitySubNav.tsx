import { Link, useLocation } from 'react-router-dom';
import { MessageSquareHeart, BookOpen, CalendarDays, BookMarked } from 'lucide-react';

const tabs = [
  { path: '/bible-study',     label: '성경공부', icon: BookOpen },
  { path: '/prayer-requests', label: '기도제목', icon: MessageSquareHeart },
  { path: '/schedule',        label: '일정',     icon: CalendarDays },
  { path: '/bible-reading',   label: '성경읽기', icon: BookMarked },
];

export default function CommunitySubNav() {
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 overflow-x-auto scrollbar-none">
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = pathname.startsWith(path);
        return (
          <Link
            key={path}
            to={path}
            className={`flex flex-1 shrink-0 items-center justify-center gap-1 px-2.5 py-2 text-[13px] font-medium rounded-lg transition-colors whitespace-nowrap ${
              active
                ? 'bg-background text-foreground border border-border/40'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
