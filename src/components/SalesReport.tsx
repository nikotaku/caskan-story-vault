import { Card, CardContent } from "@/components/ui/card";

const salesData = [
  {
    period: "本日",
    amount: "27,000円",
    reservations: 1
  },
  {
    period: "昨日", 
    amount: "70,000円",
    reservations: 3
  },
  {
    period: "今月",
    amount: "656,900円", 
    reservations: 27
  },
  {
    period: "昨月",
    amount: "3,649,400円",
    reservations: 140
  }
];

export const SalesReport = () => {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="font-semibold text-sm mb-4">売上</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {salesData.map((data, index) => (
            <div key={index} className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {data.period}
              </div>
              <div className="text-xl font-medium">
                {data.amount}
              </div>
              <div className="text-sm text-primary">
                <span className="text-xs text-muted-foreground mr-2">予約</span>
                {data.reservations}件
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};