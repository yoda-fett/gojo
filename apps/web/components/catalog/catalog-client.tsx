'use client';

import { Plus, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

type CatalogItem = {
  id: string;
  itemType: 'AMENITY' | 'LINEN';
  name: string;
  unit: string;
  roomTypeId: string | null;
  expectedQtyPerStay: number | null;
  restockThreshold: number | null;
  linenCategory: 'ROUTINE' | 'PERIODIC' | null;
  totalOwned: number | null;
  minPoolSize: number | null;
  stateVersion: number;
};

type RoomType = { id: string; name: string };
type Vendor = { propertyId: string; laundryVendorName: string | null; laundryVendorContact: string | null };

export function CatalogClient({
  initialItems,
  roomTypes,
  initialType,
  vendor,
}: {
  initialItems: CatalogItem[];
  roomTypes: RoomType[];
  initialType: 'amenity' | 'linen';
  vendor: Vendor;
}) {
  const [type, setType] = useState<'amenity' | 'linen'>(initialType);
  const [items, setItems] = useState(initialItems);
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? '');
  const [vendorName, setVendorName] = useState(vendor.laundryVendorName ?? '');
  const [vendorContact, setVendorContact] = useState(vendor.laundryVendorContact ?? '');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () =>
      items.filter((item) =>
        type === 'amenity'
          ? item.itemType === 'AMENITY' && (!roomTypeId || item.roomTypeId === roomTypeId)
          : item.itemType === 'LINEN',
      ),
    [items, roomTypeId, type],
  );

  async function refresh(nextType = type, nextRoomTypeId = roomTypeId) {
    const params = new URLSearchParams({ itemType: nextType === 'amenity' ? 'AMENITY' : 'LINEN' });
    if (nextType === 'amenity' && nextRoomTypeId) params.set('roomTypeId', nextRoomTypeId);
    const res = await fetch(`/api/catalog-items?${params.toString()}`);
    const data = await res.json();
    setItems((current) => [
      ...current.filter((item) => item.itemType !== (nextType === 'amenity' ? 'AMENITY' : 'LINEN')),
      ...(data.items ?? []),
    ]);
  }

  async function addItem(formData: FormData) {
    setBusy(true);
    try {
      const body =
        type === 'amenity'
          ? {
              itemType: 'AMENITY',
              roomTypeId,
              name: String(formData.get('name') ?? ''),
              unit: String(formData.get('unit') ?? ''),
              expectedQtyPerStay: Number(formData.get('expectedQtyPerStay') ?? 0),
              restockThreshold: Number(formData.get('restockThreshold') ?? 0),
            }
          : {
              itemType: 'LINEN',
              name: String(formData.get('name') ?? ''),
              unit: String(formData.get('unit') ?? ''),
              linenCategory: String(formData.get('linenCategory') ?? 'ROUTINE'),
              totalOwned: Number(formData.get('totalOwned') ?? 0),
              minPoolSize: Number(formData.get('minPoolSize') ?? 0),
            };
      const res = await fetch('/api/catalog-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Could not save item');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveVendor() {
    setBusy(true);
    try {
      const res = await fetch(`/api/properties/${vendor.propertyId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ laundryVendorName: vendorName, laundryVendorContact: vendorContact || null }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Could not save vendor');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: CatalogItem) {
    setBusy(true);
    try {
      const res = await fetch(`/api/catalog-items/${item.id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stateVersion: item.stateVersion }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Could not delete item');
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-8 py-7">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Housekeeping Catalog</h1>
          <p className="text-xs text-slate-500">Definitions for room amenities and the property linen pool.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          {(['amenity', 'linen'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setType(tab)}
              className={`min-h-11 rounded-md px-4 text-sm font-semibold ${type === tab ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {tab === 'amenity' ? 'Amenities' : 'Linens'}
            </button>
          ))}
        </div>
      </header>

      {type === 'amenity' ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {roomTypes.map((roomType) => (
            <button
              key={roomType.id}
              type="button"
              onClick={() => setRoomTypeId(roomType.id)}
              className={`min-h-11 rounded-md border px-4 text-sm font-semibold ${roomTypeId === roomType.id ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {roomType.name}
            </button>
          ))}
        </div>
      ) : (
        <section className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            Laundry vendor
            <input value={vendorName} onChange={(event) => setVendorName(event.target.value)} maxLength={80} className="min-h-11 rounded-md border border-slate-200 px-3 text-sm text-slate-900" />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-500">
            Contact
            <input value={vendorContact} onChange={(event) => setVendorContact(event.target.value)} className="min-h-11 rounded-md border border-slate-200 px-3 text-sm text-slate-900" />
          </label>
          <button type="button" disabled={busy || !vendorName.trim()} onClick={saveVendor} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-teal-600 px-4 text-sm font-semibold text-white disabled:bg-slate-300">
            <Save size={16} /> Save
          </button>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-12 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span className="col-span-3">Name</span>
          <span className="col-span-2">Unit</span>
          {type === 'amenity' ? (
            <>
              <span className="col-span-3">Expected qty/stay</span>
              <span className="col-span-3">Restock threshold</span>
            </>
          ) : (
            <>
              <span className="col-span-2">Category</span>
              <span className="col-span-2">Total owned</span>
              <span className="col-span-2">Min pool</span>
            </>
          )}
          <span className="col-span-1 text-right">Action</span>
        </div>
        {visible.map((item) => (
          <div key={item.id} className="grid min-h-16 grid-cols-12 items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
            <span className="col-span-3 font-semibold text-slate-900">{item.name}<span className="block text-[11px] font-normal text-slate-400">last edited v{item.stateVersion}</span></span>
            <span className="col-span-2 text-slate-600">{item.unit}</span>
            {type === 'amenity' ? (
              <>
                <span className="col-span-3 text-slate-700">{item.expectedQtyPerStay ?? '-'}</span>
                <span className="col-span-3 text-slate-700">{item.restockThreshold ?? '-'}</span>
              </>
            ) : (
              <>
                <span className="col-span-2 text-slate-700">{item.linenCategory}</span>
                <span className="col-span-2 text-slate-700">{item.totalOwned ?? 0}</span>
                <span className="col-span-2 text-slate-700">{item.minPoolSize ?? '-'}</span>
              </>
            )}
            <button type="button" aria-label={`Delete ${item.name}`} onClick={() => removeItem(item)} className="col-span-1 ml-auto inline-flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </section>

      <form action={addItem} className="mt-5 grid grid-cols-12 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <TextField name="name" label="Name" className="col-span-3" />
        <TextField name="unit" label="Unit" className="col-span-2" />
        {type === 'amenity' ? (
          <>
            <TextField name="expectedQtyPerStay" label="Expected qty/stay" inputMode="numeric" className="col-span-3" />
            <TextField name="restockThreshold" label="Restock threshold" inputMode="numeric" className="col-span-3" />
          </>
        ) : (
          <>
            <label className="col-span-2 grid gap-1 text-xs font-semibold text-slate-500">
              Category
              <select name="linenCategory" className="min-h-11 rounded-md border border-slate-200 px-3 text-sm text-slate-900">
                <option value="ROUTINE">Routine</option>
                <option value="PERIODIC">Periodic</option>
              </select>
            </label>
            <TextField name="totalOwned" label="Total owned" inputMode="numeric" className="col-span-2" />
            <TextField name="minPoolSize" label="Min pool" inputMode="numeric" className="col-span-2" />
          </>
        )}
        <button type="submit" disabled={busy || (type === 'amenity' && !roomTypeId)} className="col-span-1 inline-flex min-h-11 items-center justify-center rounded-md bg-teal-600 text-white disabled:bg-slate-300">
          <Plus size={18} />
        </button>
      </form>
    </main>
  );
}

function TextField(props: { name: string; label: string; className: string; inputMode?: 'numeric' }) {
  return (
    <label className={`${props.className} grid gap-1 text-xs font-semibold text-slate-500`}>
      {props.label}
      <input name={props.name} inputMode={props.inputMode} required className="min-h-11 rounded-md border border-slate-200 px-3 text-sm text-slate-900" />
    </label>
  );
}
