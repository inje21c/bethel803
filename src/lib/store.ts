// Local storage based store for prototype
export type UserRole = 'leader' | 'member';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface BibleStudy {
  id: string;
  date: string;
  weekNumber: number;
  title: string;
  scripture: string;
  introduction: string;
  questions: string[];
  published?: boolean;
}

export interface StudyAnswer {
  studyId: string;
  userId: string;
  userName: string;
  answers: Record<number, string>;
  completed: boolean;
}

export interface PrayerRequest {
  id: string;
  userId: string;
  userName: string;
  content: string;
  response: string;
  answered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BibleReadingLog {
  id: string;
  userId: string;
  date: string;
  chapters: number;
}

export interface Schedule {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  memo: string;
  attendanceCheck: boolean;
  attachment?: string;
  createdBy: string;
  createdAt: string;
}

export interface Attendance {
  scheduleId: string;
  userId: string;
  userName: string;
  status: 'attending' | 'absent' | 'pending';
  updatedAt: string;
}

export interface WeeklyAttendance {
  id: string;
  userId: string;
  userName: string;
  weekDate: string;
  attended: boolean;
}

// Mock data
export const mockStudies: BibleStudy[] = [
  {
    id: '1',
    date: '2026-03-08',
    weekNumber: 10,
    title: '하나님의 사랑과 은혜',
    scripture: '요한복음 3:16-21',
    introduction: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라. 이번 주 우리는 하나님의 무한한 사랑과 은혜에 대해 함께 나누겠습니다.',
    questions: [
      '요한복음 3:16에서 "세상을 이처럼 사랑하사"라는 말씀에서 하나님의 사랑의 크기를 어떻게 느끼시나요?',
      '독생자를 주셨다는 것은 어떤 의미인지 나눠봅시다.',
      '믿는 자마다 영생을 얻는다는 약속이 여러분의 삶에 어떤 확신을 주나요?',
      '하나님의 사랑을 경험한 구체적인 사례를 나눠주세요.',
      '이 말씀을 통해 이번 주 실천할 수 있는 것은 무엇일까요?',
      '주변에 하나님의 사랑을 전할 대상이 있다면 누구인가요?',
    ],
  },
  {
    id: '2',
    date: '2026-03-01',
    weekNumber: 9,
    title: '믿음의 반석 위에',
    scripture: '마태복음 7:24-29',
    introduction: '예수님은 반석 위에 집을 짓는 자와 모래 위에 집을 짓는 자의 비유를 통해 말씀을 듣고 행하는 것의 중요성을 가르쳐 주셨습니다.',
    questions: [
      '반석 위에 집을 짓는다는 것은 우리 신앙생활에서 어떤 의미일까요?',
      '말씀을 듣기만 하고 행하지 않는 경우는 어떤 것이 있을까요?',
      '비와 바람(시련)이 왔을 때 흔들리지 않으려면 어떻게 해야 할까요?',
      '최근 말씀을 실천한 경험이 있다면 나눠주세요.',
      '이번 주 말씀을 통해 결단할 수 있는 것은 무엇인가요?',
    ],
  },
  {
    id: '3',
    date: '2026-02-22',
    weekNumber: 8,
    title: '성령의 열매',
    scripture: '갈라디아서 5:22-26',
    introduction: '성령의 열매는 사랑, 희락, 화평, 오래 참음, 자비, 양선, 충성, 온유, 절제입니다. 이 열매들이 우리 삶에서 어떻게 맺혀가는지 함께 살펴봅시다.',
    questions: [
      '성령의 9가지 열매 중 가장 필요하다고 느끼는 것은 무엇인가요?',
      '사랑의 열매가 우리 구역 안에서 어떻게 나타날 수 있을까요?',
      '오래 참음과 절제를 실천하기 어려운 상황은 어떤 것인가요?',
      '성령의 열매를 맺기 위해 우리가 해야 할 역할은 무엇일까요?',
      '이번 주 특별히 기도하며 키워가고 싶은 열매는 무엇인가요?',
    ],
  },
];

export const mockSchedules: Schedule[] = [
  {
    id: 'sched-1',
    title: '구역예배',
    date: '2026-03-13',
    time: '20:00',
    location: '김성민 집사님 댁',
    memo: '이번 주 구역예배 후 간단한 교제가 있습니다.',
    attendanceCheck: true,
    createdBy: '1',
    createdAt: '2026-03-08',
  },
  {
    id: 'sched-2',
    title: '교회 부활절 특별새벽기도회',
    date: '2026-03-30',
    time: '06:00',
    location: '벧엘교회 본당',
    memo: '3/30(월)~4/4(토) 6일간 진행됩니다.',
    attendanceCheck: false,
    createdBy: '1',
    createdAt: '2026-03-05',
  },
  {
    id: 'sched-3',
    title: '구역 야외예배',
    date: '2026-04-19',
    time: '11:00',
    location: '일산호수공원',
    memo: '도시락을 준비해주세요. 우천 시 교회 소예배실에서 진행합니다.',
    attendanceCheck: true,
    createdBy: '1',
    createdAt: '2026-03-01',
  },
];

const STORAGE_KEYS = {
  user: 'bethel-user',
  answers: 'bethel-answers',
  prayers: 'bethel-prayers',
  readings: 'bethel-readings',
  schedules: 'bethel-schedules',
  attendances: 'bethel-attendances',
};

export const store = {
  getUser: (): User | null => {
    const data = localStorage.getItem(STORAGE_KEYS.user);
    return data ? JSON.parse(data) : null;
  },
  setUser: (user: User) => localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user)),
  logout: () => localStorage.removeItem(STORAGE_KEYS.user),

  getAnswers: (userId?: string): StudyAnswer[] => {
    const data = localStorage.getItem(STORAGE_KEYS.answers);
    const all: StudyAnswer[] = data ? JSON.parse(data) : [];
    return userId ? all.filter(a => a.userId === userId) : all;
  },
  saveAnswer: (answer: StudyAnswer) => {
    const data = localStorage.getItem(STORAGE_KEYS.answers);
    const all: StudyAnswer[] = data ? JSON.parse(data) : [];
    const filtered = all.filter(a => !(a.studyId === answer.studyId && a.userId === answer.userId));
    filtered.push(answer);
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(filtered));
  },

  getPrayers: (): PrayerRequest[] => {
    const data = localStorage.getItem(STORAGE_KEYS.prayers);
    return data ? JSON.parse(data) : [
      { id: '1', userId: '1', userName: '김성민', content: '자녀들의 학업과 신앙성장을 위해', response: '', answered: false, createdAt: '2026-03-01', updatedAt: '2026-03-01' },
      { id: '2', userId: '2', userName: '이정희', content: '건강 회복을 위해 기도 부탁드립니다', response: '감사하게도 검진 결과가 좋았습니다!', answered: true, createdAt: '2026-02-15', updatedAt: '2026-03-05' },
    ];
  },
  savePrayers: (prayers: PrayerRequest[]) => localStorage.setItem(STORAGE_KEYS.prayers, JSON.stringify(prayers)),

  getReadings: (): BibleReadingLog[] => {
    const data = localStorage.getItem(STORAGE_KEYS.readings);
    return data ? JSON.parse(data) : [];
  },
  addReading: (log: BibleReadingLog) => {
    const readings = store.getReadings();
    readings.push(log);
    localStorage.setItem(STORAGE_KEYS.readings, JSON.stringify(readings));
  },

  getTotalChapters: (userId: string): number => {
    return store.getReadings()
      .filter(r => r.userId === userId && r.date.startsWith('2026'))
      .reduce((sum, r) => sum + r.chapters, 0);
  },

  // Schedule
  getSchedules: (): Schedule[] => {
    const data = localStorage.getItem(STORAGE_KEYS.schedules);
    return data ? JSON.parse(data) : mockSchedules;
  },
  addSchedule: (schedule: Schedule) => {
    const schedules = store.getSchedules();
    schedules.push(schedule);
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
  },
  updateSchedule: (schedule: Schedule) => {
    const schedules = store.getSchedules().map(s => s.id === schedule.id ? schedule : s);
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
  },
  deleteSchedule: (id: string) => {
    const schedules = store.getSchedules().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
  },

  // Attendance
  getAttendances: (scheduleId: string): Attendance[] => {
    const data = localStorage.getItem(STORAGE_KEYS.attendances);
    const all: Attendance[] = data ? JSON.parse(data) : [];
    return all.filter(a => a.scheduleId === scheduleId);
  },
  saveAttendance: (attendance: Attendance) => {
    const data = localStorage.getItem(STORAGE_KEYS.attendances);
    const all: Attendance[] = data ? JSON.parse(data) : [];
    const filtered = all.filter(a => !(a.scheduleId === attendance.scheduleId && a.userId === attendance.userId));
    filtered.push(attendance);
    localStorage.setItem(STORAGE_KEYS.attendances, JSON.stringify(filtered));
  },
};
