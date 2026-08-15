import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookingRequestsTable } from '@/components/BookingRequestsTable';
import { useAuth } from '@/contexts/AuthContext';
export default function BookingRequests() {
  const { canEdit } = useAuth();
  const canEditSection = canEdit('booking_requests');
  
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle>طلبات الحجز</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingRequestsTable />
        </CardContent>
      </Card>
    </div>
  );
}
