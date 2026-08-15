import type { BookingRequest, Billboard } from '@/types';

const KEY = 'booking_requests';

function read(): BookingRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) as BookingRequest[] : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: BookingRequest[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listRequests(): BookingRequest[] {
  return read().sort((a,b)=> new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addRequest(userId: string, billboards: Billboard[], totalPrice: number, notes?: string): BookingRequest {
  const list = read();
  const req: BookingRequest = {
    id: Math.random().toString(36).slice(2),
    userId,
    billboards,
    totalPrice,
    status: 'pending',
    createdAt: new Date(),
    notes,
  };
  list.push(req);
  write(list);
  return req;
}

export function updateRequestStatus(id: string, status: BookingRequest['status']) {
  const list = read();
  const idx = list.findIndex(r=>r.id===id);
  if (idx !== -1) {
    list[idx].status = status;
    write(list);
  }
}
