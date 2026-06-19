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
    <div className="flex gap-1 mb-5 border-b pb-0">
      {tabs.map(({ path, label, icon: Icon }) => {
        const active = pathname.startsWith(path);
        return (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
