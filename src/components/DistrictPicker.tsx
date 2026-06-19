import { useEffect, useState } from 'react';
import { getActiveDistricts } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface DistrictPickerProps {
  value: string;
  onChange: (id: string) => void;
}

export default function DistrictPicker({ value, onChange }: DistrictPickerProps) {
  const [districts, setDistricts] = useState<{ id: string; name: string; churchName: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveDistricts()
      .then(list => {
        setDistricts(list);
        // 구역이 1개면 자동 선택
        if (list.length === 1 && !value) {
          onChange(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 구역이 1개면 숨김
  if (!loading && districts.length <= 1) return null;

  // 교회가 2개 이상이면 교회명 표시
  const multiChurch = new Set(districts.map(d => d.churchName)).size > 1;

  return (
    <div className="space-y-2">
      <Label htmlFor="district-picker">소속 구역</Label>
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger id="district-picker">
          <SelectValue placeholder={loading ? '구역 목록 로딩 중...' : '구역을 선택하세요'} />
        </SelectTrigger>
        <SelectContent>
          {districts.map(d => (
            <SelectItem key={d.id} value={d.id}>
              {multiChurch ? `${d.name} (${d.churchName})` : d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
