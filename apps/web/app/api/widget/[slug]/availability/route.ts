// @ts-nocheck
import { AppError } from '@gojo/types';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { listAvailability } from '@/lib/services/direct-booking';

const querySchema = z.object({
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
});

type Context = { params: Promise<{ slug: string }> };

export async function GET(req: Request, context: Context) {
  const { slug } = await context.params;
  try {
    const url = new URL(req.url);
    const { checkIn, checkOut } = querySchema.parse({
      checkIn: url.searchParams.get('checkIn'),
      checkOut: url.searchParams.get('checkOut'),
    });
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return NextResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid date range' }, { status: 400 });
    }

    const availability = await listAvailability(slug, checkInDate, checkOutDate);
    return NextResponse.json(availability);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unexpected error' }, { status: 500 });
  }
}
