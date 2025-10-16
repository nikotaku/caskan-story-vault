import { useState } from "react";
import { MapPin, Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Cast {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  castId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

interface DateInfo {
  date: string;
  label: string;
  isToday: boolean;
}

interface ShiftCalendarProps {
  dates: DateInfo[];
  casts: Cast[];
  shifts: Shift[];
  onShiftUpdate: () => void;
}

export const ShiftCalendar = ({ dates, casts, shifts, onShiftUpdate }: ShiftCalendarProps) => {
  const [selectedCell, setSelectedCell] = useState<{ castId: string; date: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    startTime: "09:00",
    endTime: "18:00",
    notes: "",
  });
  
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();

  const getShiftForCastAndDate = (castId: string, date: string) => {
    return shifts.find(shift => shift.castId === castId && shift.date === date);
  };

  const handleCellClick = (castId: string, date: string) => {
    if (!isAdmin) return;
    
    const existingShift = getShiftForCastAndDate(castId, date);
    if (existingShift) {
      setFormData({
        startTime: existingShift.startTime,
        endTime: existingShift.endTime,
        notes: existingShift.notes || "",
      });
    } else {
      setFormData({
        startTime: "09:00",
        endTime: "18:00",
        notes: "",
      });
    }
    
    setSelectedCell({ castId, date });
    setIsDialogOpen(true);
  };

  const handleSaveShift = async () => {
    if (!selectedCell || !user) return;

    try {
      const existingShift = getShiftForCastAndDate(selectedCell.castId, selectedCell.date);

      if (existingShift) {
        // 更新
        const { error } = await supabase
          .from('shifts')
          .update({
            start_time: formData.startTime,
            end_time: formData.endTime,
            notes: formData.notes,
          })
          .eq('id', existingShift.id);

        if (error) throw error;

        toast({
          title: "シフト更新",
          description: "シフトが更新されました",
        });
      } else {
        // 新規作成
        const { error } = await supabase
          .from('shifts')
          .insert({
            cast_id: selectedCell.castId,
            shift_date: selectedCell.date,
            start_time: formData.startTime,
            end_time: formData.endTime,
            notes: formData.notes,
            status: 'scheduled',
            created_by: user.id,
          });

        if (error) throw error;

        toast({
          title: "シフト追加",
          description: "シフトが追加されました",
        });
      }

      setIsDialogOpen(false);
      onShiftUpdate();
    } catch (error) {
      console.error('Error saving shift:', error);
      toast({
        title: "エラー",
        description: "シフトの保存に失敗しました",
        variant: "destructive",
      });
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedCell) return;

    const existingShift = getShiftForCastAndDate(selectedCell.castId, selectedCell.date);
    if (!existingShift) return;

    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', existingShift.id);

      if (error) throw error;

      toast({
        title: "シフト削除",
        description: "シフトが削除されました",
      });

      setIsDialogOpen(false);
      onShiftUpdate();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast({
        title: "エラー",
        description: "シフトの削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <table className="w-full bg-background border border-border">
        <thead>
          <tr>
            <th className="border border-border text-center py-2 px-1 text-xs font-normal text-muted-foreground"></th>
            {dates.map((date) => (
              <th 
                key={date.date}
                className={`border border-border text-center py-2 px-1 text-xs font-normal sticky top-0 z-10 ${
                  date.isToday 
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-t-0" 
                    : "bg-background text-muted-foreground border-t-0"
                }`}
              >
                {date.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {casts.map((cast) => (
            <tr key={cast.id} className="hover:bg-muted/30 transition-colors">
              <td className="border border-border text-center py-2 px-1">
                <div className="text-left">
                  <span className="text-xs text-foreground whitespace-nowrap">
                    {cast.name}
                  </span>
                </div>
              </td>
              {dates.map((date) => {
                const shift = getShiftForCastAndDate(cast.id, date.date);
                return (
                  <td 
                    key={`${cast.id}-${date.date}`}
                    className="border border-border text-center py-2 px-1 text-xs relative cursor-pointer hover:bg-muted/50 transition-colors group"
                    style={{ width: "12.5%" }}
                    onClick={() => handleCellClick(cast.id, date.date)}
                  >
                    {shift ? (
                      <div className="relative">
                        <div className="mb-1 font-medium">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        {shift.notes && (
                          <div className="text-xs text-muted-foreground truncate">
                            {shift.notes}
                          </div>
                        )}
                        {isAdmin && (
                          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Edit size={12} className="text-primary" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-8 flex items-center justify-center">
                        {isAdmin && (
                          <Plus size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCell && getShiftForCastAndDate(selectedCell.castId, selectedCell.date)
                ? "シフトを編集"
                : "シフトを追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>開始時刻</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              />
            </div>
            <div>
              <Label>終了時刻</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              />
            </div>
            <div>
              <Label>メモ</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="部屋番号やその他のメモ"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveShift} className="flex-1">
                保存
              </Button>
              {selectedCell && getShiftForCastAndDate(selectedCell.castId, selectedCell.date) && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteShift}
                >
                  <Trash2 size={16} />
                  削除
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
