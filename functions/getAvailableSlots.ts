import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { shop_id, barber_id, date } = body;

    if (!shop_id || !date) {
      return Response.json({ error: 'shop_id and date are required' }, { status: 400 });
    }

    // Get shop info
    const shops = await base44.asServiceRole.entities.BarberShop.filter({ id: shop_id });
    if (!shops.length) return Response.json({ error: 'Shop not found' }, { status: 404 });
    const shop = shops[0];

    // Get barber(s)
    let barbers;
    if (barber_id) {
      barbers = await base44.asServiceRole.entities.Barber.filter({ id: barber_id, shop_id, active: true });
    } else {
      barbers = await base44.asServiceRole.entities.Barber.filter({ shop_id, active: true });
    }

    if (!barbers.length) return Response.json({ error: 'No barbers found' }, { status: 404 });

    // Parse date and check working day
    const requestDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[requestDate.getDay()];

    const slotDuration = shop.slot_duration_minutes || 30;
    const openingTime = shop.opening_time || '09:00';
    const closingTime = shop.closing_time || '18:00';

    // Generate all possible time slots for the day
    const generateSlots = (start: string, end: string, duration: number) => {
      const slots = [];
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + duration <= endMinutes) {
        const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
        const m = (currentMinutes % 60).toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
        currentMinutes += duration;
      }
      return slots;
    };

    // Get existing appointments for that date
    const existingAppointments = await base44.asServiceRole.entities.Appointment.filter({
      shop_id,
      date,
    });

    const availableSlotsByBarber = [];

    for (const barber of barbers) {
      const barberWorkingDays = barber.working_days || [];
      const isWorkingDay = barberWorkingDays.length === 0 || 
        barberWorkingDays.map((d: string) => d.toLowerCase()).includes(dayName);

      if (!isWorkingDay) {
        availableSlotsByBarber.push({
          barber_id: barber.id,
          barber_name: barber.name,
          available: false,
          reason: 'Not working on this day',
          slots: []
        });
        continue;
      }

      const barberStart = barber.start_time || openingTime;
      const barberEnd = barber.end_time || closingTime;
      const allSlots = generateSlots(barberStart, barberEnd, slotDuration);

      // Filter out already booked slots
      const bookedSlots = existingAppointments
        .filter((a: any) => 
          a.barber_id === barber.id && 
          ['confirmed', 'pending'].includes(a.status)
        )
        .map((a: any) => a.start_time);

      const freeSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

      availableSlotsByBarber.push({
        barber_id: barber.id,
        barber_name: barber.name,
        available: freeSlots.length > 0,
        slots: freeSlots
      });
    }

    return Response.json({
      shop_id,
      date,
      slot_duration_minutes: slotDuration,
      barbers: availableSlotsByBarber
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
