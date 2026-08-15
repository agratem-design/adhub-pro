import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { listRequests, updateRequestStatus } from '@/services/bookingService';
import type { BookingRequest, Billboard } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export function BookingRequestsTable() {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setRequests(listRequests());
  }, []);

  const ids = useMemo(() => Array.from(new Set(requests.map((r) => r.userId).filter(Boolean))), [requests]);

  useEffect(() => {
    const loadUsers = async () => {
      if (ids.length === 0) return;
      try {
        const validIds = ids.filter((id) => id && id !== 'guest');
        if (validIds.length === 0) {
          setUserNames((prev) => ({ ...prev, guest: 'زائر' }));
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id,name,email')
          .in('id', validIds as string[]);
        if (error) throw error;
        const map: Record<string, string> = {};
        (data || []).forEach((u: any) => {
          map[u.id] = u.name || u.email || u.id;
        });
        setUserNames((prev) => ({ ...prev, ...map, guest: 'زائر' }));
      } catch {
        // fallback: show id
        const map: Record<string, string> = {};
        ids.forEach((id) => (map[id] = id));
        setUserNames((prev) => ({ ...prev, ...map }));
      }
    };
    loadUsers();
  }, [ids]);

  const handleStatus = (id: string, status: BookingRequest['status']) => {
    updateRequestStatus(id, status);
    setRequests(listRequests());
  };

  const getUserName = (userId: string) => userNames[userId] || userId || '—';

  const renderBillboard = (b: Billboard, idx: number) => {
    const size = (b as any).Size || (b as any).size || '';
    const level = (b as any).Level || (b as any).level || '';
    const city = (b as any).City || (b as any).city || '';
    const district = (b as any).District || (b as any).district || '';
    const name = (b as any).Billboard_Name || (b as any).name || '';
    return (
      <div key={`${(b as any).ID || idx}`} className="rounded-md border p-3 flex items-center justify-between">
        <div className="text-sm">
          <div className="font-medium">{name || `لوحة #${idx + 1}`}</div>
          <div className="text-muted-foreground">{city} • {district} • {size} • {level}</div>
        </div>
        {(b as any).Price && (
          <div className="text-sm whitespace-nowrap">{String((b as any).Price)} د.ل</div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>طلبات الحجز</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">رقم الطلب</TableHead>
              <TableHead className="text-right">اسم الزبون</TableHead>
              <TableHead className="text-right">عدد اللوحات</TableHead>
              <TableHead className="text-right">الإجمالي</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.id.slice(-6).toUpperCase()}</TableCell>
                <TableCell>{getUserName(r.userId)}</TableCell>
                <TableCell>{r.billboards.length}</TableCell>
                <TableCell>{r.totalPrice.toLocaleString('ar-LY')} د.ل</TableCell>
                <TableCell>
                  {r.status === 'pending' && <Badge variant="secondary">قيد المراجعة</Badge>}
                  {r.status === 'approved' && <Badge>مقبول</Badge>}
                  {r.status === 'rejected' && <Badge variant="destructive">مرفوض</Badge>}
                </TableCell>
                <TableCell>{new Date(r.createdAt).toLocaleString('ar-LY')}</TableCell>
                <TableCell className="space-x-2 space-x-reverse">
                  <Dialog open={openId === r.id} onOpenChange={(open) => setOpenId(open ? r.id : null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">عرض</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>تفاصيل الطلب #{r.id.slice(-6).toUpperCase()}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">الزبون</div>
                            <div className="font-medium">{getUserName(r.userId)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">الحالة</div>
                            <div>
                              {r.status === 'pending' && <Badge variant="secondary">قيد المراجعة</Badge>}
                              {r.status === 'approved' && <Badge>مقبول</Badge>}
                              {r.status === 'rejected' && <Badge variant="destructive">مرفوض</Badge>}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">التاريخ</div>
                            <div>{new Date(r.createdAt).toLocaleString('ar-LY')}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">الإجمالي</div>
                            <div className="font-medium">{r.totalPrice.toLocaleString('ar-LY')} د.ل</div>
                          </div>
                        </div>

                        {r.notes && (
                          <div className="text-sm">
                            <div className="text-muted-foreground mb-1">ملاحظات</div>
                            <div className="whitespace-pre-wrap">{r.notes}</div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">اللوحات المختارة ({r.billboards.length})</div>
                          <div className="space-y-2">
                            {r.billboards.map((b, i) => renderBillboard(b, i))}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button size="sm" variant="outline" onClick={() => handleStatus(r.id, 'approved')}>قبول</Button>
                          <Button size="sm" variant="outline" onClick={() => handleStatus(r.id, 'rejected')}>رفض</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button size="sm" variant="outline" onClick={() => handleStatus(r.id, 'approved')}>قبول</Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatus(r.id, 'rejected')}>رفض</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {requests.length === 0 && (
          <div className="text-center text-muted-foreground py-8">لا توجد طلبات حاليًا</div>
        )}
      </CardContent>
    </Card>
  );
}
