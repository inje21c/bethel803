import { useDistrict } from '@/lib/districtContext';
import { useAuth } from '@/lib/authContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function DistrictSelector() {
  const { isMaster } = useAuth();
  const { currentDistrictId, districts, switchDistrict } = useDistrict();

  if (!isMaster || districts.length <= 1) return null;

  return (
    <Select value={currentDistrictId} onValueChange={switchDistrict}>
      <SelectTrigger className="h-7 text-xs w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {districts.map(d => (
          <SelectItem key={d.id} value={d.id} className="text-xs">
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
